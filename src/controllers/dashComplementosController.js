/*
 * Controller das rotas complementares da Dashboard Geral. Mantém a mesma regra
 * de empresa da sessão do controller principal; hoje responde estruturas vazias.
 */
var dashComplementosModel = require("../models/dashComplementosModel");

var CARGOS_INTERNOS = ['ADMIN', 'INFRATECH'];

function empresaDaSessao(req, res) {
    var usuario = req.usuario || {};
    var cargo = String(usuario.cargo || '').toUpperCase();
    var idEmpresa = Number(usuario.empresa);

    if (CARGOS_INTERNOS.includes(cargo)) {
        res.status(403).json({ erro: 'A equipe interna não acessa dashboards de clientes.' });
        return null;
    }
    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
        res.status(403).json({ erro: 'Empresa da sessão inválida.' });
        return null;
    }
    return idEmpresa;
}

function incidentes(req, res) {
    if (empresaDaSessao(req, res) == null) return;
    return res.status(200).json(dashComplementosModel.incidentes());
}

function relatorioIA(req, res) {
    if (empresaDaSessao(req, res) == null) return;
    return res.status(200).json(dashComplementosModel.relatorioIA());
}

module.exports = { incidentes, relatorioIA };
