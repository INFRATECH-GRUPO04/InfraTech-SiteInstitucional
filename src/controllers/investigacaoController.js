const goldModel = require('../models/goldModel');
const investigacaoModel = require('../models/investigacaoModel');
const servidorModel = require('../models/servidorModel');

const METRICAS = new Set(['cpu', 'ram', 'disco', 'rede']);
const MAX_SERVIDORES_ANALISE = 12;

function erroServidor(res, status, mensagem) {
    return res.status(status).json({ erro: mensagem });
}

async function carregarServidores(idEmpresa) {
    const resultado = await servidorModel.listar(idEmpresa);
    return Array.isArray(resultado) ? resultado : [];
}

// (Cláudia - M) Descreve o objeto Gold consultado para que a interface possa comprovar a origem dos dados.
function origemGold(idEmpresa) {
    const prefixo = (process.env.S3_GOLD_PREFIX || '03-gold/').replace(/^\/+|\/+$/g, '');
    const objetoMetadados = `${prefixo}/empresa-${Number(idEmpresa)}/historico/metadados.json`;
    return {
        provedor: 'Amazon S3',
        camada: 'Gold',
        bucket: process.env.S3_BUCKET || null,
        objetoMetadados
    };
}

async function metadados(req, res) {
    const idEmpresa = Number(req.usuario && req.usuario.empresa);
    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) return erroServidor(res, 401, 'A sessão não possui uma empresa válida.');

    try {
        const [gold, servidoresBanco] = await Promise.all([
            goldModel.obterMetadados(idEmpresa),
            carregarServidores(idEmpresa)
        ]);
        const porId = new Map((gold && gold.servidores || []).map((item) => [Number(item.id_servidor), item]));
        const servidores = servidoresBanco.map((servidor) => {
            const id = Number(servidor.id_servidor);
            const historico = porId.get(id);
            return {
                idServidor: id,
                nome: servidor.nome,
                primeiraCaptura: historico && historico.primeira_captura || null,
                ultimaCaptura: historico && historico.ultima_captura || null,
                capturasValidas: Number(historico && historico.capturas_validas || 0),
                frequenciaEsperadaSegundos: Number(historico && historico.frequencia_esperada_segundos
                    || gold && gold.frequencia_esperada_segundos || 60),
                temHistorico: Boolean(historico && historico.particoes && historico.particoes.length)
            };
        });
        return res.status(200).json({
            idEmpresa,
            origemDados: { ...origemGold(idEmpresa), metadadosEncontrados: Boolean(gold) },
            historicoDisponivel: Boolean(gold && gold.primeira_captura && gold.ultima_captura),
            primeiraCaptura: gold && gold.primeira_captura || null,
            ultimaCaptura: gold && gold.ultima_captura || null,
            frequenciaEsperadaSegundos: Number(gold && gold.frequencia_esperada_segundos || 60),
            servidores
        });
    } catch (erro) {
        console.error('Falha ao obter metadados da investigação:', erro);
        return erroServidor(res, 503, 'Não foi possível carregar os metadados históricos da empresa.');
    }
}

