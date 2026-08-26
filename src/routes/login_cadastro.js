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

module.exports = router;