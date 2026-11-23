/*
 * Este arquivo: Concentra as consultas de funcionários e seus vínculos. As operações administrativas recebem a empresa da sessão para limitar o escopo dos dados.
 */
var database = require("../database/config");

function buscarNomeEmpresa(id) {
  var instrucaoSql = `
    SELECT
        id_empresa,
        razao_social,
        nome_fantasia
    FROM empresa
    WHERE id_empresa = id;`;
  return database.executar(instrucaoSql);
}

function buscarServidoresPorEmpresa(idEmpresa, idFuncionario) {
  var instrucaoSql = `
    SELECT
        s.id_servidor,
        s.nome,
        COALESCE(s.localizacao, 'Não informada') AS localizacao,
        s.status_sistema AS statusSistema,
        (sf.fk_funcionario IS NOT NULL) AS temAcesso
    FROM servidor s
    JOIN empresa e ON e.id_empresa = s.fk_empresa
    LEFT JOIN servidor_funcionario sf
           ON sf.fk_servidor = s.id_servidor
          AND sf.fk_funcionario = ${idFuncionario}
    WHERE s.fk_empresa = ${idEmpresa}
    ORDER BY s.nome;`;
  return database.executar(instrucaoSql);
}

module.exports = {
    buscarNomeEmpresa,
    buscarServidoresPorEmpresa
  };

