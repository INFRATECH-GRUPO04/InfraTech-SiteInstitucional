var gerenciar_funcionarioModel = require("../models/gerenciar_funcionarioModel");

function buscarNomeEmpresa(req, res) {
  var id = req.params.id;

  gerenciar_funcionarioModel.buscarNomeEmpresa(id).then((resultado) => {
    res.status(200).json(resultado);
  }).catch((erro) => {
    console.log(erro);
    res.status(500).json(erro.sqlMessage);
  });
}

function buscarDadosUsuario(req, res) {
  var id = req.params.id;

  gerenciar_funcionarioModel.buscarDadosUsuario(id).then((resultado) => {
    res.status(200).json(resultado);
  }).catch((erro) => {
    console.log(erro);
    res.status(500).json(erro.sqlMessage);
  });
}

function buscarDadosUsuarioEspecifico(req, res) {
  var id = req.params.id;

  gerenciar_funcionarioModel.buscarDadosUsuarioEspecifico(id).then((resultado) => {
    res.status(200).json(resultado);
  }).catch((erro) => {
    console.log(erro);
    res.status(500).json(erro.sqlMessage);
  });
}

function deletarUsuario(req, res) {
  var id = req.params.id;
  
  gerenciar_funcionarioModel.deletarUsuario(id).then((resultado) => {
    res.status(200).json(resultado);
  }).catch((erro) => {
    console.log(erro);
    res.status(500).json(erro.sqlMessage);
  });
}

function buscarServidoresPorEmpresa(req, res) {
  var id = req.params.id;
  console.log("id do controller:", id)

  gerenciar_funcionarioModel.buscarServidoresPorEmpresa(id).then((resultado) => {
    res.status(200).json(resultado);
  }).catch((erro) => {
    console.log(erro);
    res.status(500).json(erro.sqlMessage);
  });
}

module.exports = {
  buscarNomeEmpresa,
    buscarDadosUsuario,
    buscarDadosUsuarioEspecifico,
    deletarUsuario,
    buscarServidoresPorEmpresa
};
