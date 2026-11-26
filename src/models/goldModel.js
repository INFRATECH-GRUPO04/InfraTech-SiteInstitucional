const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const fonteConfigurada = process.env.INVESTIGACAO_GOLD_SOURCE;
if (fonteConfigurada && fonteConfigurada !== 's3') {
    throw new Error('A dashboard de investigação aceita somente INVESTIGACAO_GOLD_SOURCE=s3.');
}

const REGIAO = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.S3_BUCKET;
const PREFIXO_GOLD = (process.env.S3_GOLD_PREFIX || '03-gold/').replace(/^\/+|\/+$/g, '') + '/';
const clienteS3 = new S3Client({ region: REGIAO });
const COLUNAS_CAPTURA_OBRIGATORIAS = [
    'timestamp', 'nome_servidor', 'cpu_pct', 'ram_pct', 'disco_pct',
    'upload_mbps', 'download_mbps', 'rede_mbps', 'bytes_enviados', 'bytes_recebidos'
];

async function corpoComoTexto(corpo) {
    if (corpo && typeof corpo.transformToString === 'function') return corpo.transformToString();
    const partes = [];
    for await (const parte of corpo) partes.push(Buffer.from(parte));
    return Buffer.concat(partes).toString('utf8');
}

async function lerJson(chave, cliente = clienteS3, bucket = BUCKET) {
    if (!bucket) throw new Error('S3_BUCKET não está configurado no backend.');
    try {
        const resposta = await cliente.send(new GetObjectCommand({ Bucket: bucket, Key: chave }));
        return JSON.parse(await corpoComoTexto(resposta.Body));
    } catch (erro) {
        const codigo = erro && (erro.name || erro.Code || erro.$metadata?.httpStatusCode);
        if (codigo === 'NoSuchKey' || codigo === 'NotFound' || codigo === 404) return null;
        throw erro;
    }
}

function chaveMetadados(idEmpresa) {
    return `${PREFIXO_GOLD}empresa-${Number(idEmpresa)}/dashboard.json`;
}

async function obterMetadados(idEmpresa, cliente = clienteS3, bucket = BUCKET) {
    const dashboard = await lerJson(chaveMetadados(idEmpresa), cliente, bucket);
    if (!dashboard) return null;
    const historico = dashboard.historico;
    const metadados = historico && historico.metadados;
    const colunas = historico && historico.colunas_captura;
    const particoes = historico && historico.particoes_historicas;
    const nomesColunas = Array.isArray(colunas) ? new Set(colunas) : new Set();
    if (Number(dashboard.id_empresa) !== Number(idEmpresa)
        || Number(metadados && metadados.id_empresa) !== Number(idEmpresa)
        || !Array.isArray(metadados && metadados.servidores)
        || !Array.isArray(colunas)
        || nomesColunas.size !== colunas.length
        || colunas.some((coluna) => typeof coluna !== 'string' || !coluna.trim())
        || colunas.includes('id_empresa') || colunas.includes('id_servidor')
        || COLUNAS_CAPTURA_OBRIGATORIAS.some((coluna) => !nomesColunas.has(coluna))
        || !Array.isArray(particoes)) {
        throw new Error('O dashboard Gold não corresponde ao formato histórico esperado.');
    }
    const servidores = new Set();
    metadados.servidores.forEach((servidor) => {
        const idServidor = Number(servidor && servidor.id_servidor);
        if (!Number.isInteger(idServidor) || idServidor <= 0 || servidores.has(idServidor)) {
            throw new Error('Os metadados Gold contêm servidores inválidos ou repetidos.');
        }
        servidores.add(idServidor);
    });
    const particoesVistas = new Set();
    particoes.forEach((particao) => {
        const documento = particao && particao.documento;
        const manifesto = particao && particao.manifesto;
        const idParticao = Number(documento && documento.id_servidor);
        const dia = documento && documento.data_utc;
        const frequencia = Number(documento && documento.frequencia_esperada_segundos);
        const chaveParticao = `${idParticao}:${dia}`;
        if (!documento || !manifesto || Number(documento.id_empresa) !== Number(idEmpresa)
            || !Number.isInteger(idParticao) || !servidores.has(idParticao)
            || !/^\d{4}-\d{2}-\d{2}$/.test(String(dia || ''))
            || !Number.isFinite(Date.parse(`${dia}T00:00:00Z`))
            || new Date(`${dia}T00:00:00Z`).toISOString().slice(0, 10) !== dia
            || !Number.isFinite(frequencia) || frequencia <= 0
            || !Array.isArray(documento.capturas) || !documento.capturas.length
            || Number(manifesto.id_empresa) !== Number(idEmpresa)
            || Number(manifesto.id_servidor) !== idParticao || manifesto.data_utc !== dia
            || particoesVistas.has(chaveParticao)) {
            throw new Error('O dashboard Gold contém uma partição ou manifesto incompatível.');
        }
        particoesVistas.add(chaveParticao);
    });
    return {
        ...metadados,
        colunas_captura: colunas,
        particoes_historicas: particoes
    };
}

function chavesDoPeriodo(metadados, idEmpresa, servidores, inicioUtc, fimUtc) {
    const idsSelecionados = new Set(servidores.map(Number));
    const primeiroDia = inicioUtc.toISOString().slice(0, 10);
    const ultimoDia = new Date(fimUtc.getTime() - 1).toISOString().slice(0, 10);
    const inicioMs = inicioUtc.getTime();
    const fimMs = fimUtc.getTime();
    return metadados.particoes_historicas
        .filter((particao) => {
            const documento = particao.documento;
            return Number(documento.id_empresa) === Number(idEmpresa)
                && idsSelecionados.has(Number(documento.id_servidor))
                && documento.data_utc >= primeiroDia && documento.data_utc <= ultimoDia;
        })
        .map((particao) => ({
            ...particao,
            colunas_captura: metadados.colunas_captura,
            inicioMs,
            fimMs
        }))
        .sort((a, b) => Number(a.documento.id_servidor) - Number(b.documento.id_servidor)
            || a.documento.data_utc.localeCompare(b.documento.data_utc));
}

async function percorrerParticoes(particoes, aoLer, cliente = clienteS3, bucket = BUCKET) {
    for (const particao of particoes) {
        const documento = particao.documento;
        const colunas = particao.colunas_captura;
        const indiceTimestamp = colunas.indexOf('timestamp');
        const capturas = [];
        for (const valores of documento.capturas) {
            if (!Array.isArray(valores) || valores.length !== colunas.length) {
                throw new Error('Uma captura compactada possui quantidade de valores incompatível.');
            }
            const timestamp = valores[indiceTimestamp];
            const instante = typeof timestamp === 'string' ? Date.parse(timestamp) : NaN;
            if (!Number.isFinite(instante)) throw new Error('Uma captura Gold possui timestamp inválido.');
            if (instante < particao.inicioMs || instante >= particao.fimMs) continue;
            const captura = Object.fromEntries(colunas.map((coluna, indice) => [coluna, valores[indice]]));
            captura.id_empresa = documento.id_empresa;
            captura.id_servidor = documento.id_servidor;
            capturas.push(captura);
        }
        await aoLer({
            chave: `servidor_id=${documento.id_servidor}/data=${documento.data_utc}`,
            documento: { ...documento, capturas },
            manifesto: particao.manifesto
        });
    }
}

module.exports = { obterMetadados, chavesDoPeriodo, percorrerParticoes };
