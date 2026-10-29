var servidorModel = require("../models/servidorModel");


function cadastrar(req, res) {
    var nomeServidor = req.body.nomeServer;
    var idEmpresa = req.usuario.empresa;

    if (nomeServidor == undefined || String(nomeServidor).trim().length == 0) {
        res.status(400).send("O nome do servidor é obrigatório!");
    } else if (idEmpresa == undefined || isNaN(Number(idEmpresa))) {
        res.status(400).send("Identificação da empresa está indefinida!");
    } else {
        servidorModel.buscarPorNomeEEmpresa(nomeServidor, idEmpresa)
            .then(function (resultadoBusca) {
                if (resultadoBusca.length > 0) {
                    res.status(409).send("Já existe um servidor cadastrado com este nome nesta empresa!");
                } else {
                    servidorModel.cadastrar(nomeServidor, idEmpresa)
                        .then(function (resultado) {
                            var idServidor = resultado.insertId;
                            res.status(201).json({
                                idServidor: idServidor
                            });
                        }).catch(function (erro) {
                            console.log(erro);
                            console.log("\nHouve um erro ao realizar o cadastro! Erro: ", erro.sqlMessage);
                            res.status(500).json(erro.sqlMessage);
                        });
                }
            }).catch(function (erro) {
                console.log(erro);
                res.status(500).json(erro.sqlMessage);
            });
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
    } else if (capacidade == undefined || capacidade <= 0) {
        res.status(400).send("A capacidade deve ser maior que zero!");
    } else if (limiteAtencao == undefined || limiteCritico == undefined) {
        res.status(400).send("Os limites de alerta estão undefined!");
    } else if (Number(limiteAtencao) < 1 || Number(limiteAtencao) > 100 || Number(limiteCritico) < 1 || Number(limiteCritico) > 100) {
        res.status(400).send("Os limites de alerta devem estar entre 1% e 100%!");
    } else if (Number(limiteAtencao) >= Number(limiteCritico)) {
        res.status(400).send("O limite de atenção deve ser menor que o limite crítico!");
    } else {
        // Mapear fkComponente (1,2,3,4) para tipo string ('cpu', 'ram', 'disco', 'rede')
        var tipoComponente = "cpu";
        if (fkComponente == 2 || fkComponente == "ram") tipoComponente = "ram";
        else if (fkComponente == 3 || fkComponente == "disco") tipoComponente = "disco";
        else if (fkComponente == 4 || fkComponente == "rede") tipoComponente = "rede";

        servidorModel.servidorPertenceEmpresa(fkServidor, req.usuario.empresa).then(function (servidores) {
          if (!servidores.length) return res.status(403).json({ erro: 'Servidor fora da empresa da sua conta.' });
          return servidorModel.cadastrarComponente(fkServidor, tipoComponente, capacidade, limiteAtencao, limiteCritico)
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
        });
    }
}

function listar(req, res) {
    var idEmpresa = Number(req.params.idEmpresa);
    if (idEmpresa !== req.usuario.empresa) return res.status(403).json({ erro: 'Acesso restrito à empresa da sua conta.' });

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
    servidorModel.servidorPertenceEmpresa(idServidor, req.usuario.empresa).then(function (servidores) {
        if (!servidores.length) return res.status(403).json({ erro: 'Servidor fora da empresa da sua conta.' });
        return servidorModel.listarComponentesPorServidor(idServidor);
    })
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

function listarLimitesGlobais(req, res) {
    var idEmpresa = Number(req.params.idEmpresa);
    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) return res.status(400).json({ erro: 'Empresa inválida.' });
    if (idEmpresa !== req.usuario.empresa) return res.status(403).json({ erro: 'Acesso restrito à empresa da sua conta.' });
    servidorModel.listarLimitesGlobais(idEmpresa)
        .then(function (resultado) { res.status(200).json(resultado); })
        .catch(function (erro) {
            console.log(erro);
            res.status(503).json({ erro: 'Configuração global indisponível. Verifique a atualização do banco.' });
        });
}

