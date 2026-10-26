var express = require("express");
var router = express.Router();

var agenteController = require("../controllers/agenteController");

router.post("/autenticar", agenteController.validarChave, agenteController.autenticar);

// express.text lê o corpo como texto (CSV); o limite padrão de 100 KB não serve
router.post("/enviar", agenteController.validarChave, express.text({ type: "text/csv", limit: "5mb" }), agenteController.enviar);

module.exports = router;