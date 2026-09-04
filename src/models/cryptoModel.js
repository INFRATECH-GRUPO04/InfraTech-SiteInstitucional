var database = require("../database/config");

function gerarCodigo(codigo, permissao, quantidade, fkEmpresa) {
    var instrucaoSql = `INSERT INTO convite (codigo, tipoAcesso, quantidade_uso, fkEmpresa) VALUES ('${codigo}', '${permissao}', '${quantidade}', '${fkEmpresa}')`;
    console.log("Executando a instrução SQL de geração de código: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

module.exports = {
    gerarCodigo
};