function validarPeriodo(body, metadadosGold) {
    const inicio = body && body.periodo && body.periodo.inicio;
    const fim = body && body.periodo && body.periodo.fim;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(inicio || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(fim || '')) || inicio > fim) {
        return { erro: 'Informe um intervalo de datas válido.' };
    }
    if (!metadadosGold || !metadadosGold.primeira_captura || !metadadosGold.ultima_captura) {
        return { erro: 'A empresa ainda não possui histórico disponível na Gold.' };
    }
    const inicioUtc = investigacaoModel.dataLocalParaUtc(inicio, 0);
    const fimDate = new Date(`${fim}T00:00:00Z`);
    fimDate.setUTCDate(fimDate.getUTCDate() + 1);
    const fimUtc = investigacaoModel.dataLocalParaUtc(fimDate.toISOString().slice(0, 10), 0);
    if (!inicioUtc || !fimUtc) return { erro: 'Informe um intervalo de datas válido.' };
    const primeiro = Date.parse(metadadosGold.primeira_captura);
    const ultimo = Date.parse(metadadosGold.ultima_captura);
    if (!Number.isFinite(primeiro) || !Number.isFinite(ultimo)) {
        return { erro: 'Os metadados da empresa não contêm limites de data válidos.' };
    }
    const dataLocal = (valor) => {
        const campos = new Intl.DateTimeFormat('en-CA', {
            timeZone: process.env.TIMEZONE || 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(new Date(valor)).reduce((saida, parte) => {
            saida[parte.type] = parte.value;
            return saida;
        }, {});
        return `${campos.year}-${campos.month}-${campos.day}`;
    };
    if (inicio < dataLocal(primeiro) || fim > dataLocal(ultimo)
        || fimUtc.getTime() <= primeiro || inicioUtc.getTime() > ultimo) {
        return { erro: 'Escolha datas dentro do histórico disponível da empresa.' };
    }
    return { inicioUtc, fimUtc };
}

async function carregarLimites(idEmpresa, servidores) {
    const [globaisBanco, ...componentesPorServidor] = await Promise.all([
        servidorModel.listarLimitesGlobais(idEmpresa).catch((erro) => {
            // Usa os limites já cadastrados por servidor quando esta instalação ainda não tem a tabela global.
            if (erro && erro.code === 'ER_NO_SUCH_TABLE') return [];
            throw erro;
        }),
        ...servidores.map((idServidor) => servidorModel.listarComponentesPorServidor(idServidor))
    ]);
    // (Cláudia - M) Mantém os limites de atenção e crítico da empresa para classificar visualmente os eventos da tabela.
    const globais = Object.fromEntries((globaisBanco || []).map((item) => [
        String(item.tipo).toLowerCase(), {
            atencao: item.limite_atencao == null ? null : Number(item.limite_atencao),
            critico: item.limite_critico == null ? null : Number(item.limite_critico)
        }
    ]));
    const limites = {};
    servidores.forEach((idServidor, indice) => {
        const componentes = componentesPorServidor[indice] || [];
        const porTipo = {};
        componentes.forEach((componente) => {
            const tipo = String(componente.tipo || '').toLowerCase();
            if (!METRICAS.has(tipo)) return;
            if (tipo === 'rede' && componente.nome_metrica && componente.nome_metrica !== 'uso_percentual') {
                if (Number(componente.capacidade_total) > 0) porTipo.capacidadeRedeMbps = Number(componente.capacidade_total);
                return;
            }
            const valor = componente.limite_critico == null ? globais[tipo]?.critico : Number(componente.limite_critico);
            if (Number.isFinite(valor)) porTipo[tipo] = valor;
            if (!porTipo.limitesAtencao) porTipo.limitesAtencao = {};
            const limiteAtencao = componente.limite_atencao == null
                ? globais[tipo]?.atencao : Number(componente.limite_atencao);
            if (Number.isFinite(limiteAtencao)) porTipo.limitesAtencao[tipo] = limiteAtencao;
            if (tipo === 'rede' && Number(componente.capacidade_total) > 0) {
                porTipo.capacidadeRedeMbps = Number(componente.capacidade_total);
            }
        });
        METRICAS.forEach((tipo) => {
            if (porTipo[tipo] === undefined && Number.isFinite(globais[tipo]?.critico)) porTipo[tipo] = globais[tipo].critico;
            if (!porTipo.limitesAtencao) porTipo.limitesAtencao = {};
            if (porTipo.limitesAtencao[tipo] === undefined && Number.isFinite(globais[tipo]?.atencao)) {
                porTipo.limitesAtencao[tipo] = globais[tipo].atencao;
            }
        });
        limites[String(idServidor)] = porTipo;
    });
    return limites;
}

// (Cláudia - M) Disponibiliza os limites da própria empresa para colorir eventos sem transformar Z-score em estado operacional.
function prepararLimitesOperacionais(limitesCriticos, servidores) {
    return Object.fromEntries(servidores.map((idServidor) => {
        const origem = limitesCriticos[String(idServidor)] || {};
        const capacidadeRede = Number(origem.capacidadeRedeMbps);
        const porMetrica = Object.fromEntries([...METRICAS].map((metrica) => {
            const converter = (valor) => {
                if (valor == null || valor === '' || !Number.isFinite(Number(valor))) return null;
                const numero = Number(valor);
                if (metrica !== 'rede') return numero;
                return Number.isFinite(capacidadeRede) && capacidadeRede > 0
                    ? capacidadeRede * numero / 100 : null;
            };
            return [metrica, {
                atencao: converter(origem.limitesAtencao?.[metrica]),
                critico: converter(origem[metrica])
            }];
        }));
        return [String(idServidor), porMetrica];
    }));
}

async function analisar(req, res) {
    const idEmpresa = Number(req.usuario && req.usuario.empresa);
    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) return erroServidor(res, 401, 'A sessão não possui uma empresa válida.');
    const corpo = req.body || {};
    const idsRecebidos = corpo.servidores;
    const metricas = corpo.metricas || {};
    if (!Array.isArray(idsRecebidos) || !idsRecebidos.length || idsRecebidos.length > 100
        || idsRecebidos.some((id) => !Number.isInteger(Number(id)) || Number(id) <= 0)) {
        return erroServidor(res, 400, 'Selecione pelo menos um servidor válido.');
    }
    const ids = [...new Set(idsRecebidos.map(Number))];
    if (ids.length !== idsRecebidos.length) return erroServidor(res, 400, 'A seleção contém servidores repetidos.');
    if (![metricas.x, metricas.y].every((metrica) => METRICAS.has(metrica)) || metricas.x === metricas.y
        || ![metricas.x, metricas.y].includes(metricas.boxplot)) {
        return erroServidor(res, 400, 'Escolha duas métricas diferentes; o boxplot deve usar uma delas.');
    }

    const relacaoSolicitada = corpo.relacao || null;
    if (relacaoSolicitada && (!Number.isInteger(Number(relacaoSolicitada.origem))
        || !Number.isInteger(Number(relacaoSolicitada.destino))
        || Number(relacaoSolicitada.origem) === Number(relacaoSolicitada.destino)
        || !ids.includes(Number(relacaoSolicitada.origem)) || !ids.includes(Number(relacaoSolicitada.destino)))) {
        return erroServidor(res, 400, 'Escolha uma relação direcionada entre dois servidores selecionados.');
    }

    try {
        const [metadata, todosServidores] = await Promise.all([
            goldModel.obterMetadados(idEmpresa),
            carregarServidores(idEmpresa)
        ]);
        if (!metadata) return erroServidor(res, 404, 'A Gold ainda não publicou metadados para esta empresa.');
        const permitidos = new Set(todosServidores.map((item) => Number(item.id_servidor)));
        if (ids.some((id) => !permitidos.has(id))) return erroServidor(res, 403, 'A seleção contém servidor que não pertence à empresa autenticada.');

        const periodo = validarPeriodo(corpo, metadata);
        if (periodo.erro) return erroServidor(res, 400, periodo.erro);
        let limitesCriticos = {};
        try {
            limitesCriticos = await carregarLimites(idEmpresa, ids);
        } catch (erroLimites) {
            console.error('Não foi possível carregar os limites críticos; as demais análises continuam:', erroLimites);
        }
        const informacoesGold = new Map((metadata.servidores || []).map((item) => [Number(item.id_servidor), item]));
        const idsHistorico = relacaoSolicitada
            ? [Number(relacaoSolicitada.origem), Number(relacaoSolicitada.destino)] : ids;
        const chaves = goldModel.chavesDoPeriodo(metadata, idEmpresa, idsHistorico, periodo.inicioUtc, periodo.fimUtc);
        const capturasPorServidor = new Map(idsHistorico.map((id) => [id, new Map()]));
        let particoesGoldLidas = 0;
        let capturasNoPeriodo = 0;
        await goldModel.percorrerParticoes(chaves, ({ documento }) => {
            particoesGoldLidas += 1;
            const idServidor = Number(documento.id_servidor);
            const mapa = capturasPorServidor.get(idServidor);
            if (!mapa || Number(documento.id_empresa) !== idEmpresa) return;
            (documento.capturas || []).forEach((captura) => {
                if (Number(captura.id_empresa) !== idEmpresa || Number(captura.id_servidor) !== idServidor) return;
                const instante = Date.parse(captura.timestamp);
                if (!Number.isFinite(instante) || instante < periodo.inicioUtc.getTime() || instante >= periodo.fimUtc.getTime()) return;
                if (!mapa.has(captura.timestamp)) capturasNoPeriodo += 1;
                mapa.set(captura.timestamp, captura);
            });
        });
        const servidores = idsHistorico.map((idServidor) => {
            const informacao = informacoesGold.get(idServidor) || {};
            const nome = todosServidores.find((item) => Number(item.id_servidor) === idServidor)?.nome || `Servidor ${idServidor}`;
            return { idServidor, nome, metadados: informacao,
                amostras: [...capturasPorServidor.get(idServidor).values()] };
        });
        if (relacaoSolicitada) {
            const origem = servidores.find((servidor) => servidor.idServidor === Number(relacaoSolicitada.origem));
            const destino = servidores.find((servidor) => servidor.idServidor === Number(relacaoSolicitada.destino));
            const detalhe = investigacaoModel.montarDetalheRegressao(origem, destino, metricas, 30, 400);
            return res.status(200).json({
                tipoResposta: 'detalhe-relacao',
                origemDados: {
                    ...origemGold(idEmpresa), particoesLidas: particoesGoldLidas,
                    particoesListadas: chaves.length, capturasNoPeriodo
                },
                relacao: detalhe,
                kpis: { maiorDesvioRegressao: detalhe.maiorDesvio ? {
                    ...detalhe.maiorDesvio,
                    unidade: ['cpu', 'ram', 'disco'].includes(metricas.y) ? 'p.p.' : 'Mbps',
                    relacao: detalhe.rotulo
                } : null }
            });
        }
        const resultado = investigacaoModel.calcularAnalise({
            servidores, inicioUtc: periodo.inicioUtc, fimUtc: periodo.fimUtc, metricas, limitesCriticos
        });
        resultado.limitesOperacionais = prepararLimitesOperacionais(limitesCriticos, ids);
        resultado.origemDados = {
            ...origemGold(idEmpresa), particoesLidas: particoesGoldLidas,
            particoesListadas: chaves.length, capturasNoPeriodo
        };
        return res.status(200).json(resultado);
    } catch (erro) {
        console.error('Falha ao calcular investigação:', erro);
        return erroServidor(res, 503, 'Não foi possível consultar os dados históricos da empresa.');
    }
}

module.exports = { metadados, analisar, validarPeriodo };
