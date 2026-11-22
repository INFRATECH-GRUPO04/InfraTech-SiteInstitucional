/*
 * Concentra as consultas de planejamento financeiro: premissas da empresa,
 * servidores ativos com custo, histórico mensal e gestor responsável.
 */
var database = require("../database/config")

/* Busca as premissas financeiras da empresa, incluindo o responsável quando
 * houver um gestor vinculado. */
function buscarPlanejamento(idEmpresa) {
    var instrucaoSql = `
        SELECT
            pf.id_planejamento,
            pf.fk_empresa,
            pf.fk_gestor,
            f.nome AS nome_gestor,
            pf.plano,
            pf.jogadores,
            pf.ticket_medio,
            pf.orcamento_mensal,
            pf.meta_uso,
            pf.limite_subutilizado,
            pf.crescimento_mensal,
            pf.meses_provisionamento,
            pf.capacidade_por_servidor,
            pf.capacidade_novo_servidor,
            pf.custo_novo_servidor,
            pf.custo_implantacao,
            pf.economia_infra_propria,
            pf.dt_atualizacao
        FROM planejamento_financeiro pf
        LEFT JOIN funcionario f ON f.id_funcionario = pf.fk_gestor
        WHERE pf.fk_empresa = ?;
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql, [Number(idEmpresa)]);
}

/* Lista os servidores ativos da empresa com seus custos mensais, para compor
 * o custo total de infraestrutura da dashboard. */
function listarServidoresAtivos(idEmpresa) {
    var instrucaoSql = `
        SELECT id_servidor, nome, localizacao, status_sistema, custo_mensal
        FROM servidor
        WHERE fk_empresa = ? AND status_sistema = 1
        ORDER BY id_servidor;
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql, [Number(idEmpresa)]);
}

/* Busca o histórico mensal de custo de infraestrutura da empresa. */
function listarHistorico(idEmpresa) {
    var instrucaoSql = `
        SELECT mes_referencia, valor
        FROM custo_infra_historico
        WHERE fk_empresa = ?
        ORDER BY mes_referencia;
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql, [Number(idEmpresa)]);
}

/* Busca o nome do primeiro gestor ativo da empresa, usado para identificar
 * quem cadastrou as premissas quando não houver responsável vinculado. */
function buscarGestor(idEmpresa) {
    var instrucaoSql = `
        SELECT nome
        FROM funcionario
        WHERE fk_empresa = ? AND tipo_acesso = 'GESTOR' AND status_sistema = 1
        ORDER BY id_funcionario
        LIMIT 1;
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql, [Number(idEmpresa)]);
}

/* Atualiza as premissas de planejamento financeiro da empresa. */
function atualizarPremissas(idEmpresa, dados, idGestor) {
    var instrucaoSql = `
        UPDATE planejamento_financeiro
        SET
            fk_gestor = ?,
            capacidade_por_servidor = ?,
            capacidade_novo_servidor = ?,
            crescimento_mensal = ?,
            meses_provisionamento = ?,
            orcamento_mensal = ?,
            meta_uso = ?,
            limite_subutilizado = ?,
            custo_novo_servidor = ?,
            custo_implantacao = ?
        WHERE fk_empresa = ?;
    `;
    var gestorResponsavel = null;
    if (Number.isInteger(Number(idGestor)) && Number(idGestor) > 0) {
        gestorResponsavel = Number(idGestor);
    }
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql, [
        gestorResponsavel,
        Number(dados.capacidadeAtual),
        Number(dados.capacidadeNova),
        Number(dados.crescimento),
        Number(dados.provisionamento),
        Number(dados.orcamento),
        Number(dados.metaUso),
        Number(dados.limiteSubutilizado),
        Number(dados.custoNovoServidor),
        Number(dados.custoImplantacao),
        Number(idEmpresa)
    ]);
}

module.exports = {
    buscarPlanejamento,
    listarServidoresAtivos,
    listarHistorico,
    buscarGestor,
    atualizarPremissas
};
