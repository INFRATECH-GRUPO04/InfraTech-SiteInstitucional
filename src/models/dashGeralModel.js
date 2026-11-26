/*
 * Dashboard Geral: lê o JSON gold, cruza com os limites do MySQL e devolve o
 * contrato agregado consumido por public/js/dash-geral.js.
 *
 * O JSON principal não lista servidores nem detalhes de incidentes: o front
 * recebe apenas os agregados de saúde, a série de disponibilidade e o ranking
 * de incidentes Jira dos últimos 30d (vazio se o Jira estiver indisponível).
 * As rotas complementares ficam em dashComplementosModel.
 */
var fs = require('fs/promises');
var path = require('path');
var database = require('../database/config');
var servidorModel = require('./servidorModel');
var jiraDashGeral = require('../services/jiraDashGeral');

var LIMITES_PADRAO = {
    cpu: { atencao: 70, critico: 85 },
    ram: { atencao: 75, critico: 90 },
    disco: { atencao: 80, critico: 90 }
};
var ORDEM_SITUACAO = { critico: 0, offline: 1, atencao: 2, normal: 3 };

function numeroOuNull(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    var numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
}

function erroGoldNaoEncontrado(mensagem) {
    var erro = new Error(mensagem);
    erro.codigo = 'GOLD_NAO_ENCONTRADO';
    return erro;
}

/* DASH_GOLD_LOCAL serve para testar sem S3: o arquivo fica em
 * 03-gold/empresa-{id}/dash-geral.json na raiz do projeto.
 */
async function lerGold(idEmpresa) {
    if (process.env.DASH_GOLD_LOCAL === '1') {
        var arquivo = path.join(process.cwd(), '03-gold', 'empresa-' + idEmpresa, 'dash-geral.json');
        try {
            return JSON.parse(await fs.readFile(arquivo, 'utf8'));
        } catch (erro) {
            if (erro.code === 'ENOENT') throw erroGoldNaoEncontrado('JSON gold não encontrado: ' + arquivo);
            throw erro;
        }
    }

    var bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error('S3_BUCKET não configurado.');

    // Caminho final: s3://<S3_BUCKET>/<S3_GOLD_PREFIX>/empresa-{id}/dash-geral.json
    var prefixo = String(process.env.S3_GOLD_PREFIX || '03-gold/').replace(/^\/+/, '');
    if (prefixo && !prefixo.endsWith('/')) prefixo += '/';
    var chave = prefixo + 'empresa-' + idEmpresa + '/dash-geral.json';
    var S3 = require('@aws-sdk/client-s3');
    var cliente = new S3.S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

    try {
        var resposta = await cliente.send(new S3.GetObjectCommand({ Bucket: bucket, Key: chave }));
        return JSON.parse(await resposta.Body.transformToString());
    } catch (erro) {
        var status = erro.$metadata && erro.$metadata.httpStatusCode;
        if (erro.name === 'NoSuchKey' || erro.name === 'NotFound' || status === 404) {
            throw erroGoldNaoEncontrado('JSON gold não encontrado: s3://' + bucket + '/' + chave);
        }
        throw erro;
    }
}

/* O filtro de visibilidade usa apenas a sessão: gestor vê tudo, os demais
 * cargos veem os servidores vinculados (ou todos, se não houver vínculo).
 */
async function buscarServidoresPermitidos(usuario) {
    var empresa = Number(usuario.empresa);
    var servidores = await database.executar(
        `SELECT s.id_servidor, s.nome, s.localizacao
         FROM servidor s
         WHERE s.fk_empresa = ? AND s.status_sistema = 1
         ORDER BY s.nome`,
        [empresa]
    );
    if (String(usuario.cargo || '').toUpperCase() === 'GESTOR') return servidores;

    var vinculos = await database.executar(
        `SELECT sf.fk_servidor
         FROM servidor_funcionario sf
         JOIN servidor s ON s.id_servidor = sf.fk_servidor
         WHERE sf.fk_funcionario = ? AND s.fk_empresa = ? AND s.status_sistema = 1`,
        [Number(usuario.id), empresa]
    );
    if (!vinculos.length) return servidores;

    var permitidos = new Set(vinculos.map(function (vinculo) { return Number(vinculo.fk_servidor); }));
    return servidores.filter(function (servidor) { return permitidos.has(Number(servidor.id_servidor)); });
}

async function buscarLimitesPorServidor(idEmpresa) {
    var linhas = await database.executar(
        `SELECT c.fk_servidor AS id_servidor, c.tipo,
                m.limite_atencao AS atencao, m.limite_critico AS critico
         FROM metrica m
         JOIN componente c ON c.id_componente = m.fk_componente
         JOIN servidor s ON s.id_servidor = c.fk_servidor
         WHERE s.fk_empresa = ? AND m.nome = 'uso_percentual'
           AND c.tipo IN ('cpu', 'ram', 'disco')`,
        [idEmpresa]
    );
    var limites = {};
    linhas.forEach(function (linha) {
        var tipo = String(linha.tipo || '').toLowerCase();
        if (!LIMITES_PADRAO[tipo]) return;
        var id = Number(linha.id_servidor);
        limites[id] = limites[id] || {};
        if (!limites[id][tipo]) {
            limites[id][tipo] = { atencao: numeroOuNull(linha.atencao), critico: numeroOuNull(linha.critico) };
        }
    });
    return limites;
}

