/*
 * Este arquivo: Valida operações de servidores e seus componentes, aplica os limites recebidos e prepara respostas para as rotas de monitoramento.
 */
var crypto = require("crypto");
var servidorModel = require("../models/servidorModel");


/* Valida o nome e a empresa da sessão antes de solicitar ao model a criação
 * de um servidor pertencente àquela empresa.
 */
function cadastrar(req, res) {
    var nomeServidor = req.body.nomeServer;
    var localizacaoServidor = req.body.localizacaoServer;
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
                    servidorModel.cadastrar(nomeServidor, localizacaoServidor, idEmpresa)
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


/* Confere dados e pertencimento do servidor, depois cria o componente e sua
 * configuração de métrica inicial.
 */
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

/* Lista somente os servidores que pertencem à empresa da identidade autenticada. */
function listar(req, res) {
    var idEmpresa = Number(req.params.idEmpresa);
    if (idEmpresa !== req.usuario.empresa) return res.status(403).json({ erro: 'Acesso restrito à empresa da sua conta.' });

    var idUsuario = req.usuario.id;
    var cargo = String(req.usuario.cargo || '').toUpperCase();
    var ehGestao = ['GESTOR', 'ADMIN', 'INFRATECH'].includes(cargo);

    var busca = ehGestao
        ? servidorModel.listar(idEmpresa)
        : servidorModel.listarPorFuncionario(idEmpresa, idUsuario);

    busca
        .then(function (resultado) {
            if (resultado && resultado.length > 0) {
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

/* Lê os limites padrão da empresa e os devolve às dashboards autenticadas. */
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

/* Valida todos os limites globais e salva as faixas de CPU, RAM, disco e rede
 * para a empresa vinculada à sessão.
 */
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
        .then(function () { res.status(200).json({ ok: true }); })
        .catch(function (erro) {
            console.log(erro);
            res.status(503).json({ erro: 'Não foi possível salvar no banco. A configuração local continua disponível.' });
        });
}

/* Atualiza os limites particulares de um componente depois de conferir que ele
 * pertence à empresa do usuário.
 */
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

/* Atualiza o nome apenas quando o servidor pertence à empresa da sessão.
 * O identificador recebido na URL nunca substitui essa verificação de vínculo.
 */
function atualizar(req, res) {
    var idServidor = Number(req.params.idServidor);
    var nome = typeof req.body.nomeServer === 'string' ? req.body.nomeServer.trim() : '';
    var localizacao = typeof req.body.localizacaoServer === 'string' ? req.body.localizacaoServer.trim() : null;
    if (!Number.isInteger(idServidor) || idServidor <= 0) return res.status(400).json({ erro: 'Servidor inválido.' });
    if (!nome) return res.status(400).json({ erro: 'O nome do servidor é obrigatório.' });

    servidorModel.servidorPertenceEmpresa(idServidor, req.usuario.empresa)
        .then(function (servidores) {
            if (!servidores.length) return res.status(404).json({ erro: 'Servidor não encontrado nesta empresa.' });
            return servidorModel.atualizarPorEmpresa(idServidor, req.usuario.empresa, nome, localizacao);
        })
        .then(function (resultado) {
            if (res.headersSent) return;
            return res.status(200).json({ ok: true, nome: nome, localizacao: localizacao });
        })
        .catch(function (erro) {
            console.log(erro);
            return res.status(500).json({ erro: 'Não foi possível atualizar o servidor.' });
        });
}

/* Confere a capacidade, os limites e a empresa dona do componente antes de
 * atualizar os dados físicos e a métrica associada no banco.
 */
function atualizarComponente(req, res) {
    var idComponente = Number(req.params.idComponente);
    var capacidade = Number(req.body.capacidadeServer);
    var idMetrica = Number(req.body.idMetricaServer);
    var limiteAtencao = Number(req.body.limiteAtencaoServer);
    var limiteCritico = Number(req.body.limiteCriticoServer);

    if (!Number.isInteger(idComponente) || idComponente <= 0) return res.status(400).json({ erro: 'Componente inválido.' });
    if (!Number.isFinite(capacidade) || capacidade <= 0) return res.status(400).json({ erro: 'A capacidade deve ser maior que zero.' });
    if (!Number.isInteger(idMetrica) || idMetrica <= 0) return res.status(400).json({ erro: 'Métrica inválida.' });
    if (!Number.isInteger(limiteAtencao) || !Number.isInteger(limiteCritico)
        || limiteAtencao < 0 || limiteCritico > 100 || limiteAtencao >= limiteCritico) {
        return res.status(400).json({ erro: 'O limite de atenção deve ser menor que o crítico e ambos devem estar entre 0% e 100%.' });
    }

    servidorModel.atualizarComponenteEmpresa(
        idComponente, req.usuario.empresa, capacidade, idMetrica, limiteAtencao, limiteCritico
    ).then(function (resultado) {
        if (!resultado) return res.status(404).json({ erro: 'Componente não encontrado nesta empresa.' });
        return res.status(200).json({ ok: true });
    }).catch(function (erro) {
        console.log(erro);
        return res.status(500).json({ erro: 'Não foi possível atualizar o componente.' });
    });
}

/* Solicita ao model a exclusão do servidor e das métricas, componentes e vínculos
 * dependentes. A empresa da sessão é usada para impedir remoções entre empresas.
 */
function excluir(req, res) {
    var idServidor = Number(req.params.idServidor);
    if (!Number.isInteger(idServidor) || idServidor <= 0) return res.status(400).json({ erro: 'Servidor inválido.' });

    servidorModel.excluirPorEmpresa(idServidor, req.usuario.empresa)
        .then(function (resultado) {
            if (!resultado) return res.status(404).json({ erro: 'Servidor não encontrado nesta empresa.' });
            return res.status(200).json({ ok: true });
        })
        .catch(function (erro) {
            console.log(erro);
            return res.status(500).json({ erro: 'Não foi possível excluir o servidor.' });
        });
}

function atualizarChave(req, res) {
    var idServidor = Number(req.params.idServidor);
    if (!Number.isInteger(idServidor) || idServidor <= 0) {
        return res.status(400).json({ erro: "Servidor inválido." });
    }

    var codigo = (req.body && req.body.codigoServer && String(req.body.codigoServer).trim()) 
        ? String(req.body.codigoServer).trim() 
        : ("inf_" + crypto.randomBytes(16).toString("hex"));

    servidorModel.servidorPertenceEmpresa(idServidor, req.usuario.empresa)
        .then(function (servidores) {
            if (!servidores.length) {
                return res.status(404).json({ erro: "Servidor não encontrado nesta empresa." });
            }
            return servidorModel.atualizarChavePorEmpresa(idServidor, codigo, req.usuario.empresa);
        })
        .then(function (resultado) {
            res.status(200).json({
                ok: true,
                mensagem: "Chave do servidor gerada com sucesso!",
                chave: codigo
            });
        })
        .catch(function (erro) {
            console.log(erro);
            console.log("Houve um erro ao atualizar a chave: ", erro.sqlMessage);
            res.status(500).json({ erro: "Houve um erro ao atualizar a chave do servidor." });
        });
}

module.exports = {
    cadastrar,
    cadastrarComponente,
    listar,
    listarComponentesPorServidor,
    listarLimitesGlobais,
    salvarLimitesGlobais,
    atualizarLimitesComponente,
    atualizar,
    atualizarComponente,
    excluir,
    atualizarChave
};
