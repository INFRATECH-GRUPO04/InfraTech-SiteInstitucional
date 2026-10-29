var express = require("express");
var router = express.Router();

var empresaController = require("../controllers/cadastro_empresaController");
var admin = require("../middleware/autorizacao").autenticar;
var somenteAdmin = require("../middleware/autorizacao").exigirPermissao('administrar');


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
