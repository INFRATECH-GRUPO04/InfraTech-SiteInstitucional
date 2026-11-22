const { GetObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const fonteConfigurada = process.env.INVESTIGACAO_GOLD_SOURCE;
if (fonteConfigurada && fonteConfigurada !== 's3') {
    throw new Error('A dashboard de investigação aceita somente INVESTIGACAO_GOLD_SOURCE=s3.');
}

const REGIAO = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.S3_BUCKET;
const PREFIXO_GOLD = (process.env.S3_GOLD_PREFIX || '03-gold/').replace(/^\/+|\/+$/g, '') + '/';
const clienteS3 = new S3Client({ region: REGIAO });

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
    return `${PREFIXO_GOLD}empresa-${Number(idEmpresa)}/historico/metadados.json`;
}

async function obterMetadados(idEmpresa, cliente = clienteS3, bucket = BUCKET) {
    const metadados = await lerJson(chaveMetadados(idEmpresa), cliente, bucket);
    if (!metadados) return null;
    if (Number(metadados.id_empresa) !== Number(idEmpresa) || !Array.isArray(metadados.servidores)) {
        throw new Error('Os metadados Gold não correspondem ao formato esperado.');
    }
    return metadados;
}

function diaDaChave(chave) {
    const resultado = String(chave || '').match(/\/data=(\d{4}-\d{2}-\d{2})\.json$/);
    return resultado && resultado[1];
}

function chavesDoPeriodo(metadados, idEmpresa, servidores, inicioUtc, fimUtc) {
    const datas = metadados.servidores || [];
    const primeiroDia = inicioUtc.toISOString().slice(0, 10);
    const ultimoDia = new Date(fimUtc.getTime() - 1).toISOString().slice(0, 10);
    const empresaPrefixo = `${PREFIXO_GOLD}empresa-${Number(idEmpresa)}/historico/`;
    const resultado = [];

    servidores.forEach((idServidor) => {
        const info = datas.find((item) => Number(item.id_servidor) === Number(idServidor));
        (info && Array.isArray(info.particoes) ? info.particoes : []).forEach((chave) => {
            const dia = diaDaChave(chave);
            const prefixoServidor = `${empresaPrefixo}servidor_id=${Number(idServidor)}/data=`;
            const caminhoValido = String(chave).startsWith(prefixoServidor)
                && /^\d{4}-\d{2}-\d{2}\.json$/.test(String(chave).slice(prefixoServidor.length));
            if (dia && dia >= primeiroDia && dia <= ultimoDia && caminhoValido) resultado.push(chave);
        });
    });
    return [...new Set(resultado)].sort();
}

async function percorrerParticoes(chaves, aoLer, cliente = clienteS3, bucket = BUCKET) {
    const concorrencia = 8;
    for (let indice = 0; indice < chaves.length; indice += concorrencia) {
        const lote = chaves.slice(indice, indice + concorrencia);
        const documentos = await Promise.all(lote.map(async (chave) => ({
            chave,
            documento: await lerJson(chave, cliente, bucket)
        })));
        for (const item of documentos) {
            if (item.documento && Array.isArray(item.documento.capturas)) await aoLer(item);
        }
    }
}

module.exports = { obterMetadados, chavesDoPeriodo, percorrerParticoes };
