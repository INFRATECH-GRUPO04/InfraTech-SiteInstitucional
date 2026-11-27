/*
 * Este arquivo: Agrupa os endereços de consulta e gerenciamento de servidores de teste da empresa.
 */
var express = require("express");
var router = express.Router();

var { autenticar, permitirCargos } = require("../seguranca/autorizacao");
var servidorTesteController = require("../controllers/servidorTesteController");

router.get("/dadosDashboard", function (req, res) {
    servidorTesteController.obterDadosDashboard(req, res);
});

router.use(autenticar);
router.use(permitirCargos("ENGENHEIRO_QA", "ADMIN", "INFRATECH"));

router.get("/listarServidores", function (req, res) {
    servidorTesteController.listarServidores(req, res);
});

router.get("/listarServidoresTeste", function (req, res) {
    servidorTesteController.listarServidoresTeste(req, res);
});

router.put("/definirTeste/:id", function (req, res) {
    servidorTesteController.definirServidorTeste(req, res);
});

router.put("/removerTeste/:id", function (req, res) {
    servidorTesteController.removerServidorTeste(req, res);
});

module.exports = router;