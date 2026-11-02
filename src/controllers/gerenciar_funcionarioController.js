/*
 * Este arquivo: Controla as consultas e ações da tela de funcionários, restringindo dados à empresa da sessão e validando alterações antes de chamar o model.
 */
var gerenciar_funcionarioModel = require("../models/gerenciar_funcionarioModel");

function buscarNomeEmpresa(req, res) {
  var id = req.usuario.empresa;

  gerenciar_funcionarioModel.buscarNomeEmpresa(id).then((resultado) => {
    res.status(200).json(resultado);
  }).catch((erro) => {
    console.log(erro);
    res.status(500).json(erro.sqlMessage);
  });
}

/* Lista os funcionários da empresa presente na sessão autenticada. O navegador
 * não escolhe livremente a empresa que será consultada.
 */
function buscarDadosUsuario(req, res) {
  var id = req.usuario.empresa;

  gerenciar_funcionarioModel.buscarDadosUsuario(id).then((resultado) => {
    res.status(200).json(resultado);
  }).catch((erro) => {
    console.log(erro);
    res.status(500).json(erro.sqlMessage);
  });
}

/* Busca um funcionário específico somente dentro da empresa do gestor conectado. */
function buscarDadosUsuarioEspecifico(req, res) {
  var id = req.params.id;

  gerenciar_funcionarioModel.buscarDadosUsuarioEspecifico(id, req.usuario.empresa).then((resultado) => {
    if (!resultado.length) return res.status(404).json({ erro: 'Funcionário não encontrado nesta empresa.' });
    res.status(200).json(resultado);
  }).catch((erro) => {
    console.log(erro);
    res.status(500).json(erro.sqlMessage);
  });
}

/* Confere se o alvo pode ser excluído e pede ao model que remova a conta e seus
 * vínculos dependentes, respeitando as proteções para contas de gestão.
 */
function deletarUsuario(req, res) {
  var id = req.params.id;
  
  gerenciar_funcionarioModel.deletarUsuario(id, req.usuario.empresa, req.usuario.id).then((resultado) => {
    if (!resultado.affectedRows) return res.status(403).json({ erro: 'Não é possível excluir este funcionário.' });
    res.status(200).json(resultado);
  }).catch((erro) => {
    console.log(erro);
    res.status(500).json(erro.sqlMessage);
  });
}
function desativarUsuario(req, res) {
  var idFuncionario = req.params.id;

  gerenciar_funcionarioModel.desativarUsuario(idFuncionario, req.usuario.empresa)
    .then((resultado) => res.status(200).json(resultado))
    .catch((erro) => {
      console.log(erro);
      res.status(500).json(erro.sqlMessage);
    });
}

function ativarUsuario(req, res) {
  var idFuncionario = req.params.id;

  gerenciar_funcionarioModel.ativarUsuario(idFuncionario, req.usuario.empresa)
    .then((resultado) => res.status(200).json(resultado))
    .catch((erro) => {
      console.log(erro);
      res.status(500).json(erro.sqlMessage);
    });
}

/* Valida a autorização solicitada e grava ou revoga a permissão individual para
 * o analista de dados poder editar limites na Dashboard Específica.
 */
function alterarPermissaoAlertas(req, res) {
  if (!['GESTOR', 'ADMIN', 'INFRATECH'].includes(req.usuario.cargo)) {
    return res.status(403).json({ erro: 'Somente gestão pode alterar esta permissão.' });
  }
  if (typeof req.body.podeEditarAlertas !== 'boolean') {
    return res.status(400).json({ erro: 'Informe se o funcionário pode editar limites de alerta.' });
  }
  gerenciar_funcionarioModel.alterarPermissaoAlertas(
    Number(req.params.id), req.usuario.empresa, req.body.podeEditarAlertas
  ).then((resultado) => {
    if (!resultado) return res.status(404).json({ erro: 'Analista de telemetria ativo não encontrado nesta empresa.' });
    res.status(200).json({ podeEditarAlertas: req.body.podeEditarAlertas });
  }).catch((erro) => {
    console.log(erro);
    res.status(500).json({ erro: 'Não foi possível salvar a permissão de edição.' });
  });
}

/* Encaminha a consulta dos vínculos entre funcionário e servidores da empresa. */
function buscarServidoresPorEmpresa(req, res) {
  var idEmpresa = req.usuario.empresa;
  var idFuncionario = Number(req.params.id);

  gerenciar_funcionarioModel.buscarServidoresPorEmpresa(idEmpresa, idFuncionario)
    .then((resultado) => res.status(200).json(resultado))
    .catch((erro) => {
      console.log(erro);
      res.status(500).json(erro.sqlMessage);
    });
}

/* Valida a lista de servidores enviada e atualiza os vínculos permitidos do funcionário. */
function alterarServidores(req, res) {
  var idFuncionario = Number(req.params.id);
  var idEmpresa = req.usuario.empresa;
  var entrada = req.body.servidores;
  if (!Array.isArray(entrada) || entrada.some(id => !Number.isInteger(Number(id)) || Number(id) <= 0)) {
    return res.status(400).json({ erro: 'Selecione uma lista válida de servidores.' });
  }
  var servidores = [...new Set(entrada.map(Number))];

  gerenciar_funcionarioModel.alterarServidores(idEmpresa, idFuncionario, servidores)
    .then(() => res.status(200).json({ mensagem: 'Acessos atualizados com sucesso.', quantidade: servidores.length }))
    .catch((erro) => {
      console.log(erro);
      res.status(erro.message && erro.message.includes('não pertencem') ? 400 : 500).json({ erro: erro.message || 'Não foi possível salvar os acessos.' });
    });
}


module.exports = {
  buscarNomeEmpresa,
    buscarDadosUsuario,
    buscarDadosUsuarioEspecifico,
    deletarUsuario,
    desativarUsuario,
    ativarUsuario,
    alterarPermissaoAlertas,
    buscarServidoresPorEmpresa,
    alterarServidores
};
