var express = require("express");
var router = express.Router();

var login_cadastroController = require("../controllers/login_cadastroController.js");

router.post("/cadastrar", function (req, res) {

    console.log("/cadastrar");
    
    login_cadastroController.cadastrar(req, res);
})

router.post("/autenticar", function (req, res) {
    
    login_cadastroController.autenticar(req, res);
});

router.get("/verificar", function (req, res) {
    login_cadastroController.verificar(req, res);
});

router.post("/EmailsIguais", function (req, res) {
    login_cadastroController.EmailsIguais(req, res);
});

router.post("/CodigoEmpresa", function (req, res) {
    login_cadastroController.CodigoEmpresa(req, res);
});


module.exports = router;