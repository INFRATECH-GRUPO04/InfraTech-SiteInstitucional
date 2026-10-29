var express = require("express");
var router = express.Router();

var servidorController = require("../controllers/servidorController");
var permitir = require("../seguranca/autorizacao").exigirPermissao;

router.post("/cadastrar", permitir('administrar'), function (req, res) {
    servidorController.cadastrar(req, res);
});

router.post("/cadastrar/componente", permitir('administrar'), function (req, res) {
    servidorController.cadastrarComponente(req, res);
});

router.get("/listar/:idEmpresa", permitir('monitorar'), function (req, res) {
    servidorController.listar(req, res);
});

router.get("/listarComponentes/:idServidor", permitir('monitorar'), function (req, res) {
    servidorController.listarComponentesPorServidor(req, res);
});

router.get("/alertas/globais/:idEmpresa", permitir('monitorar'), servidorController.listarLimitesGlobais);
router.put("/alertas/globais/:idEmpresa", permitir('editarLimites'), servidorController.salvarLimitesGlobais);

router.put("/alertas/componentes/:idComponente", permitir('editarLimites'), function (req, res) {
    servidorController.atualizarLimitesComponente(req, res);
});

router.post("/atualizar-chave/:idServidor", permitir('administrar'), function (req, res) {
    servidorController.atualizarChave(req, res);
});

module.exports = router;
