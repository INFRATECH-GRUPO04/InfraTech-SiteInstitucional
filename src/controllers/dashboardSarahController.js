/*
 * Este arquivo: Controla as consultas e ações da tela de funcionários, restringindo dados à empresa da sessão e validando alterações antes de chamar o model.
 */
var dashboardSarahModel = require("../models/dashboardSarahModel");
var servidorModel = require("../models/servidorModel");
var s3GoldModel = require("../models/s3GoldModel");

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

function servidoresAtivos(req) {
  var cargo = String(req.usuario.cargo || '').toUpperCase();
  var busca = ['GESTOR', 'ADMIN', 'INFRATECH'].includes(cargo)
    ? servidorModel.listar(req.usuario.empresa)
    : servidorModel.listarPorFuncionario(req.usuario.empresa, req.usuario.id);
  return busca.then(function (rows) {
    return rows.filter(function (servidor) { return Number(servidor.status_sistema) === 1; });
  });
}

function servidores(req, res) {
  servidoresAtivos(req).then(function (rows) {
    return rows.length ? res.status(200).json(rows) : res.status(204).send();
  }).catch(function (erro) {
    console.log(erro);
    res.status(500).json(erro.sqlMessage || erro.message);
  });
}

function historico(req, res) {
  var idServidor = Number(req.params.idServidor);
  var inicio = String(req.query.inicio || '');
  var fim = String(req.query.fim || '');
  var dataValida = function (valor) {
    return /^\d{4}-\d{2}-\d{2}$/.test(valor) && !isNaN(Date.parse(valor));
  };
  if (!Number.isInteger(idServidor) || idServidor <= 0 || !dataValida(inicio) || !dataValida(fim) || inicio > fim) {
    return res.status(400).json({ erro: 'Servidor ou intervalo inválido.' });
  }
  if ((Date.parse(fim) - Date.parse(inicio)) / 86400000 > 31) {
    return res.status(400).json({ erro: 'Intervalo máximo de 31 dias.' });
  }
  servidoresAtivos(req).then(function (permitidos) {
    var encontrado = permitidos.some(function (servidor) { return Number(servidor.id_servidor) === idServidor; });
    if (!encontrado) return res.status(403).json({ erro: 'Servidor fora da sua empresa ou do seu vínculo.' });
    return s3GoldModel.lerServidor(req.usuario.empresa, idServidor, inicio, fim);
  }).then(function (resultado) {
    if (res.headersSent) return;   // já respondeu 403
    return resultado && resultado.capturas.length
      ? res.status(200).json(resultado)
      : res.status(204).send();
  }).catch(function (erro) {
    console.log(erro);
    res.status(500).json({ erro: 'Falha ao ler o data lake.' });
  });
}

function resumo(req, res) {
  servidoresAtivos(req).then(function (rows) {
    return Promise.all(rows.map(function (servidor) {
      var id = Number(servidor.id_servidor);
      return s3GoldModel.ultimaLeitura(req.usuario.empresa, id).then(function (leitura) {
        return {
          idServidor: id,
          nome: servidor.nome,
          leitura: leitura
        };
      });
    }));
  }).then(function (lista) {
    return lista.length ? res.status(200).json(lista) : res.status(204).send();
  }).catch(function (erro) {
    console.log(erro);
    res.status(500).json({ erro: 'Falha ao ler o data lake.' });
  });
}

module.exports = {
    buscarNomeEmpresa,
    buscarServidoresPorEmpresa,
    servidores,
    historico,
    resumo
};
