var database = require("../database/config");

function buscarNomeEmpresa(id) {
  var instrucaoSql = `
    SELECT 
        id_empresa,
        razao_social,
        nome_fantasia
    FROM empresa
    WHERE id_empresa = ${id};`;
  return database.executar(instrucaoSql);
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
    WHERE f.fk_empresa = ${id};`;
  return database.executar(instrucaoSql);
}

function buscarDadosUsuarioEspecifico(id) {
  var instrucaoSql = `
    SELECT 
        f.id_funcionario,
        f.tipo_acesso,
        f.nome,
        DATE_FORMAT(f.data_nascimento, '%d/%m/%Y') AS dataNascimento,
        f.email,
        f.senha,
        f.cpf,
        f.status_sistema,
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

function desativarUsuario(id) {
  var instrucaoSql = `
    UPDATE funcionario set status_sistema = 0
    WHERE id_funcionario = ${id};`;
  return database.executar(instrucaoSql);
}

function ativarUsuario(id) {
  var instrucaoSql = `
    UPDATE funcionario set status_sistema = 1
    WHERE id_funcionario = ${id};`;
  return database.executar(instrucaoSql);
}

function buscarServidoresPorEmpresa(idEmpresa, idFuncionario) {
  var instrucaoSql = `
    SELECT 
        s.id_servidor,
        s.nome,
        s.localizacao,
        s.status_sistema,
        (sf.fk_funcionario IS NOT NULL) AS temAcesso
    FROM servidor s
    LEFT JOIN servidor_funcionario sf 
           ON sf.fk_servidor = s.id_servidor
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
      INSERT INTO servidor_funcionario (fk_funcionario, fk_servidor)
      VALUES ${valores};`;
    return database.executar(inserir);
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
  