/*
 * Este arquivo: Agrupa os endereços de consulta e administração de funcionários, incluindo a autorização individual para editar limites de alerta.
 */
var express = require("express");
var router = express.Router();

var gerenciarFuncionarioController = require("../controllers/gerenciarFuncionarioController");


// router.post("/cadastrar", function (req, res) {
//     empresaController.cadastrar(req, res);
// })

router.get("/buscarNomeEmpresa/:id", function (req, res) {
  gerenciarFuncionarioController.buscarNomeEmpresa(req, res);
});

router.get("/buscarDadosUsuario/:id", function (req, res) {
  gerenciarFuncionarioController.buscarDadosUsuario(req, res);
});

router.get("/buscarDadosUsuarioEspecifico/:id", function (req, res) {
  gerenciarFuncionarioController.buscarDadosUsuarioEspecifico(req, res);
});

router.delete("/deletarUsuario/:id", function (req, res) {
  gerenciarFuncionarioController.deletarUsuario(req, res);
});

router.put("/desativarUsuario/:id", function (req, res) {
  gerenciarFuncionarioController.desativarUsuario(req, res);
});

router.put("/ativarUsuario/:id", function (req, res) {
  gerenciarFuncionarioController.ativarUsuario(req, res);
});

router.put("/permissao-alertas/:id", function (req, res) {
  gerenciarFuncionarioController.alterarPermissaoAlertas(req, res);
});

router.get("/buscarServidoresPorEmpresa/:id", function (req, res) {
  gerenciarFuncionarioController.buscarServidoresPorEmpresa(req, res);
});

router.get("/buscarServidoresPorEmpresa/:idEmpresa/:id", function (req, res) {
  gerenciarFuncionarioController.buscarServidoresPorEmpresa(req, res);
});

router.put("/alterarServidores/:id", function (req, res) {
  gerenciarFuncionarioController.alterarServidores(req, res);
});

module.exports = router;
