var database = require("../database/config")

function verificar(codigo) {
    console.log("ACESSEI O USUARIO MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente. \n\n function verificar(): ", codigo);
    var instrucaoSql = `
        SELECT codigo, fkEmpresa FROM convite WHERE codigo = '${codigo}';
        `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function autenticar(email, senha) {
    console.log("ACESSEI O USUARIO MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente. \n\n function entrar(): ", email, senha)
    var instrucaoSql = `
        SELECT idFuncionario, nome, email, senha, fkEmpresa, tipoAcesso FROM funcionario WHERE email = '${email}' AND senha = '${senha}';
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}


function cadastrar(nome, email, senha, cpf, fkEmpresa) {
    console.log("ACESSEI O USUARIO MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente. \n\n function cadastrar():", nome, email, senha, cpf, fkEmpresa);
    
    var instrucaoSql = `
        INSERT INTO funcionario (nome, email, senha, cpf, fkEmpresa) VALUES ('${nome}', '${email}', '${senha}', '${cpf}', ${fkEmpresa});`;
    console.log("Executando a instrução SQL de cadastro: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

module.exports = {
    verificar,
    autenticar,
    cadastrar
};