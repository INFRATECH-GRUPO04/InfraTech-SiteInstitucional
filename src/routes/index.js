/*
 * Este arquivo: Define a rota inicial do site institucional e entrega ao navegador o arquivo HTML de entrada.
 */
var express = require("express");
var router = express.Router();

router.get("/", function (req, res) {
    res.sendFile(require("path").join(__dirname, "../../public/index.html"));
});

module.exports = router;
