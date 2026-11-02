/*
 * Este arquivo: Concentra as consultas de servidores, componentes e limites de alerta, incluindo verificações de pertencimento à empresa.
 */
var database = require("../database/config")

/* Grava um servidor associado à empresa recebida do controller. */
function cadastrar(nome, idEmpresa) {
    console.log("ACESSEI O SERVIDOR MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente. \n\n function cadastrar():", nome);
    
    var instrucaoSql = `
        INSERT INTO servidor (nome, fk_empresa, status_sistema) VALUES ('${nome}', ${idEmpresa}, 1);
    `;
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

/* Cria o componente e, em seguida, sua métrica inicial com limites de atenção
 * e criticidade definidos no formulário de cadastro.
 */
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

/* Altera o nome com os dois identificadores no filtro para garantir que a
 * atualização nunca atravesse o limite da empresa autenticada.
 */
function atualizarPorEmpresa(idServidor, idEmpresa, nome) {
    return database.executar(
        'UPDATE servidor SET nome = ? WHERE id_servidor = ? AND fk_empresa = ?',
        [nome, Number(idServidor), Number(idEmpresa)]
    );
}

/* Atualiza a capacidade do componente e os limites da métrica associada. Cada
 * instrução confirma a empresa por meio do vínculo componente-servidor.
 */
function atualizarComponenteEmpresa(idComponente, idEmpresa, capacidade, idMetrica, limiteAtencao, limiteCritico) {
    return componentePertenceEmpresa(idComponente, idEmpresa).then(function (componentes) {
        if (!componentes.length) return null;
        return database.executar(
            `SELECT m.id_metrica FROM metrica m
             JOIN componente c ON c.id_componente = m.fk_componente
             JOIN servidor s ON s.id_servidor = c.fk_servidor
             WHERE m.id_metrica = ? AND c.id_componente = ? AND s.fk_empresa = ?`,
            [Number(idMetrica), Number(idComponente), Number(idEmpresa)]
        ).then(function (metricas) {
            if (!metricas.length) return null;
            return database.executar(
                `UPDATE componente c JOIN servidor s ON s.id_servidor = c.fk_servidor
                 SET c.capacidade_total = ?
                 WHERE c.id_componente = ? AND s.fk_empresa = ?`,
                [Number(capacidade), Number(idComponente), Number(idEmpresa)]
            ).then(function () {
                return database.executar(
                    `UPDATE metrica m JOIN componente c ON c.id_componente = m.fk_componente
                     JOIN servidor s ON s.id_servidor = c.fk_servidor
                     SET m.limite_atencao = ?, m.limite_critico = ?
                     WHERE c.id_componente = ? AND m.id_metrica = ? AND s.fk_empresa = ?`,
                    [Number(limiteAtencao), Number(limiteCritico), Number(idComponente), Number(idMetrica), Number(idEmpresa)]
                ).then(function () {
                    return true;
                });
            });
        });
    });
}

/* Remove dependências na ordem exigida pelas chaves estrangeiras. Antes de
 * qualquer remoção, confirma que o servidor pertence à empresa solicitante.
 */
function excluirPorEmpresa(idServidor, idEmpresa) {
    var servidor = Number(idServidor);
    var empresa = Number(idEmpresa);
    return servidorPertenceEmpresa(servidor, empresa).then(function (servidores) {
        if (!servidores.length) return null;
        return database.executar(
            `DELETE m FROM metrica m
             JOIN componente c ON c.id_componente = m.fk_componente
             JOIN servidor s ON s.id_servidor = c.fk_servidor
             WHERE s.id_servidor = ? AND s.fk_empresa = ?`, [servidor, empresa]
        ).then(function () {
            return database.executar(
                `DELETE c FROM componente c JOIN servidor s ON s.id_servidor = c.fk_servidor
                 WHERE s.id_servidor = ? AND s.fk_empresa = ?`, [servidor, empresa]
            );
        }).then(function () {
            return database.executar(
                `DELETE sf FROM servidor_funcionario sf JOIN servidor s ON s.id_servidor = sf.fk_servidor
                 WHERE s.id_servidor = ? AND s.fk_empresa = ?`, [servidor, empresa]
            );
        }).then(function () {
            return database.executar('DELETE FROM servidor WHERE id_servidor = ? AND fk_empresa = ?', [servidor, empresa]);
        });
    });
}

function atualizarChavePorEmpresa(idServidor, codigo, idEmpresa) {
    return database.executar('UPDATE servidor SET chave_hash = SHA2(?, 256) WHERE id_servidor = ? AND fk_empresa = ?', [codigo, Number(idServidor), Number(idEmpresa)]);
}

function componentePertenceEmpresa(idComponente, idEmpresa) {
    return database.executar('SELECT c.id_componente FROM componente c JOIN servidor s ON s.id_servidor = c.fk_servidor WHERE c.id_componente = ? AND s.fk_empresa = ?', [Number(idComponente), Number(idEmpresa)]);
}

/* Retorna os limites padrão de cada recurso configurados para a empresa. */
function listarLimitesGlobais(idEmpresa) {
    var sql = `SELECT tipo, limite_atencao, limite_critico FROM limite_alerta_global WHERE fk_empresa = ${Number(idEmpresa)};`;
    return database.executar(sql);
}

/* Grava ou atualiza as quatro faixas da empresa. A chave única por empresa e
 * recurso permite que a mesma operação crie ou substitua o valor existente.
 */
function salvarLimitesGlobais(idEmpresa, limites) {
    var empresa = Number(idEmpresa);
    var recursos = ['cpu', 'ram', 'disco', 'rede'];
    var valores = recursos.map(function (tipo) {
        return `(${empresa}, '${tipo}', ${Number(limites[tipo].atencao)}, ${Number(limites[tipo].critico)})`;
    }).join(',');
    return database.executar(`INSERT INTO limite_alerta_global (fk_empresa, tipo, limite_atencao, limite_critico) VALUES ${valores} ON DUPLICATE KEY UPDATE limite_atencao = VALUES(limite_atencao), limite_critico = VALUES(limite_critico);`);
}

/* Atualiza uma métrica individual somente quando o componente pertence a um
 * servidor da empresa autorizada.
 */
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
    atualizarPorEmpresa,
    atualizarComponenteEmpresa,
    excluirPorEmpresa,
    atualizarChavePorEmpresa,
    componentePertenceEmpresa,
    listarLimitesGlobais,
    salvarLimitesGlobais,
    atualizarLimitesComponenteEmpresa,
    atualizarChave
};
