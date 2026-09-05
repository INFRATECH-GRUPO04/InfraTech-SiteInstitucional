var crypto = require('crypto');
var cryptoModel = require("../models/cryptoModel");

function gerarCodigoToken() {
    let token_prot;
    const hex_verificacao = /^(?=.*[0-9])(?=.*[A-F])[0-9A-F]+$/;

    do {
        token_prot = crypto.randomBytes(3).toString('hex').toUpperCase();
    } while (!hex_verificacao.test(token_prot));
    
    return token_prot;
}



function gerarCodigo(req, res) {
  var qtd_funcionario = req.body.qtdServer;
  var perm_funcionario = req.body.permServer;
  var fkEmpresa = 1;

  var token_final = gerarCodigoToken();

  cryptoModel.gerarCodigo(token_final, perm_funcionario, qtd_funcionario, fkEmpresa)
              .then(
                  function (resultado) {
                      res.json(resultado);
                  }
              ).catch(
                  function (erro) {
                      console.log(erro);
                      console.log(
                          "\nHouve um erro ao realizar o cadastro do token! Erro: ",
                          erro.sqlMessage
                      );
                      res.status(500).json(erro.sqlMessage);
                  }
              );
}

module.exports = {
    gerarCodigo
};