function salvarLimitesGlobais(req, res) {
    var idEmpresa = Number(req.params.idEmpresa);
    if (idEmpresa !== req.usuario.empresa) return res.status(403).json({ erro: 'Acesso restrito à empresa da sua conta.' });
    var limites = req.body && req.body.limites;
    var recursos = ['cpu', 'ram', 'disco', 'rede'];
    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0 || !limites) return res.status(400).json({ erro: 'Empresa ou limites inválidos.' });
    var valido = recursos.every(function (recurso) {
        var faixa = limites[recurso];
        return faixa && Number.isInteger(Number(faixa.atencao)) && Number.isInteger(Number(faixa.critico))
            && Number(faixa.atencao) >= 0 && Number(faixa.critico) <= 100
            && Number(faixa.atencao) < Number(faixa.critico);
    });
    if (!valido) return res.status(400).json({ erro: 'Cada limite de atenção deve ser menor que o crítico, entre 0% e 100%.' });
    servidorModel.salvarLimitesGlobais(idEmpresa, limites)
        .then(function () {
            return req.body.substituirIndividuais
                ? servidorModel.substituirLimitesIndividuais(idEmpresa, limites)
                : Promise.resolve();
        })
        .then(function () { res.status(200).json({ ok: true }); })
        .catch(function (erro) {
            console.log(erro);
            res.status(503).json({ erro: 'Não foi possível salvar no banco. A configuração local continua disponível.' });
        });
}

function atualizarLimitesComponente(req, res) {
    var idComponente = req.params.idComponente;
    var idMetrica = req.body.idMetricaServer;
    var limiteAtencao = req.body.limiteAtencaoServer;
    var limiteCritico = req.body.limiteCriticoServer;

    if (idComponente == undefined) {
        res.status(400).send("O id do componente é obrigatório!");
    } else if (!idMetrica || limiteAtencao == undefined || limiteCritico == undefined) {
        res.status(400).json({ erro: 'Informe a métrica e os dois limites que serão ajustados.' });
    } else if (limiteAtencao != undefined && (Number(limiteAtencao) < 0 || Number(limiteAtencao) > 100 || Number(limiteCritico) < 0 || Number(limiteCritico) > 100 || Number(limiteAtencao) >= Number(limiteCritico))) {
        res.status(400).send("O limite de atenção deve ser menor que o limite crítico!");
    } else {
        servidorModel.componentePertenceEmpresa(idComponente, req.usuario.empresa).then(function (componentes) {
            if (!componentes.length) return res.status(403).json({ erro: 'Componente fora da empresa da sua conta.' });
            return servidorModel.atualizarLimitesComponenteEmpresa(idComponente, req.usuario.empresa, idMetrica, limiteAtencao, limiteCritico)
                .then(function (resultado) { res.status(200).json(resultado); })
                .catch(function (erro) { console.log(erro); res.status(500).json({ erro: 'Não foi possível atualizar os limites.' }); });
        });
    }
}

function atualizarChave(req, res) {
    var idServidor = req.params.idServidor;
    var codigo = req.body.codigoServer;

    if (codigo == undefined) {
        res.status(400).send("O codigo está undefined!");
    } else {
        servidorModel.atualizarChavePorEmpresa(idServidor, codigo, req.usuario.empresa)
            .then(function (resultado) {
                res.status(200).json(resultado);
            }).catch(function (erro) {
                console.log(erro);
                console.log("Houve um erro ao atualizar: ", erro.sqlMessage);
                res.status(500).json(erro.sqlMessage);
            });
    }
}

module.exports = {
    cadastrar,
    cadastrarComponente,
    listar,
    listarComponentesPorServidor,
    listarLimitesGlobais,
    salvarLimitesGlobais,
    atualizarLimitesComponente,
    atualizarChave
};
