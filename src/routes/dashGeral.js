/*
 * Rota da Dashboard Geral. A autenticação é aplicada em app.js; aqui basta a
 * permissão de monitorar e a empresa já presente na sessão.
 */
var express = require("express");
var router = express.Router();
var permitir = require("../seguranca/autorizacao").exigirPermissao;
var dashGeralController = require("../controllers/dashGeralController");

router.get("/", permitir('monitorar'), dashGeralController.obter);

module.exports = router;
