var database = require("../database/config");

function buscarPorId(id) {
  var instrucaoSql = `SELECT * FROM empresa WHERE id_empresa = ${id}`;
  return database.executar(instrucaoSql);
}

function listar() {
  var instrucaoSql = `SELECT id_empresa AS id, razao_social, cnpj FROM empresa`;
  return database.executar(instrucaoSql);
}

function buscarPorCnpj(cnpj) {
  var instrucaoSql = `SELECT * FROM empresa WHERE cnpj = '${cnpj}'`;
  return database.executar(instrucaoSql);
}

function cadastrarEndereco(cep, logradouro, bairro, numero, complemento, estado, cidade) {
  var instrucaoSql = `
    INSERT INTO endereco (cep, logradouro, bairro, numero, complemento, estado, cidade) 
    VALUES ('${cep}', '${logradouro}', '${bairro}', '${numero}', '${complemento || ""}', '${estado}', '${cidade}');
  `;
  return database.executar(instrucaoSql);
}

function cadastrarEmpresa(razaoSocial, nomeFantasia, cnpj, segmento, emailEmpresa, telefoneEmpresa, fkEndereco) {
  var instrucaoSql = `
    INSERT INTO empresa (razao_social, nome_fantasia, cnpj, segmento_atuacao, email, telefone, status_sistema, dt_cadastro, fk_endereco) 
    VALUES ('${razaoSocial}', '${nomeFantasia || ""}', '${cnpj}', '${segmento}', '${emailEmpresa}', '${telefoneEmpresa}', 1, NOW(), ${fkEndereco});
  `;
  return database.executar(instrucaoSql);
}

function cadastrarRepresentante(fkEmpresa, nomeResponsavel, dtNascimentoResponsavel, emailResponsavel, senha, cpf) {
  var instrucaoSql = `
    INSERT INTO funcionario (fk_empresa, adm, nome, data_nascimento, email, senha, cpf, status_sistema, dt_cadastro) 
    VALUES (${fkEmpresa}, 1, '${nomeResponsavel}', '${dtNascimentoResponsavel}', '${emailResponsavel}', '${senha}', '${cpf}', 1, NOW());
  `;
  return database.executar(instrucaoSql);
}

module.exports = {
  buscarPorCnpj,
  buscarPorId,
  listar,
  cadastrarEndereco,
  cadastrarEmpresa,
  cadastrarRepresentante
};
