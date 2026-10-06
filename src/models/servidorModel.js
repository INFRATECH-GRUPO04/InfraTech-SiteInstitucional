var database = require("../database/config")

function cadastrar(nome,idEmpresa) {
    console.log("ACESSEI O SERVIDOR MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente. \n\n function cadastrar():", nome);
    
    // Insira exatamente a query do banco aqui, lembrando da nomenclatura exata nos valores
    //  e na ordem de inserção dos dados.
    var instrucaoSql = `
        INSERT INTO servidor (nome, fk_empresa, status_sistema) VALUES ('${nome}', ${idEmpresa}, 1);
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

    function cadastrarComponente(fkServidor, tipoComponente, capacidade, limiteAtencao, limiteCritico) {
        console.log("ACESSEI O SERVIDOR MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente. \n\n function cadastrarComponente():", fkServidor, tipoComponente, capacidade);

        var inst1 = `INSERT INTO componente (tipo, capacidade_total, limite_atencao, limite_critico, fk_servidor_componente) VALUES('${tipoComponente}', ${capacidade}, ${limiteAtencao}, ${limiteCritico}, ${fkServidor});`;
        console.log("Executando a instrução SQL: \n" + inst1);
        return database.executar(inst1);
    }

    function listar(idEmpresa) {
        var instrucaoSql = `SELECT id_servidor, nome, status_sistema FROM servidor WHERE fk_empresa = ${idEmpresa};`;
        console.log("Executando a instrução SQL: \n" + instrucaoSql);
        return database.executar(instrucaoSql);
    }

    function listarComponentesPorServidor(idServidor) {
        var instrucaoSql = `
            SELECT 
                c.id_componente, c.tipo, c.capacidade_total,
                c.limite_atencao, c.limite_critico 
            FROM componente c
            WHERE c.fk_servidor_componente = ${idServidor};
        `;
        console.log("Executando a instrução SQL: \n" + instrucaoSql);
        return database.executar(instrucaoSql);
    }

    function atualizar(idServidor, nome) {
        var instrucaoSql = `UPDATE servidor SET nome = '${nome}' WHERE id_servidor = ${idServidor};`;
        console.log("Executando a instrução SQL: \n" + instrucaoSql);
        return database.executar(instrucaoSql);
    }

    function excluir(idServidor) {
        // Exclusão em cascata deve ser feita pelo backend se não houver ON DELETE CASCADE
        var inst3 = `DELETE FROM componente WHERE fk_servidor_componente = ${idServidor};`;
        return database.executar(inst3).then(function() {
            var inst4 = `DELETE FROM servidor_funcionario WHERE fk_servidor = ${idServidor};`;
            return database.executar(inst4).then(function() {
                var inst5 = `DELETE FROM servidor WHERE id_servidor = ${idServidor};`;
                return database.executar(inst5);
            });
        });
    }

module.exports = {
    cadastrar,
    cadastrarComponente,
    listar,
    listarComponentesPorServidor,
    atualizar,
    excluir
};