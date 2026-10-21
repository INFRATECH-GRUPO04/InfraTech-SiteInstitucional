var crypto = require('crypto');
var agenteModel = require("../models/agenteModel");

function buscarPorChave(req, res) {
  let codigo = req.body.codigoServer
  const hash = crypto.createHash('sha256').update(codigo).digest('hex');

  agenteModel.buscarPorChave(hash).then((resultado) => {
    if (resultado.length > 0) {
        res.status(200).json(resultado);
    } else {
        res.status(401).json(resultado);
    }
  }).catch((erro) => {
    console.log(erro);
    res.status(500).json(erro.sqlMessage);
  });
}

module.exports = {buscarPorChave};
