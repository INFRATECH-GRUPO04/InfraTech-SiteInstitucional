var database = require("../database/config")

function verificar(codigo) {
    console.log("ACESSEI O USUARIO MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente. \n\n function verificar(): ", codigo);
    var instrucaoSql = `
        SELECT codigo, fk_empresa AS fkEmpresa FROM convite WHERE codigo = ?;
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql, [codigo]);
}

function autenticar(email, senha) {
    var instrucaoSql = `
        SELECT id_funcionario AS idFuncionario, fk_empresa AS fkEmpresa, nome, data_nascimento AS dataNascimento, email, senha, cpf, tipo_acesso AS tipoAcesso, status_sistema AS statusSistema, dt_cadastro AS dtCadastro 
        FROM funcionario 
        WHERE email = ? AND senha = ? AND status_sistema = 1;
    `;
    return database.executar(instrucaoSql, [email, senha]);
}

function cadastrar(fkEmpresa, nome, data_nascimento, email, senha, cpf, tipoAcesso) {
    var tiposValidos = ['INFRATECH', 'GESTOR', 'ANALISTA_DADOS', 'ANALISTA_NOC', 'ADMIN', 'FUNCIONARIO'];
    var tipoFinal = tiposValidos.includes(tipoAcesso) ? tipoAcesso : 'ANALISTA_DADOS';
    var instrucaoSql = `
        INSERT INTO funcionario (fk_empresa, tipo_acesso, nome, data_nascimento, email, senha, cpf) 
        VALUES (?, ?, ?, ?, ?, ?, ?);
    `;
    return database.executar(instrucaoSql, [fkEmpresa, tipoFinal, nome, data_nascimento, email, senha, cpf]);
}

function EmailsIguais(email) {
    var instrucao = `SELECT email FROM funcionario WHERE email = ?;`;
    return database.executar(instrucao, [email]);
}

function CodigoEmpresa(codigo) {
    var instrucao = `
        SELECT id_convite, fk_empresa, tipo_acesso, quantidade_uso, quantidade_usada 
        FROM convite 
        WHERE codigo = ? AND quantidade_usada < quantidade_uso;
    `;
    return database.executar(instrucao, [codigo]);
}

function buscarConviteAtivoPorId(idConvite) {
    return database.executar(`SELECT id_convite, fk_empresa, tipo_acesso FROM convite WHERE id_convite = ? AND quantidade_usada < quantidade_uso;`, [Number(idConvite)]);
}



module.exports = {
    verificar,
    autenticar,
    cadastrar,
    EmailsIguais,
    CodigoEmpresa,
    buscarConviteAtivoPorId
};
