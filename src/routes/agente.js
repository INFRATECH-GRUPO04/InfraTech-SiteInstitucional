var express = require("express");
var router = express.Router();

var agenteController = require("../controllers/agenteController");

router.post("/autenticar", function (req, res) {
    agenteController.buscarPorChave(req, res)
})

// router.post("/enviar", function (req, res) {
//     agenteController
// })

module.exports = router;