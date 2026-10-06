var database = require("../database/config");

function gerarCodigo(codigo, permissao, quantidade, fkEmpresa) {
    var instrucaoSql = `INSERT INTO convite (codigo, tipo_acesso, quantidade_uso, fk_empresa) VALUES ('${codigo}', '${permissao}', '${quantidade}', '${fkEmpresa}')`;
    console.log("Executando a instrução SQL de geração de código: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function buscarCodigo(codigo){
    var instrucaoSql = `SELECT id_convite, tipo_acesso, quantidade_uso, quantidade_usada, fk_empresa FROM convite WHERE codigo = '${codigo}';`;
    console.log("Executando a instrução SQL de geração de código: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function atualizarCodigo(id){
    var instrucaoSql = `UPDATE convite SET quantidade_usada = quantidade_usada + 1 WHERE id_convite = ${id} AND quantidade_usada < quantidade_uso;`;
    console.log("Executando a instrução SQL de geração de código: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

module.exports = {
    gerarCodigo,
    buscarCodigo,
    atualizarCodigo
};
