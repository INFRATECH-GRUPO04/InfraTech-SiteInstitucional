/*
 * Este arquivo: Define os endereços administrativos para listar empresas, consultar detalhes, editar dados e alterar o status de uma empresa.
 */
var express = require("express");
var router = express.Router();

var gerenciarEmpresaController = require("../controllers/gerenciarEmpresaController");

router.get("/listar", function (req, res) {
    gerenciarEmpresaController.listar(req, res);
});

router.get("/detalhes/:id", function (req, res) {
    gerenciarEmpresaController.detalhes(req, res);
});

router.put("/editar/:id", function (req, res) {
    gerenciarEmpresaController.editar(req, res);
});

router.put("/status/:id", function (req, res) {
    gerenciarEmpresaController.alterarStatus(req, res);
});

module.exports = router;
