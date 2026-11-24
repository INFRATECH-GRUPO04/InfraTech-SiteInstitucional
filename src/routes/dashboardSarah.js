var express = require("express");
var router = express.Router();

var dashboardSarahController = require("../controllers/dashboardSarahController");
var exigir = require("../seguranca/autorizacao").exigirPermissao;

router.get("/buscarNomeEmpresa/:id", function (req, res) {
  dashboardSarahController.buscarNomeEmpresa(req, res);
});

router.get("/buscarServidoresPorEmpresa/:idEmpresa/:idFuncionario", function (req, res) {
  dashboardSarahController.buscarServidoresPorEmpresa(req, res);
});

router.get("/servidores", exigir('monitorar'), function (req, res) {
  dashboardSarahController.servidores(req, res);
});

router.get("/historico/:idServidor", exigir('monitorar'), function (req, res) {
  dashboardSarahController.historico(req, res);
});

router.get("/resumo", exigir('monitorar'), function (req, res) {
  dashboardSarahController.resumo(req, res);
});

router.get("/teste-s3", exigir('monitorar'), function (req, res) {
  dashboardSarahController.testeS3(req, res);
});

router.get("/teste-s3-lista", exigir('monitorar'), function (req, res) {
  dashboardSarahController.testeS3Lista(req, res);
});

module.exports = router;
