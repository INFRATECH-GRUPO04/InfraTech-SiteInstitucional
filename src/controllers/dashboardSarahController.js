/*
 * Este arquivo: Controla as consultas e ações da tela de funcionários, restringindo dados à empresa da sessão e validando alterações antes de chamar o model.
 */
var dashboardSarahModel = require("../models/dashboardSarahModel");

function buscarNomeEmpresa(req, res) {
  var id = req.usuario.empresa;

  dashboardSarahModel.buscarNomeEmpresa(id).then((resultado) => {
    res.status(200).json(resultado);
  }).catch((erro) => {
    console.log(erro);
    res.status(500).json(erro.sqlMessage);
  });
}

/* Encaminha a consulta dos vínculos entre funcionário e servidores da empresa. */
function buscarServidoresPorEmpresa(req, res) {
  var idEmpresa = req.params.idEmpresa;
  var idFuncionario = req.params.idFuncionario;

  dashboardSarahModel.buscarServidoresPorEmpresa(idEmpresa, idFuncionario)
    .then((resultado) => res.status(200).json(resultado))
    .catch((erro) => {
      console.log(erro);
      res.status(500).json(erro.sqlMessage || erro.message);
    });
}

module.exports = {
    buscarNomeEmpresa,
    buscarServidoresPorEmpresa
};
