/*
 * Este arquivo: Expõe os endereços para consulta e cadastro de empresas. As rotas encaminham os dados recebidos ao controller, que valida e coordena o cadastro.
 */
var express = require("express");
var router = express.Router();

var empresaController = require("../controllers/cadastroEmpresaController");
var admin = require("../seguranca/autorizacao").autenticar;
var somenteAdmin = require("../seguranca/autorizacao").exigirPermissao('administrar');


router.post("/cadastrar", function (req, res) {
    empresaController.cadastrar(req, res);
})

router.get("/buscar", function (req, res) {
    admin(req, res, function () { somenteAdmin(req, res, function () { empresaController.buscarPorCnpj(req, res); }); });
});

router.get("/buscar/:id", function (req, res) {
  admin(req, res, function () { somenteAdmin(req, res, function () { empresaController.buscarPorId(req, res); }); });
});

router.get("/listar", function (req, res) {
  admin(req, res, function () { somenteAdmin(req, res, function () { empresaController.listar(req, res); }); });
});

module.exports = router;
