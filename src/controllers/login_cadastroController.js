var login_cadastroModel = require("../models/login_cadastroModel");
var autorizacao = require("../seguranca/autorizacao");


function autenticar(req, res) {
    var email = typeof req.body.emailServer === 'string' ? req.body.emailServer.trim() : undefined;
    var senha = req.body.senhaServer;

    if (email == undefined) {
        res.status(400).send("Seu email está indefinido!");
    } else if (senha == undefined) {
        res.status(400).send("Sua senha está indefinida!");
    } else {

        login_cadastroModel.autenticar(email, senha)
            .then(
                function (resultadoAutenticar) {
                    if (resultadoAutenticar.length == 1) {
                        var funcionario = resultadoAutenticar[0];

                        if (Number(funcionario.statusSistema) !== 1) return res.status(403).send("Este usuário está desativado.");
                        if (!autorizacao.permissoesDoCargo(funcionario.tipoAcesso).monitorar) {
                            return res.status(403).send("O cargo deste usuário ainda não possui permissões configuradas.");
                        }
                        var sessao = autorizacao.criarSessao(funcionario);
                        res.cookie(autorizacao.COOKIE, sessao.token, {
                            httpOnly: true,
                            sameSite: 'lax',
                            secure: req.secure,
                            path: '/',
                            maxAge: 12 * 60 * 60 * 1000
                        });

                        res.json({
                            idFuncionario: funcionario.idFuncionario,
                            idEmpresa: funcionario.fkEmpresa,
                            nome: funcionario.nome,
                            email: funcionario.email,
                            tipoAcesso: String(funcionario.tipoAcesso).trim().toUpperCase(),
                            destino: autorizacao.destinoInicial(funcionario.tipoAcesso),
                            permissoes: autorizacao.permissoesDoCargo(funcionario.tipoAcesso)
                        });
                    } else if (resultadoAutenticar.length == 0) {
                        res.status(403).send("Email e/ou senha inválido(s)");
                    } else {
                        res.status(403).send("Mais de um usuário com o mesmo login e senha!");
                    }
                }
            ).catch(
                function (erro) {
                    console.log(erro);
                    console.log("\nHouve um erro ao realizar o login! Erro: ", erro.sqlMessage);
                    res.status(503).send("Não foi possível acessar o banco de dados. Tente novamente em instantes.");
                }
            );
    }

}

function sessaoAtual(req, res) {
    res.set('Cache-Control', 'no-store');
    autorizacao.autenticar(req, res, function () {
        res.json({ idFuncionario: req.usuario.id, idEmpresa: req.usuario.empresa, nome: req.usuario.nome, email: req.usuario.email, tipoAcesso: req.usuario.cargo, permissoes: autorizacao.permissoesDoCargo(req.usuario.cargo) });
    });
}

function sair(req, res) {
    res.clearCookie(autorizacao.COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
    res.status(204).end();
}

function verificar(req, res) {
    var codigo = req.query.codigo;
    if (!codigo) return res.status(400).send("Seu código está indefinido!");

    login_cadastroModel.verificar(codigo)
        .then(function (resultado) {
            if (resultado.length) return res.status(200).json(resultado[0]);
            return res.status(404).send("Código não encontrado");
        })
        .catch(function () {
            return res.status(500).json({ mensagem: "Não foi possível verificar o código" });
        });
}

function cadastrar(req, res) {
    var nome = req.body.nomeServer;
    var email = req.body.emailServer;
    var senha = req.body.senhaServer;
    var cpf = req.body.cpfServer;
    var data_nascimento = req.body.nascimentoServer;
    var idConvite = req.body.idConviteServer;

    if (nome == undefined) {
        res.status(400).send("Seu nome está indefinido!");
    } else if (email == undefined) {
        res.status(400).send("Seu email está indefinido!");
    } else if (senha == undefined) {
        res.status(400).send("Sua senha está indefinida!");
    } else if (cpf == undefined) {
        res.status(400).send("Seu cpf está indefinido!");
    } else if (data_nascimento == undefined) {
        res.status(400).send("Sua data de nascimento está indefinida!");
    } else if (!idConvite) {
        res.status(403).send("É necessário um convite válido para criar a conta.");
    } else {
        login_cadastroModel.buscarConviteAtivoPorId(idConvite)
            .then(function (convites) {
                if (!convites.length) return res.status(403).send("Convite inválido ou sem usos disponíveis.");
                var convite = convites[0];
                var cargosPermitidos = ['INFRATECH', 'GESTOR', 'ANALISTA_DADOS', 'ANALISTA_NOC', 'ADMIN', 'FUNCIONARIO'];
                if (!cargosPermitidos.includes(String(convite.tipo_acesso).toUpperCase())) return res.status(403).send("O convite possui um cargo inválido.");
                return login_cadastroModel.cadastrar(convite.fk_empresa, nome, data_nascimento, email, senha, cpf, convite.tipo_acesso)
                    .then(function (resultado) {
                        var cryptoModel = require("../models/cryptoModel");
                        return cryptoModel.atualizarCodigo(convite.id_convite).then(function () { res.json(resultado); });
                    });
            }).catch(function (erro) {
                console.log(erro);
                res.status(500).json(erro.sqlMessage || "Não foi possível concluir o cadastro.");
            });
    }
}

function EmailsIguais(req, res) {

    var email = req.body.emailServer;

    if (email == undefined) {
        res.status(400).send("Seu email está indefinido!");
    } else {

        login_cadastroModel.EmailsIguais(email)
            .then(
                function (resultadoEmail) {
                    if (resultadoEmail.length == 1) {
                        res.status(403).send("Email e/ou senha inválido(s)");
                    } else if (resultadoEmail.length == 0) {
                        return res.status(200).send("Email disponível");
                    }
                }
            ).catch(
                function (erro) {
                    console.log(erro);
                    res.status(500).json(erro.sqlMessage);
                }
            );
    }
}

function CodigoEmpresa(req, res) {

    var codigo = req.body.codigoServer;

    if (codigo == undefined) {
        res.status(400).send("Seu código está indefinido!");
    } else {

        login_cadastroModel.CodigoEmpresa(codigo)
            .then(
                function (resultadoCodigo) {
                    if (resultadoCodigo.length >= 1) {
                         res.status(200).json({
                            mensagem: "Codigo válido",
                            fk_empresa: resultadoCodigo[0].fk_empresa,
                            id_convite: resultadoCodigo[0].id_convite,
                            tipo_acesso: resultadoCodigo[0].tipo_acesso
                         });
                    } else {
                        res.status(403).send("Código inválido ou limite de usos esgotado.");
                    }
                }
            ).catch(
                function (erro) {
                    console.log(erro);
                    res.status(500).json(erro.sqlMessage);
                }
            );
    }
}

module.exports = {
    autenticar,
    sessaoAtual,
    sair,
    verificar,
    cadastrar,
    EmailsIguais,
    CodigoEmpresa
}
