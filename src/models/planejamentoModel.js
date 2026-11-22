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
            id_planejamento,
            fk_empresa,
            plano,
            jogadores,
            ticket_medio,
            orcamento_mensal,
            meta_uso,
            limite_subutilizado,
            crescimento_mensal,
            meses_provisionamento,
            capacidade_por_servidor,
            capacidade_novo_servidor,
            custo_novo_servidor,
            custo_implantacao,
            economia_infra_propria,
            dt_atualizacao
        FROM planejamento_financeiro
        WHERE fk_empresa = ?;
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
function atualizarPremissas(idEmpresa, dados) {
    var instrucaoSql = `
        UPDATE planejamento_financeiro
        SET
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
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql, [
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
