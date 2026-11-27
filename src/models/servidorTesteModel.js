/*
- Este arquivo: Executa as consultas SQL de servidores padrão, servidores de teste
- e limites de componentes/métricas vinculados à empresa autenticada.
 */
var database = require("../database/config");

var COLUNA_TESTE = "servidor_teste";

/* Lista todos os servidores da empresa que ainda NÃO estão definidos como teste */
function listarServidores(idEmpresa) {
    var instrucaoSql = `
        SELECT
            s.id_servidor,
            s.nome,
            s.localizacao,
            s.status_sistema,
            s.${COLUNA_TESTE} AS servidorTeste
        FROM servidor s
        JOIN empresa e ON e.id_empresa = s.fk_empresa
        LEFT JOIN endereco en ON en.id_endereco = e.fk_endereco
        WHERE s.fk_empresa = ?
          AND COALESCE(s.${COLUNA_TESTE}, 0) = 0
        ORDER BY s.nome;`;

    return database.executar(instrucaoSql, [Number(idEmpresa)]);
}

/* Lista todos os servidores da empresa que ESTÃO definidos como teste */
function listarServidoresTeste(idEmpresa) {
    var instrucaoSql = `
        SELECT
            s.id_servidor,
            s.nome,
            s.localizacao,
            s.status_sistema,
            s.${COLUNA_TESTE} AS servidorTeste
        FROM servidor s
        JOIN empresa e ON e.id_empresa = s.fk_empresa
        LEFT JOIN endereco en ON en.id_endereco = e.fk_endereco
        WHERE s.fk_empresa = ?
          AND s.${COLUNA_TESTE} = 1
        ORDER BY s.nome;`;

    return database.executar(instrucaoSql, [Number(idEmpresa)]);
}

/* Lista os componentes e limites de alerta dos servidores de teste da empresa */
function listarLimitesServidoresTeste(idEmpresa) {
    var instrucaoSql = `
        SELECT
            s.id_servidor,
            LOWER(TRIM(c.tipo)) AS tipo_componente,
            c.capacidade_total,
            TRIM(c.unidade_capacidade) AS unidade_capacidade,
            LOWER(TRIM(m.nome)) AS nome_metrica,
            TRIM(m.unidade) AS unidade_metrica,
            m.limite_atencao,
            m.limite_critico
        FROM servidor s
        JOIN componente c
            ON c.fk_servidor = s.id_servidor
           AND c.status_monitoramento = 1
        JOIN metrica m
            ON m.fk_componente = c.id_componente
           AND m.status_monitoramento = 1
        WHERE s.fk_empresa = ?
          AND s.${COLUNA_TESTE} = 1
          AND (m.limite_atencao IS NOT NULL OR m.limite_critico IS NOT NULL)
        ORDER BY s.id_servidor, c.id_componente, m.id_metrica;`;

    return database.executar(instrucaoSql, [Number(idEmpresa)]);
}

/* Define o servidor selecionado como teste (1) e atualiza seu nome */
function definirServidorTeste(idServidor, idEmpresa, novoNome) {
    var instrucaoSql = `
        UPDATE servidor
        SET nome = ?,
            ${COLUNA_TESTE} = 1
        WHERE id_servidor = ?
          AND fk_empresa = ?;`;

    return database.executar(instrucaoSql, [novoNome, Number(idServidor), Number(idEmpresa)]);
}

/* Remove o servidor da função de teste (0) e atualiza seu nome */
function removerServidorTeste(idServidor, idEmpresa, novoNome) {
    var instrucaoSql = `
        UPDATE servidor
        SET nome = ?,
            ${COLUNA_TESTE} = 0
        WHERE id_servidor = ?
          AND fk_empresa = ?
          AND ${COLUNA_TESTE} = 1;`;

    return database.executar(instrucaoSql, [novoNome, Number(idServidor), Number(idEmpresa)]);
}

module.exports = {
    listarServidores,
    listarServidoresTeste,
    listarLimitesServidoresTeste,
    definirServidorTeste,
    removerServidorTeste
};