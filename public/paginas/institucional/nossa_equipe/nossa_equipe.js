    const header = document.querySelector("header");

window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
        header.classList.add("scrolled");
    } else {
        header.classList.remove("scrolled");
    }
});

let btnHamburguer = document.querySelector(".btn-menu-hamburguer");
let menuNav = document.querySelector("nav");


btnHamburguer.addEventListener("click", () => {
    menuNav.classList.toggle("ativo");
});






function entrar() {

    var emailVar = ipt_email_corporativo.value;
    var senhaVar = ipt_senha.value;

    if (emailVar == "" || senhaVar == "") {
        cardErro.style.display = "block"
        mensagem_erro.innerHTML = "(Mensagem de erro para todos os campos em branco)";
        return false;
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
        console.log("ESTOU NO THEN DO entrar()!")

        if (resposta.ok) {
            console.log(resposta);
            console.log("Resposta ok");

            resposta.json().then(json => {
                console.log("Resposta do json de login = ok. then(json)");

                console.log(json);
                console.log(JSON.stringify(json));
                sessionStorage.EMAIL_USUARIO = json.email;
                sessionStorage.SENHA_USUARIO = json.senha;
                sessionStorage.NOME_USUARIO = json.nome;
                sessionStorage.ID_USUARIO = json.idFuncionario;
                sessionStorage.ID_EMPRESA = json.idEmpresa;
                sessionStorage.TIPO_ACESSO = json.tipoAcesso;


                setTimeout(() => {
                    window.location.href = '../dashboard/cadastro_servidor.html';
                }, 2000);

            });

        } else {

            console.log("Houve um erro ao tentar realizar o login!");

        }

    }).catch(function (erro) {
        console.log(erro);
    })
}

function cadastrar(quantidade_usada, quantidade_uso, tipoAcesso, fkEmpresa) {

    var nomeVar = ipt_nome.value;
    var emailVar = ipt_email_corporativo_cadastro.value;
    var senhaVar = ipt_senha_cadastro.value;
    var confirmacaoSenhaVar = ipt_confirmar_senha.value;
    var cpfVar = ipt_cpf.value;

    if (
        nomeVar == "" ||
        emailVar == "" ||
        senhaVar == "" ||
        confirmacaoSenhaVar == ""
        || cpfVar == ""
    ) {
        console.log("Preencha todos os campos!");
        return;
    }

    if (
        cpfVar.length !== 11
    ) {
        console.log("O CPF tem que ter 11 caracteres");
        alert("O CPF tem que ter 11 caracteres!!!!!");
        return;
    }

    if (senhaVar != confirmacaoSenhaVar) {
        console.log("As senhas não são iguais!");
        return;
    } else if (senhaVar.length < 8) {
        console.log("Mínimo de 8 caracteres");
        alert("A senha tem que ser maior que 8 caracteres")
        return
    }

    if (quantidade_usada >= quantidade_uso) {
        console.log("Limite excedido do token");
        return
    }



    fetch("/login_cadastro/cadastrar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            nomeServer: nomeVar,
            emailServer: emailVar,
            senhaServer: senhaVar,
            cpfServer: cpfVar,
            tipoAcessoServer: tipoAcesso,
            fkEmpresaServer: fkEmpresa
        }),
    })
        .then(function (resposta) {
            console.log("resposta: ", resposta);

            if (resposta.ok) {
                console.log("Usuário cadastro com sucesso!");



                setTimeout(() => {
                    let link_entrar = document.getElementById('link_entrar');
                    link_entrar.click();
                }, 1000);

            } else {
                throw "Houve um erro ao tentar realizar o cadastro!";
            }
        })
        .catch(function (resposta) {
            console.log(`#ERRO: ${resposta}`);

        })
}

function buscarCodigo() {
    var codigo = ipt_codigo.value;

    console.log(codigo);


    fetch(`crypto/buscar/${codigo}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    })
        .then(function (resposta) {
            console.log("resposta atualizar: ", resposta);

            if (resposta.ok) {
                resposta.json().then(function (resposta) {
                    console.log(resposta)
                    cadastrar(resposta[0].quantidade_usada, resposta[0].quantidade_uso, resposta[0].tipoAcesso, resposta[0].fkEmpresa)

                    atualizarCodigo(resposta[0].idConvite)
                });

            } else {
                throw "Houve um erro ao tentar buscar a tentativa!";
            }
        })
        .catch(function (resposta) {
            console.log(`#ERRO ao atualizar: ${resposta}`);
            alert("Erro ao buscar tentativa: " + resposta);
        });

}

function atualizarCodigo(idConvite) {

    fetch("/crypto/atualizar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            idConviteServer: idConvite
        }),
    })
        .then(function (resposta) {
            console.log("resposta atualizar: ", resposta);

            if (resposta.ok) {
                console.log("Convite atualizado com sucesso!");

            } else {
                throw "Houve um erro ao tentar atualizar o convite!";
            }
        })
        .catch(function (resposta) {
            console.log(`#ERRO ao atualizar: ${resposta}`);
            alert("Erro ao salvar o convite: " + resposta);
        });

    return false;
}
