var database = require("../database/config")

function cadastrar(nome,idEmpresa) {
    console.log("ACESSEI O SERVIDOR MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente. \n\n function cadastrar():", nome);
    
    // Insira exatamente a query do banco aqui, lembrando da nomenclatura exata nos valores
    //  e na ordem de inserção dos dados.
    var instrucaoSql = `
        INSERT INTO servidor (nome, fkEmpresa, status_sistema) VALUES ('${nome}', ${idEmpresa}, 1);
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

    function cadastrarComponente(fkServidor, tipoComponente, capacidade, limiteAtencao, limiteCritico) {
        console.log("ACESSEI O SERVIDOR MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente. \n\n function cadastrarComponente():", fkServidor, tipoComponente, capacidade);

        var inst1 = `INSERT INTO componente (tipo, capacidade_total, fk_servidor_componente) VALUES('${tipoComponente}', ${capacidade}, ${fkServidor});`;
        console.log("Executando a instrução SQL 1: \n" + inst1);

        return database.executar(inst1).then(function(resultadoComponente) {
            var idComponente = resultadoComponente.insertId;
            var inst2 = `INSERT INTO parametro_monitoramento (limite_atencao, limite_critico, fk_servidor_parametro) VALUES(${limiteAtencao}, ${limiteCritico}, ${fkServidor});`;
            console.log("Executando a instrução SQL 2: \n" + inst2);

            return database.executar(inst2).then(function(resultadoParametro) {
                var idParametro = resultadoParametro.insertId;
                var inst3 = `INSERT INTO metrica (nome, fk_componente, fk_parametro_monitoramento) VALUES('Monitoramento ${tipoComponente}', ${idComponente}, ${idParametro});`;
                console.log("Executando a instrução SQL 3: \n" + inst3);

                return database.executar(inst3);
            });
        });
    }

    function listar(idEmpresa) {
        var instrucaoSql = `SELECT idServidor, nome, status_sistema FROM servidor WHERE fkEmpresa = ${idEmpresa};`;
        console.log("Executando a instrução SQL: \n" + instrucaoSql);
        return database.executar(instrucaoSql);
    }

    function listarComponentesPorServidor(idServidor) {
        var instrucaoSql = `
            SELECT 
                c.id_componente, c.tipo, c.capacidade_total,
                p.limite_atencao, p.limite_critico 
            FROM componente c
            JOIN metrica m ON m.fk_componente = c.id_componente
            JOIN parametro_monitoramento p ON m.fk_parametro_monitoramento = p.id_parametro_monitoramento
            WHERE c.fk_servidor_componente = ${idServidor};
        `;
        console.log("Executando a instrução SQL: \n" + instrucaoSql);
        return database.executar(instrucaoSql);
    }

    function atualizar(idServidor, nome) {
        var instrucaoSql = `UPDATE servidor SET nome = '${nome}' WHERE idServidor = ${idServidor};`;
        console.log("Executando a instrução SQL: \n" + instrucaoSql);
        return database.executar(instrucaoSql);
    }

    function excluir(idServidor) {
        // Exclusão em cascata deve ser feita pelo backend se não houver ON DELETE CASCADE
        // No SQL do Infratech não tem CASCADE, então precisamos deletar as métricas, parametros e componentes antes.
        var inst1 = `DELETE FROM metrica WHERE fk_componente IN (SELECT id_componente FROM componente WHERE fk_servidor_componente = ${idServidor});`;
        return database.executar(inst1).then(function() {
            var inst2 = `DELETE FROM parametro_monitoramento WHERE fk_servidor_parametro = ${idServidor};`;
            return database.executar(inst2).then(function() {
                var inst3 = `DELETE FROM componente WHERE fk_servidor_componente = ${idServidor};`;
                return database.executar(inst3).then(function() {
                    var inst4 = `DELETE FROM servidor_funcionario WHERE fkServidor = ${idServidor};`;
                    return database.executar(inst4).then(function() {
                        var inst5 = `DELETE FROM servidor WHERE idServidor = ${idServidor};`;
                        return database.executar(inst5);
                    });
                });
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