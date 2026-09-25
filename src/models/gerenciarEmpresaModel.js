var mysql = require("mysql2");
var database = require("../database/config");

// Empresa interna (InfraTech Games Ltda)
var ID_EMPRESA_INTERNA = 1;

// mysql.escape coloca as aspas e trata caracteres especiais (ex.: apóstrofo em "D'Ávila Ltda"),
// então os valores de texto sempre entram na query já escapados.
var esc = mysql.escape;

// Campos de empresa + endereço, já com os nomes que o front usa
var CAMPOS_EMPRESA = `
    e.idEmpresa,
    e.razaoSocial,
    e.nomeFantasia,
    e.cnpj,
    e.segmento_atuacao AS segmentoAtuacao,
    e.email,
    e.telefone,
    e.status_sistema AS status,
    e.dtCadastro,
    e.fk_endereco AS fkEndereco,
    en.cep,
    en.logradouro,
    en.numero,
    en.complemento,
    en.bairro,
    en.cidade,
    en.estado`;

function listar() {
    console.log("ACESSEI O GERENCIAR EMPRESA MODEL \n function listar()");

    var instrucaoSql = `
        SELECT ${CAMPOS_EMPRESA}
        FROM empresa e
        LEFT JOIN endereco en ON en.id_endereco = e.fk_endereco
        WHERE e.idEmpresa <> ${ID_EMPRESA_INTERNA}
        ORDER BY e.nomeFantasia;
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function buscarPorId(idEmpresa) {
    console.log("ACESSEI O GERENCIAR EMPRESA MODEL \n function buscarPorId():", idEmpresa);

    var instrucaoSql = `
        SELECT ${CAMPOS_EMPRESA}
        FROM empresa e
        LEFT JOIN endereco en ON en.id_endereco = e.fk_endereco
        WHERE e.idEmpresa = ${Number(idEmpresa)};
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function buscarGestor(idEmpresa) {
    console.log("ACESSEI O GERENCIAR EMPRESA MODEL \n function buscarGestor():", idEmpresa);

    var instrucaoSql = `
        SELECT idFuncionario, nome, email, senha, cpf, status_sistema AS status, dtCadastro
        FROM funcionario
        WHERE fkEmpresa = ${Number(idEmpresa)} AND tipoAcesso = 'GESTOR'
        LIMIT 1;
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function contarVinculos(idEmpresa) {
    console.log("ACESSEI O GERENCIAR EMPRESA MODEL \n function contarVinculos():", idEmpresa);

    var id = Number(idEmpresa);
    var instrucaoSql = `
        SELECT
            (SELECT COUNT(*) FROM servidor WHERE fkEmpresa = ${id} AND status_sistema = 1) AS qtdServidores,
            (SELECT COUNT(*) FROM funcionario WHERE fkEmpresa = ${id} AND tipoAcesso = 'FUNCIONARIO' AND status_sistema = 1) AS qtdFuncionarios;
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function verificarCnpj(cnpj, idEmpresa) {
    var instrucaoSql = `
        SELECT idEmpresa FROM empresa WHERE cnpj = ${esc(cnpj)} AND idEmpresa <> ${Number(idEmpresa)};
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function verificarEmail(email, idEmpresa) {
    var instrucaoSql = `
        SELECT idEmpresa FROM empresa WHERE email = ${esc(email)} AND idEmpresa <> ${Number(idEmpresa)};
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function inserirEndereco(d) {
    console.log("ACESSEI O GERENCIAR EMPRESA MODEL \n function inserirEndereco()");

    var complemento = d.complemento ? esc(d.complemento) : "NULL";
    var instrucaoSql = `
        INSERT INTO endereco (cep, logradouro, bairro, numero, complemento, estado, cidade)
        VALUES (${esc(d.cep)}, ${esc(d.logradouro)}, ${esc(d.bairro)}, ${esc(d.numero)}, ${complemento}, ${esc(d.estado)}, ${esc(d.cidade)});
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function atualizarEndereco(idEndereco, d) {
    console.log("ACESSEI O GERENCIAR EMPRESA MODEL \n function atualizarEndereco():", idEndereco);

    var complemento = d.complemento ? esc(d.complemento) : "NULL";
    var instrucaoSql = `
        UPDATE endereco SET
            cep = ${esc(d.cep)},
            logradouro = ${esc(d.logradouro)},
            bairro = ${esc(d.bairro)},
            numero = ${esc(d.numero)},
            complemento = ${complemento},
            estado = ${esc(d.estado)},
            cidade = ${esc(d.cidade)}
        WHERE id_endereco = ${Number(idEndereco)};
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function atualizarEmpresa(idEmpresa, d, fkEndereco) {
    console.log("ACESSEI O GERENCIAR EMPRESA MODEL \n function atualizarEmpresa():", idEmpresa);

    var instrucaoSql = `
        UPDATE empresa SET
            razaoSocial = ${esc(d.razaoSocial)},
            nomeFantasia = ${esc(d.nomeFantasia)},
            cnpj = ${esc(d.cnpj)},
            segmento_atuacao = ${esc(d.segmentoAtuacao)},
            email = ${esc(d.email)},
            telefone = ${esc(d.telefone)},
            fk_endereco = ${Number(fkEndereco)}
        WHERE idEmpresa = ${Number(idEmpresa)} AND idEmpresa <> ${ID_EMPRESA_INTERNA};
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

// Desativar NÃO apaga nada: só muda o status no banco de dados. Funcionários, servidores e métricas continuam no banco.
function alterarStatus(idEmpresa, status) {
    console.log("ACESSEI O GERENCIAR EMPRESA MODEL \n function alterarStatus():", idEmpresa, status);

    var instrucaoSql = `
        UPDATE empresa SET status_sistema = ${Number(status)}
        WHERE idEmpresa = ${Number(idEmpresa)} AND idEmpresa <> ${ID_EMPRESA_INTERNA};
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

module.exports = {
    ID_EMPRESA_INTERNA,
    listar,
    buscarPorId,
    buscarGestor,
    contarVinculos,
    verificarCnpj,
    verificarEmail,
    inserirEndereco,
    atualizarEndereco,
    atualizarEmpresa,
    alterarStatus
};
