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
    var qtd_funcionario = Number(req.body.qtdServer);
    var perm_funcionario = req.body.permServer;
    var fkEmpresa = Number(req.body.idEmpresaVincularServer);

    if (!qtd_funcionario || qtd_funcionario <= 0) {
        return res.status(400).send("Quantidade de funcionários inválida.");
    }

    if (!fkEmpresa || fkEmpresa <= 0) {
        return res.status(400).send("ID da empresa inválido.");
    }

    if (perm_funcionario === "COMUM") {
        perm_funcionario = "FUNCIONARIO";
    }

    if (perm_funcionario !== "ADMIN" && perm_funcionario !== "FUNCIONARIO") {
        perm_funcionario = "FUNCIONARIO";
    }

    var token_final = gerarCodigoToken();

    cryptoModel.gerarCodigo(token_final, perm_funcionario, qtd_funcionario, fkEmpresa)
        .then(
            function (resultado) {
                res.json({
                    mensagem: "Código gerado com sucesso!",
                    token: token_final
                });
            }
        ).catch(
            function (erro) {
                console.log(erro);
                res.status(500).json(erro.sqlMessage);
            }
        );
}

function atualizarCodigo(req, res) {
    var id = req.body.idConviteServer;

    cryptoModel.atualizarCodigo(id)
        .then(function (resultado) {

            if (resultado.affectedRows > 0) {

                res.status(200).json({
                    mensagem: "Convite utilizado com sucesso!"
                });

            } else {
                res.status(400).json({
                    mensagem: "Este convite não possui mais utilizações disponíveis."
                });
            }
        })
        .catch(function (erro) {

            console.log(erro);

            res.status(500).json({
                mensagem: "Erro ao atualizar o convite."
            });
        });
}

function buscarCodigo(req, res) {
    let codigo = req.params.codigo;

    cryptoModel.buscarCodigo(codigo).then((resultado) => {
        if (resultado.length > 0) {
 
            res.status(200).json(resultado);
        } else {
            res.status(204).json([]);
        }
    }).catch(function (erro) {
        console.log(erro);
        console.log("Houve um erro ao buscar a melhor tentativa: ", erro.sqlMessage);
        res.status(500).json(erro.sqlMessage);
    });
}


module.exports = {
    gerarCodigo,
    atualizarCodigo,
    buscarCodigo
};