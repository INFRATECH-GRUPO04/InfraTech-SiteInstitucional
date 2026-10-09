var database = require("../database/config")

function verificar(codigo) {
    console.log("ACESSEI O USUARIO MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente. \n\n function verificar(): ", codigo);
    var instrucaoSql = `
        SELECT codigo, fk_empresa AS fkEmpresa FROM convite WHERE codigo = '${codigo}';
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function autenticar(email, senha) {
    var instrucaoSql = `
        SELECT id_funcionario AS idFuncionario, fk_empresa AS fkEmpresa, nome, data_nascimento AS dataNascimento, email, senha, cpf, tipo_acesso AS tipoAcesso, status_sistema AS statusSistema, dt_cadastro AS dtCadastro 
        FROM funcionario 
        WHERE email = '${email}' AND senha = '${senha}';
    `;
    return database.executar(instrucaoSql);
}

function cadastrar(fkEmpresa, nome, data_nascimento, email, senha, cpf, tipoAcesso) {
    var tipoFinal = (tipoAcesso === 'ADMIN' || tipoAcesso === 'GESTOR') ? tipoAcesso : 'FUNCIONARIO';
    var instrucaoSql = `
        INSERT INTO funcionario (fk_empresa, tipo_acesso, nome, data_nascimento, email, senha, cpf) 
        VALUES ('${fkEmpresa}', '${tipoFinal}', '${nome}', '${data_nascimento}', '${email}', '${senha}', '${cpf}');
    `;
    return database.executar(instrucaoSql);
}

function EmailsIguais(email) {
    var instrucao = `SELECT email FROM funcionario WHERE email = '${email}';`;
    return database.executar(instrucao);
}

function CodigoEmpresa(codigo) {
    var instrucao = `
        SELECT id_convite, fk_empresa, tipo_acesso, quantidade_uso, quantidade_usada 
        FROM convite 
        WHERE codigo = '${codigo}' AND quantidade_usada < quantidade_uso;
    `;
    return database.executar(instrucao);
}



module.exports = {
    verificar,
    autenticar,
    cadastrar,
    EmailsIguais,
    CodigoEmpresa
};
