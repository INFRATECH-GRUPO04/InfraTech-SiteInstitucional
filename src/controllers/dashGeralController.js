/*
 * Controller da Dashboard Geral: a empresa vem sempre da sessão e a equipe
 * interna não acessa dashboards de clientes.
 */
var dashGeralModel = require("../models/dashGeralModel");

var CARGOS_INTERNOS = ['ADMIN', 'INFRATECH'];

function obter(req, res) {
    var usuario = req.usuario || {};
    var cargo = String(usuario.cargo || '').toUpperCase();
    var idEmpresa = Number(usuario.empresa);

    if (CARGOS_INTERNOS.includes(cargo)) {
        return res.status(403).json({ erro: 'A equipe interna não acessa dashboards de clientes.' });
    }
    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
        return res.status(403).json({ erro: 'Empresa da sessão inválida.' });
    }

    return dashGeralModel.montar(usuario).then(function (dados) {
        return res.status(200).json(dados);
    }).catch(function (erro) {
        console.error('[dash-geral] falha ao montar dashboard:', erro);
        if (erro && erro.codigo === 'GOLD_NAO_ENCONTRADO') {
            return res.status(404).json({ erro: 'Dados da dashboard geral ainda não disponíveis para esta empresa.' });
        }
        return res.status(503).json({ erro: 'Não foi possível carregar a dashboard geral.' });
    });
}

module.exports = { obter };
