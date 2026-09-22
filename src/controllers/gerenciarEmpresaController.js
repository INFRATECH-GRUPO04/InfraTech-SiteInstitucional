var gerenciarEmpresaModel = require("../models/gerenciarEmpresaModel");

var ID_EMPRESA_INTERNA = gerenciarEmpresaModel.ID_EMPRESA_INTERNA;

var UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
    "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

// ---------- utilitários ----------

function somenteDigitos(valor) {
    return String(valor == undefined ? "" : valor).replace(/\D/g, "");
}

function texto(valor) {
    return String(valor == undefined ? "" : valor).trim();
}

function cnpjValido(cnpj) {
    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
        return false;
    }

    function digito(base) {
        var pesos = base.length === 12
            ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
            : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        var soma = 0;
        for (var i = 0; i < base.length; i++) {
            soma += Number(base.charAt(i)) * pesos[i];
        }
        var resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }

    var d1 = digito(cnpj.substring(0, 12));
    var d2 = digito(cnpj.substring(0, 12) + d1);
    return Number(cnpj.charAt(12)) === d1 && Number(cnpj.charAt(13)) === d2;
}

function emailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function lerId(req) {
    var id = Number(req.params.id);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function lerDados(body) {
    return {
        razaoSocial: texto(body.razaoSocialServer),
        nomeFantasia: texto(body.nomeFantasiaServer),
        cnpj: somenteDigitos(body.cnpjServer),
        segmentoAtuacao: texto(body.segmentoAtuacaoServer),
        email: texto(body.emailServer),
        telefone: somenteDigitos(body.telefoneServer),
        cep: somenteDigitos(body.cepServer),
        logradouro: texto(body.logradouroServer),
        numero: texto(body.numeroServer),
        complemento: texto(body.complementoServer),
        bairro: texto(body.bairroServer),
        cidade: texto(body.cidadeServer),
        estado: texto(body.estadoServer).toUpperCase()
    };
}

// Devolve a primeira mensagem de erro encontrada, ou null se estiver tudo certo.
function validarDados(d) {
    if (d.razaoSocial.length == 0 || d.razaoSocial.length > 100) {
        return "A razão social deve ter entre 1 e 100 caracteres.";
    }
    if (d.nomeFantasia.length == 0 || d.nomeFantasia.length > 100) {
        return "O nome fantasia deve ter entre 1 e 100 caracteres.";
    }
    if (d.cnpj.length !== 14) {
        return "O CNPJ deve ter 14 dígitos.";
    }
    if (d.segmentoAtuacao.length == 0 || d.segmentoAtuacao.length > 80) {
        return "O segmento de atuação deve ter entre 1 e 80 caracteres.";
    }
    if (d.email.length == 0 || d.email.length > 200 || !emailValido(d.email)) {
        return "Informe um e-mail válido, como contato@empresa.com.";
    }
    if (d.telefone.length < 10 || d.telefone.length > 11) {
        return "O telefone deve ter 10 ou 11 dígitos, com DDD.";
    }
    if (d.cep.length !== 8) {
        return "O CEP deve ter 8 dígitos.";
    }
    if (d.logradouro.length == 0 || d.logradouro.length > 100) {
        return "O logradouro deve ter entre 1 e 100 caracteres.";
    }
    if (d.numero.length == 0 || d.numero.length > 20) {
        return "O número deve ter entre 1 e 20 caracteres.";
    }
    if (d.complemento.length > 100) {
        return "O complemento pode ter no máximo 100 caracteres.";
    }
    if (d.bairro.length == 0 || d.bairro.length > 100) {
        return "O bairro deve ter entre 1 e 100 caracteres.";
    }
    if (d.cidade.length == 0 || d.cidade.length > 100) {
        return "A cidade deve ter entre 1 e 100 caracteres.";
    }
    if (UFS.indexOf(d.estado) === -1) {
        return "Selecione um estado (UF) válido.";
    }
    return null;
}

function responderErro(res, erro, mensagemPadrao) {
    console.log(erro);

    if (erro && erro.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ mensagem: "Já existe outra empresa cadastrada com este e-mail." });
    }
    return res.status(500).json({ mensagem: mensagemPadrao });
}

// ---------- rotas ----------

function listar(req, res) {
    gerenciarEmpresaModel.listar()
        .then(function (resultado) {
            res.status(200).json(resultado);
        }).catch(function (erro) {
            responderErro(res, erro, "Não foi possível carregar as empresas.");
        });
}

