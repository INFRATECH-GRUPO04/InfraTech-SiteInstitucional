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
function desativarUsuario(req, res) {
  var idFuncionario = req.params.id;

  gerenciar_funcionarioModel.desativarUsuario(idFuncionario)
    .then((resultado) => res.status(200).json(resultado))
    .catch((erro) => {
      console.log(erro);
      res.status(500).json(erro.sqlMessage);
    });
}

function ativarUsuario(req, res) {
  var idFuncionario = req.params.id;

  gerenciar_funcionarioModel.ativarUsuario(idFuncionario)
    .then((resultado) => res.status(200).json(resultado))
    .catch((erro) => {
      console.log(erro);
      res.status(500).json(erro.sqlMessage);
    });
}

function buscarServidoresPorEmpresa(req, res) {
  var idEmpresa = req.params.idEmpresa;
  var idFuncionario = req.params.idFuncionario;

  gerenciar_funcionarioModel.buscarServidoresPorEmpresa(idEmpresa, idFuncionario)
    .then((resultado) => res.status(200).json(resultado))
    .catch((erro) => {
      console.log(erro);
      res.status(500).json(erro.sqlMessage);
    });
}

function alterarServidores(req, res) {
  var idFuncionario = Number(req.params.id);
  var servidores = (req.body.servidores || []).map(Number);

  gerenciar_funcionarioModel.alterarServidores(idFuncionario, servidores)
    .then((resultado) => res.status(200).json(resultado))
    .catch((erro) => {
      console.log(erro);
      res.status(500).json(erro.sqlMessage);
    });
}


module.exports = {
  buscarNomeEmpresa,
    buscarDadosUsuario,
    buscarDadosUsuarioEspecifico,
    deletarUsuario,
    desativarUsuario,
    ativarUsuario,
    buscarServidoresPorEmpresa,
    alterarServidores
};
