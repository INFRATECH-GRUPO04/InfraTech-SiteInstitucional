/*
 * Rotas complementares da Dashboard Geral: incidentes passam a vir do Jira
 * (via serviço compartilhado com /dash-geral); o relatório de IA continua stub.
 * O contrato do front não muda, inclusive quando o Jira falha.
 */

var jiraDashGeral = require('../services/jiraDashGeral');

function incidentesVazios() {
    var vazio = jiraDashGeral.stub();
    return {
        abertos: vazio.abertos,
        por_dia: vazio.por_dia,
        mttr: vazio.mttr
    };
}

async function incidentes(contexto) {
    try {
        var dados = await jiraDashGeral.obterDadosJiraEmpresa(contexto);
        return {
            abertos: Array.isArray(dados.abertos) ? dados.abertos : [],
            por_dia: dados.por_dia || incidentesVazios().por_dia,
            mttr: dados.mttr || incidentesVazios().mttr
        };
    } catch (erro) {
        console.warn('[dash-geral] não foi possível carregar incidentes do Jira; retornando stub vazio', erro && erro.name);
        return incidentesVazios();
    }
}

function relatorioIA() {
    return {
        gerado_em: null,
        resumo: '',
        recomendacoes: []
    };
}

module.exports = { incidentes, incidentesVazios, relatorioIA };
