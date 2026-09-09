var crypto = require("crypto");
var express = require("express");
var router = express.Router();


var cryptoController = require("../controllers/cryptoController");

router.post("/gerar", function (req, res) {
    cryptoController.gerarCodigo(req, res);
});

router.get("/buscar/:codigo", function (req, res){
    cryptoController.buscarCodigo(req, res);
})

router.put("/atualizar/:idConvite", function (req, res){
    cryptoController.atualizarCodigo(req, res);
})

module.exports = router;
