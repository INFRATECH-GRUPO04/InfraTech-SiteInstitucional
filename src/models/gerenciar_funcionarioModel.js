var database = require("../database/config");

function buscarNomeEmpresa(id) {
  var instrucaoSql = `
    SELECT 
        idEmpresa,
        razaoSocial,
        nomeFantasia
    FROM empresa
    WHERE idEmpresa = ${id};`;
  return database.executar(instrucaoSql);
}

function buscarDadosUsuario(id) {
  var instrucaoSql = `
    SELECT 
        f.id_funcionario,
        f.nome,
        f.tipoAcesso,
        (SELECT COUNT(*) 
           FROM servidor_funcionario sf 
          WHERE sf.fk_funcionario = f.id_funcionario) AS qtdServidores
    FROM funcionario f
    WHERE f.fk_empresa = ${id};`;
  return database.executar(instrucaoSql);
}

function buscarDadosUsuarioEspecifico(id) {
  var instrucaoSql = `
    SELECT 
        f.id_funcionario,
        f.tipoAcesso,
        f.nome,
        DATE_FORMAT(f.dataNascimento, '%d/%m/%Y') AS dataNascimento,
        f.email,
        f.senha,
        f.cpf,
        (SELECT COUNT(*) 
           FROM servidor_funcionario sf 
          WHERE sf.fk_funcionario = f.id_funcionario) AS qtdServidores
    FROM funcionario f
    WHERE f.id_funcionario = ${id};`;
  return database.executar(instrucaoSql);
}

function deletarUsuario(id) {
  var apagarVinculos = `DELETE FROM servidor_funcionario WHERE fk_funcionario = ${id};`;
  var apagarFuncionario = `DELETE FROM funcionario WHERE id_funcionario = ${id};`;
  
  return database.executar(apagarVinculos).then(function () {
    return database.executar(apagarFuncionario);
  });
}

function buscarServidoresPorEmpresa(idEmpresa, idFuncionario) {
  var instrucaoSql = `
    SELECT 
        s.idServidor,
        s.nome,
        s.status_sistema,
        (sf.fk_funcionario IS NOT NULL) AS temAcesso
    FROM servidor s
    LEFT JOIN servidor_funcionario sf 
           ON sf.fkServidor = s.idServidor
          AND sf.fk_funcionario = ${idFuncionario}
    WHERE s.fk_empresa = ${idEmpresa};`;
  return database.executar(instrucaoSql);
}

function alterarServidores(idFuncionario, servidores) {
  var apagar = `DELETE FROM servidor_funcionario WHERE fk_funcionario = ${idFuncionario};`;

  return database.executar(apagar).then(function () {
    if (servidores.length === 0) {
      return;   // nenhum marcado: só removeu os acessos
    }

    var valores = servidores
      .map(function (idServidor) {
        return `(${idFuncionario}, ${idServidor})`;
      })
      .join(", ");

    var inserir = `
      INSERT INTO servidor_funcionario (fk_funcionario, fkServidor)
      VALUES ${valores};`;
    return database.executar(inserir);
  });
}

module.exports = {
  buscarNomeEmpresa,
    buscarDadosUsuario,
    buscarDadosUsuarioEspecifico,
    deletarUsuario,
    buscarServidoresPorEmpresa,
    alterarServidores
  };
  