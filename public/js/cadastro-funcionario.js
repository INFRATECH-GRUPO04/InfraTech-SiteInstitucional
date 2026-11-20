function validar() {
    var nomeVar = nomeInput.value.trim();
    var emailVar = emailInput.value.trim();
    var senhaVar = passwordInput.value;
    var confirmacaoSenhaVar = confirmInput.value;
    let codigoVar = codigoInput.value.trim();
    let cpfVar = cpfInput.value.trim();
    let nascimentoVar = nascimentoInput.value.trim();

    let indice_arroba = emailVar.indexOf("@");
    let indice_com = emailVar.indexOf(".com");
    let cpfLimpo = cpfVar.replace(/\D/g, "");

    if (nomeVar == "" || emailVar == "" || senhaVar == "" || confirmacaoSenhaVar == "" ||
        codigoVar == "" || cpfVar == "" || nascimentoVar == "") {
        exibirErro("Preencha todos os campos!");
        return false;
    } else if (indice_arroba == -1 || indice_com == -1) {
        exibirErro("Insira um e-mail válido!");
        return false;
    } else if (senhaVar.length < 6) {
        exibirErro("A senha deve ter pelo menos 6 caracteres!");
        return false;
    } else if (senhaVar != confirmacaoSenhaVar) {
        exibirErro("As senhas não coincidem!");
        return false;
    } else if (cpfLimpo.length !== 11) {
        exibirErro("CPF deve ter 11 dígitos numéricos!");
        return false;
    } else if (nascimentoVar.length < 10) {
        exibirErro("A data de nascimento está incompleta (DD/MM/AAAA)!");
        return false;
    } else {
        var btnCadastrar = document.getElementById("btn_cadastrar");
        if (btnCadastrar) {
            btnCadastrar.disabled = true;
            btnCadastrar.innerText = "Validando dados...";
        }
        confirmarEmailsIguais();
        return false;
    }
}

function confirmarEmailsIguais() {
    var emailVar = emailInput.value.trim();

    fetch("/login_cadastro/EmailsIguais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailServer: emailVar })
    }).then(function (resposta) {
        if (resposta.ok) {
            confirmarCodigoEmpresa();
        } else {
            reabilitarBotao();
            resposta.text().then(texto => {
                exibirErro(texto || "E-mail já cadastrado!");
            });
        }
    }).catch(function (erro) {
        console.log(erro);
        reabilitarBotao();
        exibirErro("Erro ao verificar e-mail.");
    });
    return false;
}

function confirmarCodigoEmpresa() {
    var codigoVar = codigoInput.value.trim();

    fetch("/login_cadastro/CodigoEmpresa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoServer: codigoVar })
    }).then(function (resposta) {
        if (resposta.ok) {
            resposta.json().then(json => {
                cadastrar(json.fk_empresa, json.id_convite, json.tipo_acesso);
            });
        } else {
            reabilitarBotao();
            resposta.text().then(texto => {
                exibirErro(texto || "Código da empresa não encontrado ou esgotado!");
            });
        }
    }).catch(function (erro) {
        console.log(erro);
        reabilitarBotao();
        exibirErro("Erro ao verificar código da empresa.");
    });
    return false;
}

function cadastrar(idDaEmpresa, idConvite, tipoAcesso) {
    var nomeVar = nomeInput.value.trim();
    var emailVar = emailInput.value.trim();
    var senhaVar = passwordInput.value;
    var cpfVar = cpfInput.value.replace(/\D/g, "");
    var nascimentoVar = nascimentoInput.value.trim();

    var partesData = nascimentoVar.split('/');
    var dataFormatada = partesData[2] + '-' + partesData[1] + '-' + partesData[0];

    fetch("/login_cadastro/cadastrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            nomeServer: nomeVar,
            emailServer: emailVar,
            senhaServer: senhaVar,
            cpfServer: cpfVar,
            nascimentoServer: dataFormatada,
            fkEmpresaServer: idDaEmpresa,
            idConviteServer: idConvite,
            tipoAcessoServer: tipoAcesso
        }),
    }).then(function (resposta) {
        console.log("resposta: ", resposta);

        if (resposta.ok) {
            let divCardErro = document.getElementById("cardErro");
            let spanMensagemErro = document.getElementById("mensagem_erro");

            if (divCardErro && spanMensagemErro) {
                divCardErro.style.display = "block";
                divCardErro.style.borderColor = "var(--cor-sucesso, #05df72)";
                spanMensagemErro.innerHTML = "Cadastro realizado com sucesso! Redirecionando...";
            }

            setTimeout(() => {
                window.location = "../login/login.html";
            }, 2000);
        } else {
            reabilitarBotao();
            throw new Error("Houve um erro ao tentar realizar o cadastro!");
        }
    }).catch(function (resposta) {
        console.log(`#ERRO: ${resposta}`);
        reabilitarBotao();
        exibirErro("Erro ao realizar cadastro.");
    });

    return false;
}

function reabilitarBotao() {
    var btnCadastrar = document.getElementById("btn_cadastrar");
    if (btnCadastrar) {
        btnCadastrar.disabled = false;
        btnCadastrar.innerText = "Criar Conta de Funcionário";
    }
}

let cronometroErro;

function exibirErro(mensagem) {
    let divCardErro = document.getElementById("cardErro");
    let spanMensagemErro = document.getElementById("mensagem_erro");

    if (!divCardErro || !spanMensagemErro) {
        alert(mensagem);
        return;
    }

    clearTimeout(cronometroErro);

    divCardErro.style.display = "block";
    divCardErro.style.borderColor = "var(--cor-perigo, #ff3366)";
    spanMensagemErro.innerHTML = mensagem;

    cronometroErro = setTimeout(function () {
        divCardErro.style.display = "none";
    }, 4500);
}

// Máscara dinâmica de CPF
let inputCpf = document.getElementById('cpfInput');
if (inputCpf) {
    inputCpf.addEventListener('input', function (e) {
        let valor = e.target.value.replace(/\D/g, "");
        if (valor.length > 11) valor = valor.slice(0, 11);
        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        e.target.value = valor;
    });
}

// Máscara dinâmica de Data de Nascimento
let inputNascimento = document.getElementById('nascimentoInput');
if (inputNascimento) {
    inputNascimento.addEventListener('input', function (e) {
        let valor = e.target.value.replace(/\D/g, "");
        if (valor.length > 8) valor = valor.slice(0, 8);
        valor = valor.replace(/(\d{2})(\d)/, "$1/$2");
        valor = valor.replace(/(\d{2})(\d)/, "$1/$2");
        e.target.value = valor;
    });
}

function sumirMensagem() {
    let divCardErro = document.getElementById("cardErro");
    if (divCardErro) {
        divCardErro.style.display = "none";
    }
}