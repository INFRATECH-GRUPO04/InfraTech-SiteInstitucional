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
                    var idServidor = resultado.insertId;
                    res.status(201).json({
                        idServidor: idServidor
                    });
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


function cadastrarComponente(req, res) {
    // Crie uma variável que vá recuperar os valores do arquivo cadastro.html
    var fkServidor = req.body.fkServidorServer;
    var fkComponente = req.body.fkComponenteServer;
    var capacidade = req.body.capacidadeServer;
    var limiteAlerta = req.body.limiteAlertaServer

    // Faça as validações dos valores
    if (fkServidor == undefined) {
        res.status(400).send("Seu fk está undefined!");
    } else if (fkComponente == undefined) {
        res.status(400).send("Seu fkComponente está undefined!");
    } else if (capacidade == undefined) {
        res.status(400).send("Sua capacidade está undefined!");
    } else if (limiteAlerta == undefined) {
        res.status(400).send("Seu limite de alerta está undefined!");
    } else {

        // Passe os valores como parâmetro e vá para o arquivo usuarioModel.js
        servidorModel.cadastrarComponente(fkServidor, fkComponente, capacidade, limiteAlerta)
            .then(
                function (resultado) {
                    
                    res.status(201).json(resultado);
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
    cadastrar,
    cadastrarComponente
}