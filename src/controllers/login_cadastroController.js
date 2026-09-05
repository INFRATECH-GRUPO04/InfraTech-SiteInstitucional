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

async function cadastrar(req, res) {
    var nome = req.body.nomeServer;
    var email = req.body.emailServer;
    var senha = req.body.senhaServer;
    var codigo = req.body.codigoServer;
    var cpf = req.body.cpfServer;

    // Faça as validações dos valores
    if (nome == undefined) {
        res.status(400).send("Seu nome está indefinido!");
    } else if (email == undefined) {
        res.status(400).send("Seu email está indefinido!");
    } else if (senha == undefined) {
        res.status(400).send("Sua senha está indefinida!");
    } else if (codigo == undefined) {
        res.status(400).send("Este código de empresa está indefinido!");
    } else if (cpf == undefined) {
        res.status(400).send("Seu cpf está indefinido!");
    } else {

        try {
            var verificacaoOut = await login_cadastroModel.verificar(codigo);

             if (verificacaoOut.length < 1) {
            return res.status(400).send("Esse código de empresa não é válido.")
            }

            // Passe os valores como parâmetro e vá para o arquivo usuarioModel.js
            login_cadastroModel.cadastrar(nome, email, senha, cpf, verificacaoOut[0].fkEmpresa)
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
        } catch (erro) {
            console.log(erro);
            console.log("Houve um erro ao verificar o código da empresa.");
            res.status(500).json(erro.sqlMessage);
        }
    }
}

module.exports = {
    autenticar,
    cadastrar
}