const painéis = document.querySelectorAll(".step-panel");
const pontos = document.querySelectorAll(".step-dot");
const linhas = document.querySelectorAll(".step-line");

const qtdInput = document.getElementById("ipt_qtd_token");
const erroQtd = document.getElementById("erro_qtd");
const qtdUserSpan = document.getElementById("qtd_user");

const erroPerm = document.getElementById("erro_perm");
const qtdUsersSpan = document.getElementById("qtd_users");
const tipoUserSpan = document.getElementById("tipo_user");

const tokenSpan = document.getElementById("token");
const btnCopiar = document.getElementById("btn_copiar");
const btnAvancar = document.getElementById("btn_avancar");
const btnVoltar = document.getElementById("voltar");

let etapaAtual = 1;

function mostrarEtapa(numero) {
    painéis.forEach(function (painel) {
        painel.classList.toggle("active", Number(painel.dataset.panel) === numero);
    });

    pontos.forEach(function (dot) {
        const passo = Number(dot.dataset.step);
        dot.classList.toggle("done", passo < numero);
        dot.classList.toggle("active", passo === numero);
    });

    linhas.forEach(function (linha, indice) {
        linha.classList.toggle("done", indice + 1 < numero);
    });

    btnVoltar.hidden = numero === 1;

    if (numero === 3) {
        btnAvancar.textContent = "+ Gerar novo token";
        btnAvancar.onclick = reiniciarWizard;
    } else {
        btnAvancar.textContent = "Continuar →";
        btnAvancar.onclick = avancarEtapa;
    }

    etapaAtual = numero;
}

function validarEtapa1() {
    const quantidade = Number(qtdInput.value);

    if (!quantidade || quantidade <= 0) {
        erroQtd.textContent = "Informe um número válido de funcionários.";
        return false;
    }

    erroQtd.textContent = "";
    qtdUserSpan.textContent = quantidade;
    return true;
}

function validarEtapa2() {
    const permissaoSelecionada = document.querySelector('input[name="permissao"]:checked');

    if (!permissaoSelecionada) {
        erroPerm.textContent = "Escolha uma permissão para continuar.";
        return false;
    }

    erroPerm.textContent = "";
    qtdUsersSpan.textContent = qtdInput.value;
    tipoUserSpan.textContent = permissaoSelecionada.value;
    gerarToken(permissaoSelecionada.value);
    return true;
}

function avancarEtapa() {
    if (etapaAtual === 1 && validarEtapa1()) {
        mostrarEtapa(2);
        return;
    }

    if (etapaAtual === 2 && validarEtapa2()) {
        mostrarEtapa(3);
    }
}

function voltarEtapa() {
    if (etapaAtual > 1) {
        mostrarEtapa(etapaAtual - 1);
    }
}

function reiniciarWizard() {
    window.location.href = "./cadastro_token.html";
}

function gerarToken(permissao) {
    fetch("/crypto/gerar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            qtdServer: qtdInput.value,
            permServer: permissao,
            idEmpresaVincularServer: sessionStorage.ID_EMPRESA
        })
    })
        .then(function (resposta) {
            if (!resposta.ok) {
                throw new Error("Houve um erro ao tentar gerar o código!");
            }

            return resposta.json();
        })
        .then(function (dados) {
            tokenSpan.textContent = dados.token;
        })
        .catch(function (erro) {
            console.log(erro);
        });
}

function copiarCodigo() {
    navigator.clipboard.writeText(tokenSpan.textContent);
    btnCopiar.textContent = "Copiado";
    btnCopiar.classList.add("copiado");

    setTimeout(function () {
        btnCopiar.textContent = "Copiar";
        btnCopiar.classList.remove("copiado");
    }, 1500);
}

btnCopiar.addEventListener("click", copiarCodigo);
mostrarEtapa(1);