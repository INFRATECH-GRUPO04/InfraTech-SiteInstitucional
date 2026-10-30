var database = require("../database/config")

function cadastrar(nome, idEmpresa) {
    console.log("ACESSEI O SERVIDOR MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente. \n\n function cadastrar():", nome);
    
    var instrucaoSql = `
        INSERT INTO servidor (nome, fk_empresa, status_sistema) VALUES ('${nome}', ${idEmpresa}, 1);
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function cadastrarComponente(fkServidor, tipoComponente, capacidade, limiteAtencao, limiteCritico) {
    console.log("ACESSEI O SERVIDOR MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente. \n\n function cadastrarComponente():", fkServidor, tipoComponente, capacidade);

    var unidadeCapacidade = tipoComponente === 'cpu' ? 'Cores' : (tipoComponente === 'rede' ? 'Mbps' : 'GB');
    var inst1 = `INSERT INTO componente (tipo, capacidade_total, unidade_capacidade, fk_servidor, status_monitoramento) VALUES ('${tipoComponente}', ${capacidade}, '${unidadeCapacidade}', ${fkServidor}, 1);`;
    console.log("Executando a instrução SQL: \n" + inst1);

    return database.executar(inst1).then(function (resultadoComponente) {
        var idComponente = resultadoComponente.insertId;
        var inst2 = `INSERT INTO metrica (fk_componente, nome, unidade, limite_atencao, limite_critico, status_monitoramento) VALUES (${idComponente}, 'uso_percentual', '%', ${limiteAtencao}, ${limiteCritico}, 1);`;
        console.log("Executando a instrução SQL: \n" + inst2);
        return database.executar(inst2);
    });
}

function listar(idEmpresa) {
    var instrucaoSql = `SELECT id_servidor, nome, status_sistema FROM servidor WHERE fk_empresa = ${idEmpresa};`;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function listarComponentesPorServidor(idServidor) {
    var instrucaoSql = `
        SELECT 
            c.id_componente,
            c.tipo,
            c.capacidade_total,
            c.unidade_capacidade,
            m.id_metrica,
            m.limite_atencao,
            m.limite_critico 
        FROM componente c
        LEFT JOIN metrica m ON m.fk_componente = c.id_componente AND (m.nome = 'uso_percentual' OR (c.tipo = 'rede' AND m.nome = 'perda_pacotes'))
        WHERE c.fk_servidor = ${idServidor};
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

function servidorPertenceEmpresa(idServidor, idEmpresa) {
    return database.executar('SELECT id_servidor FROM servidor WHERE id_servidor = ? AND fk_empresa = ?', [Number(idServidor), Number(idEmpresa)]);
}

function atualizarChavePorEmpresa(idServidor, codigo, idEmpresa) {
    return database.executar('UPDATE servidor SET chave_hash = SHA2(?, 256) WHERE id_servidor = ? AND fk_empresa = ?', [codigo, Number(idServidor), Number(idEmpresa)]);
}

function componentePertenceEmpresa(idComponente, idEmpresa) {
    return database.executar('SELECT c.id_componente FROM componente c JOIN servidor s ON s.id_servidor = c.fk_servidor WHERE c.id_componente = ? AND s.fk_empresa = ?', [Number(idComponente), Number(idEmpresa)]);
}

function listarLimitesGlobais(idEmpresa) {
    var sql = `SELECT tipo, limite_atencao, limite_critico FROM limite_alerta_global WHERE fk_empresa = ${Number(idEmpresa)};`;
    return database.executar(sql);
}

function salvarLimitesGlobais(idEmpresa, limites) {
    var empresa = Number(idEmpresa);
    var recursos = ['cpu', 'ram', 'disco', 'rede'];
    var valores = recursos.map(function (tipo) {
        return `(${empresa}, '${tipo}', ${Number(limites[tipo].atencao)}, ${Number(limites[tipo].critico)})`;
    }).join(',');
    return database.executar(`INSERT INTO limite_alerta_global (fk_empresa, tipo, limite_atencao, limite_critico) VALUES ${valores} ON DUPLICATE KEY UPDATE limite_atencao = VALUES(limite_atencao), limite_critico = VALUES(limite_critico);`);
}

function atualizarLimitesComponenteEmpresa(idComponente, idEmpresa, idMetrica, limiteAtencao, limiteCritico) {
    return database.executar(
        `UPDATE metrica m JOIN componente c ON c.id_componente = m.fk_componente JOIN servidor s ON s.id_servidor = c.fk_servidor SET m.limite_atencao = ?, m.limite_critico = ? WHERE c.id_componente = ? AND m.id_metrica = ? AND s.fk_empresa = ?`,
        [Number(limiteAtencao), Number(limiteCritico), Number(idComponente), Number(idMetrica), Number(idEmpresa)]
    );
}

function buscarPorNomeEEmpresa(nome, idEmpresa) {
    var instrucaoSql = `SELECT id_servidor FROM servidor WHERE nome = '${nome}' AND fk_empresa = ${idEmpresa};`;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

    function atualizarChave(idServidor, codigo) {
        var instrucaoSql = `
            UPDATE servidor SET chave_hash = SHA2('${codigo}', 256) WHERE id_servidor = ${idServidor};
        `;
        console.log("Executando a instrução SQL: \n" + instrucaoSql);
        return database.executar(instrucaoSql);
    }

module.exports = {
    cadastrar,
    cadastrarComponente,
    buscarPorNomeEEmpresa,
    listar,
    listarComponentesPorServidor,
    servidorPertenceEmpresa,
    atualizarChavePorEmpresa,
    componentePertenceEmpresa,
    listarLimitesGlobais,
    salvarLimitesGlobais,
    atualizarLimitesComponenteEmpresa,
    atualizarChave
};
