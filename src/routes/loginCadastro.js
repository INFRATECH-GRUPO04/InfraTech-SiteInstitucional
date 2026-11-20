/*
 * Este arquivo: Mapeia os endereços de login, sessão, saída, cadastro e validações auxiliares para as funções do controller de autenticação.
 */
var express = require("express");
var router = express.Router();

var loginCadastroController = require("../controllers/loginCadastroController.js");

router.post("/cadastrar", function (req, res) {

    console.log("/cadastrar");
    
    loginCadastroController.cadastrar(req, res);
})

router.post("/autenticar", function (req, res) {
    
    loginCadastroController.autenticar(req, res);
});

router.get("/sessao", function (req, res) {
    loginCadastroController.sessaoAtual(req, res);
});

router.post("/sair", function (req, res) {
    loginCadastroController.sair(req, res);
});

router.get("/verificar", function (req, res) {
    loginCadastroController.verificar(req, res);
});

router.post("/EmailsIguais", function (req, res) {
    loginCadastroController.EmailsIguais(req, res);
});

router.post("/CodigoEmpresa", function (req, res) {
    loginCadastroController.CodigoEmpresa(req, res);
});


module.exports = router;
