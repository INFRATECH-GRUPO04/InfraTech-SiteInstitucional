var database = require("../database/config");

function cadastrar(nome, idEmpresa) {
    console.log("ACESSEI O SERVIDOR MODEL - function cadastrar():", nome);
    var nomeSanitizado = (nome || '').replace(/'/g, "''");
    var instrucaoSql = `
        INSERT INTO servidor (nome, fk_empresa, status_sistema) VALUES ('${nomeSanitizado}', ${Number(idEmpresa)}, 1);
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function cadastrarComponente(fkServidor, tipoComponente, capacidade, limiteAtencao, limiteCritico) {
    console.log("ACESSEI O SERVIDOR MODEL - function cadastrarComponente():", fkServidor, tipoComponente, capacidade);

    var unidadeCapacidade = tipoComponente === 'cpu' ? 'Cores' : 'GB';
    var idServidorNum = Number(fkServidor);
    var capNum = Number(capacidade);
    var atencaoNum = Number(limiteAtencao);
    var criticoNum = Number(limiteCritico);

    // 1. Inserir componente com chave estrangeira correta (fk_servidor)
    var inst1 = `
        INSERT INTO componente (tipo, capacidade_total, unidade_capacidade, status_monitoramento, fk_servidor) 
        VALUES ('${tipoComponente}', ${capNum}, '${unidadeCapacidade}', 1, ${idServidorNum});
    `;
    console.log("Executando a instrução SQL: \n" + inst1);
    
    return database.executar(inst1).then(function(resultadoComponente) {
        var idComponente = resultadoComponente.insertId;
        
        // 2. Inserir limites de atenção e crítico na tabela metrica correspondente
        var instMetrica = `
            INSERT INTO metrica (fk_componente, nome, unidade, limite_atencao, limite_critico, status_monitoramento) 
            VALUES (${idComponente}, 'uso_percentual', '%', ${atencaoNum}, ${criticoNum}, 1);
        `;
        console.log("Executando a instrução SQL metrica: \n" + instMetrica);
        return database.executar(instMetrica).catch(function(errMetrica) {
            console.log("Aviso ao salvar metrica do componente:", errMetrica);
            return resultadoComponente;
        });
    });
}

function listar(idEmpresa) {
    // Retorna tanto id_servidor quanto idServidor para garantir compatibilidade com o front
    var instrucaoSql = `
        SELECT id_servidor AS idServidor, id_servidor, nome, status_sistema 
        FROM servidor 
        WHERE fk_empresa = ${Number(idEmpresa)};
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function listarComponentesPorServidor(idServidor) {
    // Relacionamento com tabela metrica via fk_componente e filtro por fk_servidor
    var instrucaoSql = `
        SELECT 
            c.id_componente, 
            c.tipo, 
            c.capacidade_total,
            c.unidade_capacidade,
            COALESCE(m.limite_atencao, 80) AS limite_atencao, 
            COALESCE(m.limite_critico, 90) AS limite_critico 
        FROM componente c
        LEFT JOIN metrica m ON m.fk_componente = c.id_componente
        WHERE c.fk_servidor = ${Number(idServidor)};
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function atualizar(idServidor, nome) {
    var nomeSanitizado = (nome || '').replace(/'/g, "''");
    var instrucaoSql = `UPDATE servidor SET nome = '${nomeSanitizado}' WHERE id_servidor = ${Number(idServidor)};`;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function atualizarComponente(idComponente, capacidade, limiteAtencao, limiteCritico) {
    var idCompNum = Number(idComponente);
    var capNum = Number(capacidade);
    var atencaoNum = Number(limiteAtencao);
    var criticoNum = Number(limiteCritico);

    var inst1 = `UPDATE componente SET capacidade_total = ${capNum} WHERE id_componente = ${idCompNum};`;
    var inst2 = `UPDATE metrica SET limite_atencao = ${atencaoNum}, limite_critico = ${criticoNum} WHERE fk_componente = ${idCompNum};`;
    
    return database.executar(inst1).then(function() {
        return database.executar(inst2).then(function(resMetrica) {
            if (resMetrica && resMetrica.affectedRows === 0) {
                var instInsertMetrica = `
                    INSERT INTO metrica (fk_componente, nome, unidade, limite_atencao, limite_critico, status_monitoramento)
                    VALUES (${idCompNum}, 'uso_percentual', '%', ${atencaoNum}, ${criticoNum}, 1);
                `;
                return database.executar(instInsertMetrica);
            }
            return resMetrica;
        }).catch(function(err) {
            console.log("Aviso ao atualizar metrica:", err);
        });
    });
}

function excluir(idServidor) {
    var idServidorNum = Number(idServidor);
    // Exclusão em cascata: metrica -> componente -> servidor_funcionario -> servidor
    var instMetricas = `
        DELETE m FROM metrica m 
        INNER JOIN componente c ON m.fk_componente = c.id_componente 
        WHERE c.fk_servidor = ${idServidorNum};
    `;
    return database.executar(instMetricas).catch(function(err) {
        console.log("Aviso ao excluir metricas:", err);
    }).then(function() {
        var instComponentes = `DELETE FROM componente WHERE fk_servidor = ${idServidorNum};`;
        return database.executar(instComponentes).then(function() {
            var instFuncionarios = `DELETE FROM servidor_funcionario WHERE fk_servidor = ${idServidorNum};`;
            return database.executar(instFuncionarios).catch(function(err) {
                console.log("Aviso ao excluir servidor_funcionario:", err);
            }).then(function() {
                var instServidor = `DELETE FROM servidor WHERE id_servidor = ${idServidorNum};`;
                return database.executar(instServidor);
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
    atualizarComponente,
    excluir
};