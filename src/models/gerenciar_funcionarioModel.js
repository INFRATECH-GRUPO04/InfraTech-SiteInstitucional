var database = require("../database/config");

function buscarNomeEmpresa(id) {
  var instrucaoSql = `
    SELECT
        id_empresa,
        razao_social,
        nome_fantasia
    FROM empresa
    WHERE id_empresa = ?;`;
  return database.executar(instrucaoSql, [Number(id)]);
}

function buscarDadosUsuario(id) {
  var instrucaoSql = `
    SELECT
        f.id_funcionario,
        f.nome,
        f.tipo_acesso,
        f.status_sistema,
        (SELECT COUNT(*)
           FROM servidor_funcionario sf
          WHERE sf.fk_funcionario = f.id_funcionario) AS qtdServidores
    FROM funcionario f
    WHERE f.fk_empresa = ? ORDER BY f.nome;`;
  return database.executar(instrucaoSql, [Number(id)]);
}

function buscarDadosUsuarioEspecifico(id, idEmpresa) {
  var instrucaoSql = `
    SELECT
        f.id_funcionario,
        f.tipo_acesso,
        f.nome,
        DATE_FORMAT(f.data_nascimento, '%d/%m/%Y') AS dataNascimento,
        f.email,
        f.cpf,
        f.status_sistema,
        (SELECT COUNT(*)
           FROM servidor_funcionario sf
          WHERE sf.fk_funcionario = f.id_funcionario) AS qtdServidores
    FROM funcionario f
    WHERE f.id_funcionario = ? AND f.fk_empresa = ?;`;
  return database.executar(instrucaoSql, [Number(id), Number(idEmpresa)]);
}

function deletarUsuario(id, idEmpresa, idGestor) {
  var apagarVinculos = `DELETE sf FROM servidor_funcionario sf
    JOIN funcionario f ON f.id_funcionario = sf.fk_funcionario
    WHERE f.id_funcionario = ? AND f.fk_empresa = ? AND f.id_funcionario <> ? AND f.tipo_acesso NOT IN ('GESTOR', 'ADMIN');`;
  var apagarFuncionario = `DELETE FROM funcionario WHERE id_funcionario = ? AND fk_empresa = ? AND id_funcionario <> ? AND tipo_acesso NOT IN ('GESTOR', 'ADMIN');`;

  return database.executar(apagarVinculos, [Number(id), Number(idEmpresa), Number(idGestor)]).then(function () {
    return database.executar(apagarFuncionario, [Number(id), Number(idEmpresa), Number(idGestor)]);
  });
}

function desativarUsuario(id, idEmpresa) {
  var instrucaoSql = `
    UPDATE funcionario set status_sistema = 0
    WHERE id_funcionario = ? AND fk_empresa = ?;`;
  return database.executar(instrucaoSql, [Number(id), Number(idEmpresa)]);
}

function ativarUsuario(id, idEmpresa) {
  var instrucaoSql = `
    UPDATE funcionario set status_sistema = 1
    WHERE id_funcionario = ? AND fk_empresa = ?;`;
  return database.executar(instrucaoSql, [Number(id), Number(idEmpresa)]);
}

function buscarServidoresPorEmpresa(idEmpresa, idFuncionario) {
  var instrucaoSql = `
    SELECT
        s.id_servidor,
        s.nome,
        en.cidade AS localizacao,
        s.status_sistema,
        (sf.fk_funcionario IS NOT NULL) AS temAcesso
    FROM servidor s
    JOIN empresa e ON e.id_empresa = s.fk_empresa
    LEFT JOIN endereco en ON en.id_endereco = e.fk_endereco
    LEFT JOIN servidor_funcionario sf
           ON sf.fk_servidor = s.id_servidor
          AND sf.fk_funcionario = ${idFuncionario}
    WHERE s.fk_empresa = ?
      AND EXISTS (SELECT 1 FROM funcionario f WHERE f.id_funcionario = ? AND f.fk_empresa = s.fk_empresa)
    ORDER BY s.nome;`;
  return database.executar(instrucaoSql, [Number(idEmpresa), Number(idFuncionario)]);
}

function validarServidoresDaEmpresa(idEmpresa, servidores) {
  if (!servidores.length) return Promise.resolve([]);
  return database.executar(
    `SELECT id_servidor FROM servidor WHERE fk_empresa = ? AND id_servidor IN (${servidores.map(() => '?').join(',')})`,
    [Number(idEmpresa), ...servidores]
  );
}

function alterarServidores(idEmpresa, idFuncionario, servidores) {
  return validarServidoresDaEmpresa(idEmpresa, servidores).then(function (validos) {
    if (validos.length !== servidores.length) throw new Error('Um ou mais servidores não pertencem à empresa.');
    return database.executar(
      'DELETE sf FROM servidor_funcionario sf JOIN funcionario f ON f.id_funcionario = sf.fk_funcionario WHERE sf.fk_funcionario = ? AND f.fk_empresa = ?',
      [Number(idFuncionario), Number(idEmpresa)]
    ).then(function () {
      if (!servidores.length) return;
      var placeholders = servidores.map(() => '(?, ?)').join(',');
      var valores = servidores.flatMap(idServidor => [Number(idFuncionario), idServidor]);
      return database.executar(`INSERT INTO servidor_funcionario (fk_funcionario, fk_servidor) VALUES ${placeholders}`, valores);
    });
  });
}

module.exports = {
  buscarNomeEmpresa,
    buscarDadosUsuario,
    buscarDadosUsuarioEspecifico,
    deletarUsuario,
    desativarUsuario,
    ativarUsuario,
    buscarServidoresPorEmpresa,
    alterarServidores
  };

