var login_cadastroModel = require("../models/login_cadastroModel");


function autenticar(req, res) {
    var email = req.body.emailServer;
    var senha = req.body.senhaServer;

    if (email == undefined) {
        res.status(400).send("Seu email está indefinido!");
    } else if (senha == undefined) {
        res.status(400).send("Sua senha está indefinida!");
    } else {

        login_cadastroModel.autenticar(email, senha)
            .then(
                function (resultadoAutenticar) {
                    console.log(`\nResultados encontrados: ${resultadoAutenticar.length}`);
                    console.log(`Resultados: ${JSON.stringify(resultadoAutenticar)}`);

                    if (resultadoAutenticar.length == 1) {
                        var funcionario = resultadoAutenticar[0];

                        res.json({
                            idFuncionario: funcionario.idFuncionario,
                            idEmpresa: funcionario.fkEmpresa,
                            nome: funcionario.nome,
                            email: funcionario.email,
                            senha: funcionario.senha,
                            tipoAcesso: funcionario.tipoAcesso
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
                    res.status(500).json(erro.sqlMessage);
                }
            );
    }

}

function cadastrar(req, res) {
    var nome = req.body.nomeServer;
    var email = req.body.emailServer;
    var senha = req.body.senhaServer;
    var cpf = req.body.cpfServer;
    var data_nascimento = req.body.nascimentoServer;
    var fkEmpresa = req.body.fkEmpresaServer;


    var idConvite = req.body.idConviteServer;
    var tipoAcesso = req.body.tipoAcessoServer;

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
    } else {

        login_cadastroModel.cadastrar(fkEmpresa, nome, data_nascimento, email, senha, cpf, tipoAcesso)
            .then(
                function (resultado) {
                    if (idConvite) {
                        var cryptoModel = require("../models/cryptoModel");
                        cryptoModel.atualizarCodigo(idConvite).catch(function (e) {
                            console.log("Erro ao atualizar uso do convite:", e);
                        });
                    }
                    res.json(resultado);
                }
            ).catch(
                function (erro) {
                    console.log(erro);
                    res.status(500).json(erro.sqlMessage);
                }
            );
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
    cadastrar,
    EmailsIguais,
    CodigoEmpresa
}