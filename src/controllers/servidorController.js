var servidorModel = require("../models/servidorModel");


function cadastrar(req, res) {
    // Crie uma variável que vá recuperar os valores do arquivo cadastro.html
    var nomeServidor = req.body.nomeServer;
    var localizacaoServidor = req.body.localizacaoServer;

    // Faça as validações dos valores
    if (nomeServidor == undefined) {
        res.status(400).send("Seu nome está undefined!");
    } else if (localizacaoServidor == undefined) {
        res.status(400).send("Seu email está undefined!");
    } else {

        // Passe os valores como parâmetro e vá para o arquivo usuarioModel.js
        servidorModel.cadastrar(nomeServidor, localizacaoServidor)
            .then(
                function (resultado) {
                    res.json(resultado);
                }
            ).catch(
                function (erro) {
                    console.log(erro);
                    console.log(
                        "\nHouve um erro ao realizar o cadastro! Erro: ",
                        erro.sqlMessage
                    );
                    res.status(500).json(erro.sqlMessage);
                }
            );
    }
}

module.exports = {
    cadastrar
}