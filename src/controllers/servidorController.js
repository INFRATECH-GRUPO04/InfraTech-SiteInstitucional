var servidorModel = require("../models/servidorModel");


function cadastrar(req, res) {
    // Crie uma variável que vá recuperar os valores do arquivo cadastro.html
    var nomeServidor = req.body.nomeServer;
    var idEmpresa = req.body.idEmpresaServer;

    // Faça as validações dos valores
    if (nomeServidor == undefined) {
        res.status(400).send("Seu nome está undefined!");
    } else {

        // Passe os valores como parâmetro e vá para o arquivo usuarioModel.js
        servidorModel.cadastrar(nomeServidor,idEmpresa)
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
    var fkServidor = req.body.fkServidorServer;
    var fkComponente = req.body.fkComponenteServer; // Recebido como 1, 2, 3
    var capacidade = req.body.capacidadeServer;
    var limiteAtencao = req.body.limiteAtencaoServer;
    var limiteCritico = req.body.limiteCriticoServer;

    if (fkServidor == undefined) {
        res.status(400).send("Seu fk está undefined!");
    } else if (fkComponente == undefined) {
        res.status(400).send("Seu fkComponente está undefined!");
    } else if (capacidade == undefined) {
        res.status(400).send("Sua capacidade está undefined!");
    } else if (limiteAtencao == undefined || limiteCritico == undefined) {
        res.status(400).send("Os limites de alerta estão undefined!");
    } else {
        // Mapear fkComponente (1,2,3) para tipo string ('cpu', 'ram', 'disco')
        var tipoComponente = "cpu";
        if(fkComponente == 2) tipoComponente = "ram";
        else if(fkComponente == 3) tipoComponente = "disco";

        servidorModel.cadastrarComponente(fkServidor, tipoComponente, capacidade, limiteAtencao, limiteCritico)
            .then(
                function (resultado) {
                    res.status(201).json(resultado);
                }
            ).catch(
                function (erro) {
                    console.log(erro);
                    console.log(
                        "\nHouve um erro ao realizar o cadastro do componente! Erro: ",
                        erro.sqlMessage
                    );
                    res.status(500).json(erro.sqlMessage);
                }
            );
    }
}

function listar(req, res) {
    var idEmpresa = req.params.idEmpresa;

    servidorModel.listar(idEmpresa)
        .then(function (resultado) {
            if (resultado.length > 0) {
                res.status(200).json(resultado);
            } else {
                res.status(204).send("Nenhum resultado encontrado!");
            }
        }).catch(function (erro) {
            console.log(erro);
            console.log("Houve um erro ao buscar os servidores: ", erro.sqlMessage);
            res.status(500).json(erro.sqlMessage);
        });
}

function listarComponentesPorServidor(req, res) {
    var idServidor = req.params.idServidor;

    servidorModel.listarComponentesPorServidor(idServidor)
        .then(function (resultado) {
            if (resultado.length > 0) {
                res.status(200).json(resultado);
            } else {
                res.status(204).send("Nenhum resultado encontrado!");
            }
        }).catch(function (erro) {
            console.log(erro);
            console.log("Houve um erro ao buscar os componentes: ", erro.sqlMessage);
            res.status(500).json(erro.sqlMessage);
        });
}

function atualizar(req, res) {
    var idServidor = req.params.idServidor;
    var nome = req.body.nomeServer;

    if (nome == undefined) {
        res.status(400).send("O nome está undefined!");
    } else {
        servidorModel.atualizar(idServidor, nome)
            .then(function (resultado) {
                res.status(200).json(resultado);
            }).catch(function (erro) {
                console.log(erro);
                console.log("Houve um erro ao atualizar: ", erro.sqlMessage);
                res.status(500).json(erro.sqlMessage);
            });
    }
}

function excluir(req, res) {
    var idServidor = req.params.idServidor;

    servidorModel.excluir(idServidor)
        .then(function (resultado) {
            res.status(200).json(resultado);
        }).catch(function (erro) {
            console.log(erro);
            console.log("Houve um erro ao excluir: ", erro.sqlMessage);
            res.status(500).json(erro.sqlMessage);
        });
}

module.exports = {
    cadastrar,
    cadastrarComponente,
    listar,
    listarComponentesPorServidor,
    atualizar,
    excluir
}