var express = require("express");
var router = express.Router();

var gerenciar_funcionarioController = require("../controllers/gerenciar_funcionarioController");


// router.post("/cadastrar", function (req, res) {
//     empresaController.cadastrar(req, res);
// })

router.get("/buscarNomeEmpresa/:id", function (req, res) {
  gerenciar_funcionarioController.buscarNomeEmpresa(req, res);
});

router.get("/buscarDadosUsuario/:id", function (req, res) {
  gerenciar_funcionarioController.buscarDadosUsuario(req, res);
});

router.get("/buscarDadosUsuarioEspecifico/:id", function (req, res) {
  gerenciar_funcionarioController.buscarDadosUsuarioEspecifico(req, res);
});

router.delete("/deletarUsuario/:id", function (req, res) {
  gerenciar_funcionarioController.deletarUsuario(req, res);
});

router.put("/desativarUsuario/:id", function (req, res) {
  gerenciar_funcionarioController.desativarUsuario(req, res);
});

router.put("/ativarUsuario/:id", function (req, res) {
  gerenciar_funcionarioController.ativarUsuario(req, res);
});

router.get("/buscarServidoresPorEmpresa/:idEmpresa/:idFuncionario", function (req, res) {
  gerenciar_funcionarioController.buscarServidoresPorEmpresa(req, res);
});

router.put("/alterarServidores/:id", function (req, res) {
  gerenciar_funcionarioController.alterarServidores(req, res);
});

module.exports = router;