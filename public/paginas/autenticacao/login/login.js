function entrar() {
    var emailVar = emailInput.value;
    var senhaVar = passwordInput.value;

    var cardErro = document.getElementById("cardErro");
    var mensagemErro = document.getElementById("mensagem_erro");

    if (emailVar == "" || senhaVar == "") {
        if (cardErro && mensagemErro) {
            cardErro.style.display = "block";
            mensagemErro.innerHTML = "Preencha todos os campos em branco.";
            setTimeout(() => { cardErro.style.display = "none"; }, 4000);
        } else {
            alert("Preencha todos os campos em branco.");
        }
        return false;
    }

    var btnEntrar = document.getElementById("btn_entrar");
    if (btnEntrar) {
        btnEntrar.disabled = true;
        btnEntrar.innerText = "Autenticando...";
    }

    fetch("/login_cadastro/autenticar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            emailServer: emailVar,
            senhaServer: senhaVar
        })
    }).then(function (resposta) {
        console.log("ESTOU NO THEN DO entrar()!");

        if (resposta.ok) {
            resposta.json().then(json => {
                console.log("Resposta do json de login = ok. then(json)", json);

                sessionStorage.EMAIL_USUARIO = json.email;
                sessionStorage.SENHA_USUARIO = json.senha;
                sessionStorage.NOME_USUARIO = json.nome;
                sessionStorage.ID_USUARIO = json.id_funcionario || json.idFuncionario;
                sessionStorage.ID_EMPRESA = json.id_empresa || json.idEmpresa;
                sessionStorage.TIPO_ACESSO = json.adm || json.tipoAcesso;

                if (cardErro && mensagemErro) {
                    cardErro.style.display = "block";
                    cardErro.style.borderColor = "var(--cor-sucesso, #05df72)";
                    mensagemErro.innerHTML = "Login realizado com sucesso! Redirecionando...";
                }

                setTimeout(() => {
                    window.location.href = '../../pos-login/painel/painel.html';
                }, 1000);
            });
        } else {
            if (btnEntrar) {
                btnEntrar.disabled = false;
                btnEntrar.innerText = "Entrar no Sistema";
            }
            resposta.text().then(texto => {
                if (cardErro && mensagemErro) {
                    cardErro.style.display = "block";
                    cardErro.style.borderColor = "var(--cor-perigo, #ff3366)";
                    mensagemErro.innerHTML = texto || "E-mail e/ou senha inválido(s)!";
                    setTimeout(() => { cardErro.style.display = "none"; }, 4500);
                } else {
                    alert(texto || "E-mail e/ou senha inválido(s)!");
                }
            });
        }
    }).catch(function (erro) {
        console.log(erro);
        if (btnEntrar) {
            btnEntrar.disabled = false;
            btnEntrar.innerText = "Entrar no Sistema";
        }
        if (cardErro && mensagemErro) {
            cardErro.style.display = "block";
            mensagemErro.innerHTML = "Erro de conexão com o servidor.";
            setTimeout(() => { cardErro.style.display = "none"; }, 4000);
        }
    });
}