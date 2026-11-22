var express = require("express");
var router = express.Router();

var planejamentoController = require("../controllers/planejamentoController");
var permitir = require("../seguranca/autorizacao").exigirPermissao;

router.get("/", permitir('planejamento'), planejamentoController.obter);
router.put("/", permitir('planejamento'), planejamentoController.atualizar);
router.post("/relatorio", permitir('planejamento'), planejamentoController.gerarRelatorio);

module.exports = router;
