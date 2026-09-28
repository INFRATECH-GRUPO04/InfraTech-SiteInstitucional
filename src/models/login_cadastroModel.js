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
        SELECT id_funcionario, fk_empresa, adm, nome, data_nascimento, email, senha, cpf, status_sistema, dt_cadastro FROM funcionario WHERE email = '${email}' AND senha = '${senha}';
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}


function cadastrar(fkEmpresa, nome, data_nascimento, email, senha, cpf) {
    console.log("ACESSEI O USUARIO MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente. \n\n function cadastrar():", nome, email, senha, cpf, fkEmpresa);

    var instrucaoSql = `
        INSERT INTO funcionario (fk_empresa, nome, data_nascimento, email, senha, cpf) VALUES ('${fkEmpresa}', '${nome}', '${data_nascimento}', '${email}', '${senha}', '${cpf}');`;
    console.log("Executando a instrução SQL de cadastro: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function EmailsIguais(email) {

    var instrucao = `SELECT email FROM funcionario WHERE email = '${email}';`;

    console.log("executando a instrução sql: \n" + instrucao);
    return database.executar(instrucao);
};

function CodigoEmpresa(codigo) {

    var instrucao = `SELECT fk_empresa FROM convite WHERE codigo = '${codigo}';`;

    console.log("executando a instrução sql: \n" + instrucao);
    return database.executar(instrucao);
};


module.exports = {
    verificar,
    autenticar,
    cadastrar,
    EmailsIguais,
    CodigoEmpresa
};