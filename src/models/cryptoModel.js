var database = require("../database/config");

function gerarCodigo(codigo, permissao, quantidade, fkEmpresa) {
    var instrucaoSql = `INSERT INTO convite (codigo, tipoAcesso, quantidadeUso, fkEmpresa) VALUES ('${codigo}', '${permissao}', '${quantidade}', '${fkEmpresa}')`;
    console.log("Executando a instrução SQL de geração de código: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function buscarCodigo(codigo){
    var instrucaoSql = `SELECT idConvite, tipoAcesso, quantidadeUso, quantidadeUsada, fkEmpresa FROM convite WHERE codigo = '${codigo}';`;
    console.log("Executando a instrução SQL de geração de código: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function atualizarCodigo(id){
    var instrucaoSql = `UPDATE convite SET quantidadeUsada = quantidadeUsada + 1 WHERE idConvite = ${id} AND quantidadeUsada < quantidadeUso;`;
    console.log("Executando a instrução SQL de geração de código: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

module.exports = {
    gerarCodigo,
    buscarCodigo,
    atualizarCodigo
};
