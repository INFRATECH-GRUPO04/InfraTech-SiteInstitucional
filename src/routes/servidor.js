var express = require("express");
var router = express.Router();

var servidorController = require("../controllers/servidorController");

router.post("/cadastrar", function (req, res) {
    servidorController.cadastrar(req, res);
});

router.post("/cadastrar/componente", function (req, res) {
    servidorController.cadastrarComponente(req, res);
});

router.get("/listar/:idEmpresa", function (req, res) {
    servidorController.listar(req, res);
});

router.get("/listarComponentes/:idServidor", function (req, res) {
    servidorController.listarComponentesPorServidor(req, res);
});

router.put("/editar/:idServidor", function (req, res) {
    servidorController.atualizar(req, res);
});

router.put("/editar/componente/:idComponente", function (req, res) {
    servidorController.atualizarComponente(req, res);
});

router.delete("/deletar/:idServidor", function (req, res) {
    servidorController.excluir(req, res);
});

router.post("/atualizar-chave/:idServidor", function (req, res) {
    servidorController.atualizarChave(req, res);
});

module.exports = router;
