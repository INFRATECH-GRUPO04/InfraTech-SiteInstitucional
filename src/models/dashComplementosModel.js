/*
 * Estruturas vazias das rotas complementares da Dashboard Geral (incidentes e
 * relatório de IA). São o ponto único para trocar por Jira/IA quando essas
 * integrações forem implementadas, sem alterar o contrato consumido pelo front.
 */

function incidentes() {
    return {
        abertos: [],
        por_dia: {
            '7d': { rotulos: [], valores: [] },
            '30d': { rotulos: [], valores: [] }
        },
        mttr: { minutos: null, periodo: '(últimos 30d)', anterior_minutos: null }
    };
}

function relatorioIA() {
    return {
        gerado_em: null,
        resumo: '',
        recomendacoes: []
    };
}

module.exports = { incidentes, relatorioIA };
