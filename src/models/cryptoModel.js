var database = require("../database/config");

function gerarCodigo(codigo, permissao, quantidade, fkEmpresa) {
    var instrucaoSql = `INSERT INTO convite (codigo, tipo_acesso, quantidade_uso, fk_empresa) VALUES (?, ?, ?, ?)`;
    return database.executar(instrucaoSql, [codigo, permissao, quantidade, fkEmpresa]);
}

function buscarCodigo(codigo){
    var instrucaoSql = `SELECT id_convite, tipo_acesso, quantidade_uso, quantidade_usada, fk_empresa FROM convite WHERE codigo = ?;`;
    return database.executar(instrucaoSql, [codigo]);
}

function atualizarCodigo(id){
    var instrucaoSql = `UPDATE convite SET quantidade_usada = quantidade_usada + 1 WHERE id_convite = ? AND quantidade_usada < quantidade_uso;`;
    return database.executar(instrucaoSql, [id]);
}

module.exports = {
    gerarCodigo,
    buscarCodigo,
    atualizarCodigo
};
