/*
 * Controller das rotas complementares da Dashboard Geral. Mantém a mesma regra
 * de empresa da sessão do controller principal. Incidentes usam os servidores
 * visíveis da sessão para filtrar o Jira.
 */

var dashComplementosModel = require("../models/dashComplementosModel");
var dashGeralModel = require("../models/dashGeralModel");

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

async function incidentes(req, res) {
    var idEmpresa = empresaDaSessao(req, res);
    if (idEmpresa == null) return;

    try {
        // A visibilidade é a mesma já usada pelo dashboard principal; nunca
        // aceitamos empresa/servidores vindos da URL ou do corpo da requisição.
        var servidores = await dashGeralModel.buscarServidoresPermitidos(req.usuario || {});
        var dados = await dashComplementosModel.incidentes({
            idEmpresa: idEmpresa,
            servidoresVisiveis: servidores
        });
        return res.status(200).json(dados);
    } catch (erro) {
        console.warn('[dash-geral] falha ao carregar servidores para incidentes; retornando stub vazio', erro && erro.name);
        return res.status(200).json(dashComplementosModel.incidentesVazios());
    }
}

module.exports = { incidentes };