async function detalhes(req, res) {
    var idEmpresa = lerId(req);

    if (idEmpresa == null) {
        return res.status(400).json({ mensagem: "Empresa inválida." });
    }
    if (idEmpresa === ID_EMPRESA_INTERNA) {
        return res.status(403).json({ mensagem: "A empresa interna não pode ser gerenciada por aqui." });
    }

    try {
        var empresa = await gerenciarEmpresaModel.buscarPorId(idEmpresa);
        if (empresa.length == 0) {
            return res.status(404).json({ mensagem: "Empresa não encontrada." });
        }

        var gestor = await gerenciarEmpresaModel.buscarGestor(idEmpresa);
        var vinculos = await gerenciarEmpresaModel.contarVinculos(idEmpresa);

        res.status(200).json({
            empresa: empresa[0],
            gestor: gestor.length > 0 ? gestor[0] : null,
            qtdServidores: vinculos[0].qtdServidores,
            qtdFuncionarios: vinculos[0].qtdFuncionarios
        });
    } catch (erro) {
        responderErro(res, erro, "Não foi possível carregar os detalhes da empresa.");
    }
}

async function editar(req, res) {
    var idEmpresa = lerId(req);

    if (idEmpresa == null) {
        return res.status(400).json({ mensagem: "Empresa inválida." });
    }
    if (idEmpresa === ID_EMPRESA_INTERNA) {
        return res.status(403).json({ mensagem: "A empresa interna não pode ser alterada por aqui." });
    }

    var dados = lerDados(req.body);
    var erroValidacao = validarDados(dados);
    if (erroValidacao) {
        return res.status(400).json({ mensagem: erroValidacao });
    }

    try {
        var atual = await gerenciarEmpresaModel.buscarPorId(idEmpresa);
        if (atual.length == 0) {
            return res.status(404).json({ mensagem: "Empresa não encontrada." });
        }
        var empresaAtual = atual[0];

        // O dígito verificador só é exigido quando o CNPJ está sendo alterado.
        // Assim, empresas com CNPJ de teste continuam editáveis nos outros campos.
        if (dados.cnpj !== empresaAtual.cnpj && !cnpjValido(dados.cnpj)) {
            return res.status(400).json({ mensagem: "O CNPJ informado é inválido. Confira os dígitos." });
        }

        var cnpjRepetido = await gerenciarEmpresaModel.verificarCnpj(dados.cnpj, idEmpresa);
        if (cnpjRepetido.length > 0) {
            return res.status(409).json({ mensagem: "Já existe outra empresa cadastrada com este CNPJ." });
        }

        var emailRepetido = await gerenciarEmpresaModel.verificarEmail(dados.email, idEmpresa);
        if (emailRepetido.length > 0) {
            return res.status(409).json({ mensagem: "Já existe outra empresa cadastrada com este e-mail." });
        }

        // Endereço: atualiza o existente ou cria um se a empresa ainda não tinha
        var fkEndereco = empresaAtual.fkEndereco;
        if (fkEndereco) {
            await gerenciarEmpresaModel.atualizarEndereco(fkEndereco, dados);
        } else {
            var novoEndereco = await gerenciarEmpresaModel.inserirEndereco(dados);
            fkEndereco = novoEndereco.insertId;
        }

        await gerenciarEmpresaModel.atualizarEmpresa(idEmpresa, dados, fkEndereco);

        res.status(200).json({ mensagem: "Empresa atualizada com sucesso!" });
    } catch (erro) {
        responderErro(res, erro, "Não foi possível salvar as alterações da empresa.");
    }
}

async function alterarStatus(req, res) {
    var idEmpresa = lerId(req);
    var status = Number(req.body.statusServer);

    if (idEmpresa == null) {
        return res.status(400).json({ mensagem: "Empresa inválida." });
    }
    if (status !== 0 && status !== 1) {
        return res.status(400).json({ mensagem: "Status inválido." });
    }
    if (idEmpresa === ID_EMPRESA_INTERNA) {
        return res.status(403).json({ mensagem: "A empresa interna não pode ser desativada." });
    }

    try {
        var empresa = await gerenciarEmpresaModel.buscarPorId(idEmpresa);
        if (empresa.length == 0) {
            return res.status(404).json({ mensagem: "Empresa não encontrada." });
        }

        await gerenciarEmpresaModel.alterarStatus(idEmpresa, status);

        res.status(200).json({
            mensagem: status === 1 ? "Empresa reativada com sucesso!" : "Empresa desativada com sucesso!"
        });
    } catch (erro) {
        responderErro(res, erro, "Não foi possível alterar o status da empresa.");
    }
}

module.exports = {
    listar,
    detalhes,
    editar,
    alterarStatus
};
