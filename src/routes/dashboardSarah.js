var express = require("express");
var router = express.Router();

var dashboardSarahController = require("../controllers/dashboardSarahController");

router.get("/buscarNomeEmpresa/:id", function (req, res) {
  dashboardSarahController.buscarNomeEmpresa(req, res);
});

router.get("/buscarServidoresPorEmpresa/:idEmpresa/:idUsuario", function (req, res) {
  dashboardSarahController.buscarServidoresPorEmpresa(req, res);
});

module.exports = router;
