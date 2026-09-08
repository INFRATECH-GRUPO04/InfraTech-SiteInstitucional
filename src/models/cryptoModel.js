var database = require("../database/config");

function gerarCodigo(codigo, permissao, quantidade, fkEmpresa) {
    var instrucaoSql = `INSERT INTO convite (codigo, tipoAcesso, quantidade_uso, fkEmpresa) VALUES ('${codigo}', '${permissao}', '${quantidade}', '${fkEmpresa}')`;
    console.log("Executando a instrução SQL de geração de código: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function buscarCodigo(codigo){
    var instrucaoSql = `SELECT idConvite, tipoAcesso, quantidade_uso, quantidade_usada FROM convite WHERE ${codigo} = codigo;')`;
    console.log("Executando a instrução SQL de geração de código: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function atualizarCodigo(id){
    var instrucaoSql = `UPDATE codigo SET quantidade_usada = quantidade_uso + 1 WHERE idConvite = ${id};`;
    console.log("Executando a instrução SQL de geração de código: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

module.exports = {
    gerarCodigo,
    buscarCodigo,
    atualizarCodigo
};
