var database = require("../database/config");

// Procura o servidor dono da chave (o hash é calculado no controller, em hexadecimal)
function buscarPorChave(hash) {
    var instrucaoSql = `
        SELECT s.id_servidor AS idServidor, s.fk_empresa AS idEmpresa, s.nome AS nomeServidor
        FROM servidor s
        JOIN empresa e ON e.id_empresa = s.fk_empresa
        WHERE s.chave_hash = ? AND s.status_sistema = 1 AND e.status_sistema = 1;
    `;
    return database.executar(instrucaoSql, [hash]);
}

// Guarda o momento do último envio (em UTC)
function registrarEnvio(idServidor) {
    var instrucaoSql = `UPDATE servidor SET dt_ultimo_envio = UTC_TIMESTAMP() WHERE id_servidor = ?;`;
    return database.executar(instrucaoSql, [idServidor]);
}

module.exports = {
    buscarPorChave,
    registrarEnvio
};