function classificarValor(valor, faixa) {
    var numero = numeroOuNull(valor);
    if (numero == null || !faixa || faixa.atencao == null || faixa.critico == null) return null;
    if (numero >= Number(faixa.critico)) return 'critico';
    if (numero >= Number(faixa.atencao)) return 'atencao';
    return 'normal';
}

/* Sem entrada no gold (ou já marcado offline pela ETL) o servidor conta como
 * offline. Caso contrário, a pior situação entre cpu/ram/disco define o estado.
 */
function classificarServidor(servidorGold, limites) {
    if (!servidorGold || servidorGold.conexao === 'offline') return 'offline';

    var atual = servidorGold.atual || {};
    var situacao = 'normal';
    ['cpu', 'ram', 'disco'].forEach(function (recurso) {
        var estado = classificarValor(atual[recurso], limites[recurso]);
        if (estado && ORDEM_SITUACAO[estado] < ORDEM_SITUACAO[situacao]) situacao = estado;
    });
    return situacao;
}

function seriesVazias() {
    var vazia = function () { return { rotulos: [], valores: [] }; };
    return { '7d': vazia(), '30d': vazia() };
}

function normalizarDisponibilidade(frota) {
    var series = seriesVazias();
    if (!frota || typeof frota !== 'object') return series;
    ['7d', '30d'].forEach(function (janela) {
        var serie = frota[janela] || {};
        series[janela] = {
            rotulos: Array.isArray(serie.rotulos) ? serie.rotulos : [],
            valores: Array.isArray(serie.valores) ? serie.valores.map(numeroOuNull) : []
        };
    });
    return series;
}

/* Monta a resposta final: empresa sempre vem da sessão, saúde é calculada com
 * todos os servidores ativos visíveis e o gold só fornece leituras/série.
 */
async function montar(usuario) {
    var idEmpresa = Number(usuario.empresa);
    var gold = await lerGold(idEmpresa);

    var [servidoresBanco, limitesPorServidor, limitesLinhas] = await Promise.all([
        buscarServidoresPermitidos(usuario),
        buscarLimitesPorServidor(idEmpresa),
        servidorModel.listarLimitesGlobais(idEmpresa)
    ]);

    var limitesEmpresa = {};
    (limitesLinhas || []).forEach(function (linha) {
        var tipo = String(linha.tipo || '').toLowerCase();
        if (!LIMITES_PADRAO[tipo]) return;
        limitesEmpresa[tipo] = {
            atencao: numeroOuNull(linha.limite_atencao),
            critico: numeroOuNull(linha.limite_critico)
        };
    });

    var goldPorServidor = new Map(
        (Array.isArray(gold.servidores) ? gold.servidores : []).map(function (servidor) {
            return [Number(servidor.id_servidor), servidor];
        })
    );

    var saude = { total: 0, normais: 0, atencao: 0, critico: 0, offline: 0, pct_saudavel: null };
    var situacaoPorServidor = new Map();
    servidoresBanco.forEach(function (servidor) {
        var id = Number(servidor.id_servidor);
        var limites = Object.assign({}, LIMITES_PADRAO, limitesEmpresa, limitesPorServidor[id] || {});
        var situacao = classificarServidor(goldPorServidor.get(id), limites);

        situacaoPorServidor.set(id, situacao);
        saude.total += 1;
        if (situacao === 'normal') saude.normais += 1;
        else saude[situacao] += 1;
    });
    saude.pct_saudavel = saude.total ? Math.round((saude.normais / saude.total) * 100) : null;

    // Reaproveita nome/situação já calculados acima; incidentes e filtro de
    // empresa/servidores vêm do serviço Jira compartilhado com /incidentes.
    var ranking = [];
    try {
        var servidoresParaRanking = servidoresBanco.map(function (servidor) {
            var id = Number(servidor.id_servidor);
            return {
                id_servidor: id,
                nome: servidor.nome,
                situacao: situacaoPorServidor.get(id) || 'normal'
            };
        });
        var dadosJira = await jiraDashGeral.obterDadosJiraEmpresa({
            idEmpresa: idEmpresa,
            servidoresVisiveis: servidoresParaRanking
        });
        ranking = Array.isArray(dadosJira.ranking_problematicos) ? dadosJira.ranking_problematicos : [];
    } catch (erro) {
        console.warn('[dash-geral] falha ao carregar ranking do Jira; mantendo ranking vazio', erro && erro.name);
    }

    return {
        versao: 2,
        id_empresa: idEmpresa,
        gerado_em: gold.gerado_em || null,
        saude_frota: saude,
        disponibilidade_frota: normalizarDisponibilidade(gold.disponibilidade_frota),
        ranking_problematicos: ranking
    };
}

module.exports = { montar, lerGold, buscarServidoresPermitidos };
