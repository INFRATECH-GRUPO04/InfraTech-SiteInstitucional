validarSessao();

const paineis = document.querySelectorAll(".step-panel");
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
const avisoCopia = document.getElementById("aviso_copia");
const btnAvancar = document.getElementById("btn_avancar");
const btnVoltar = document.getElementById("voltar");

const ROTULOS_BOTAO = {
    1: "Continuar →",
    2: "Gerar token",
    3: "+ Gerar novo token"
};

let etapaAtual = 1;
let quantidade = 0;
let carregando = false;
let temporizadorCopia = null;

function atualizarBotoes() {
    btnAvancar.textContent = carregando ? "Gerando token..." : ROTULOS_BOTAO[etapaAtual];
    btnAvancar.disabled = carregando;
    btnAvancar.setAttribute("aria-busy", String(carregando));
    btnVoltar.disabled = carregando;
    btnVoltar.hidden = etapaAtual === 1 || etapaAtual === 3;
}

function focarEtapa(numero) {
    const alvo = {
        1: qtdInput,
        2: permissaoSelecionada() || document.getElementById("perm_funcionario") || document.getElementById("perm_admin") || document.getElementById("qtd1"),
        3: btnCopiar
    }[numero];

    if (alvo) {
        alvo.focus();
    }
}

function mostrarEtapa(numero) {
    paineis.forEach(function (painel) {
        painel.classList.toggle("active", Number(painel.dataset.panel) === numero);
    });

    pontos.forEach(function (dot) {
        const passo = Number(dot.dataset.step);
        dot.classList.toggle("done", passo < numero);
        dot.classList.toggle("active", passo === numero);

        if (passo === numero) {
            dot.setAttribute("aria-current", "step");
        } else {
            dot.removeAttribute("aria-current");
        }
    });

    linhas.forEach(function (linha, indice) {
        linha.classList.toggle("done", indice + 1 < numero);
    });

    etapaAtual = numero;
    atualizarBotoes();
    focarEtapa(numero);
}

function marcarInvalido(campo, invalido) {
    if (invalido) {
        campo.setAttribute("aria-invalid", "true");
    } else {
        campo.removeAttribute("aria-invalid");
    }
}

function validarEtapa1() {
    const valor = qtdInput.value.trim();
    const numero = Number(valor);

    if (!/^\d+$/.test(valor) || numero < 1) {
        erroQtd.textContent = "Informe um número inteiro de funcionários, maior que zero.";
        marcarInvalido(qtdInput, true);
        qtdInput.focus();
        return false;
    }

    erroQtd.textContent = "";
    marcarInvalido(qtdInput, false);
    quantidade = numero;
    qtdUserSpan.textContent = numero;
    return true;
}

function permissaoSelecionada() {
    return document.querySelector('input[name="permissao"]:checked');
}

function rotuloDaPermissao(radio) {
    return document.querySelector('label[for="' + radio.id + '"]').textContent.trim();
}

function gerarToken() {
    const permissao = permissaoSelecionada();

    if (!permissao) {
        erroPerm.textContent = "Escolha uma permissão para continuar.";
        return;
    }

    const idEmpresa = sessionStorage.ID_EMPRESA;

    if (!idEmpresa) {
        erroPerm.textContent = "Sessão inválida. Faça login novamente.";
        return;
    }

    erroPerm.textContent = "";
    carregando = true;
    atualizarBotoes();

    fetch("/crypto/gerar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            qtdServer: quantidade,
            permServer: permissao.value,
            idEmpresaVincularServer: idEmpresa
        })
    })
        .then(function (resposta) {
            if (!resposta.ok) {
                throw new Error("Falha ao gerar o token");
            }

            return resposta.json();
        })
        .then(function (dados) {
            tokenSpan.textContent = dados.token;
            qtdUsersSpan.textContent = quantidade;
            tipoUserSpan.textContent = rotuloDaPermissao(permissao);
            carregando = false;
            mostrarEtapa(3);
        })
        .catch(function () {
            carregando = false;
            atualizarBotoes();
            erroPerm.textContent = "Não foi possível gerar o token. Tente novamente.";
        });
}

function avancarEtapa() {
    if (carregando) {
        return;
    }

    if (etapaAtual === 1 && validarEtapa1()) {
        mostrarEtapa(2);
    } else if (etapaAtual === 2) {
        gerarToken();
    } else if (etapaAtual === 3) {
        reiniciarWizard();
    }
}

function voltarEtapa() {
    if (!carregando && etapaAtual > 1) {
        mostrarEtapa(etapaAtual - 1);
    }
}

function reiniciarWizard() {
    qtdInput.value = "";
    quantidade = 0;
    marcarInvalido(qtdInput, false);
    erroQtd.textContent = "";
    erroPerm.textContent = "";
    tokenSpan.textContent = "";
    avisoCopia.textContent = "";

    const radioPadrao = document.getElementById("perm_funcionario") || document.getElementById("qtd5");
    if (radioPadrao) {
        radioPadrao.checked = true;
    }

    mostrarEtapa(1);
}

function confirmarCopia() {
    btnCopiar.textContent = "Copiado";
    btnCopiar.classList.add("copiado");
    avisoCopia.textContent = "Token copiado para a área de transferência.";

    clearTimeout(temporizadorCopia);
    temporizadorCopia = setTimeout(function () {
        btnCopiar.textContent = "Copiar Token";
        btnCopiar.classList.remove("copiado");
        avisoCopia.textContent = "";
    }, 1500);
}

function copiarPorSelecao() {
    const faixa = document.createRange();
    faixa.selectNodeContents(tokenSpan);

    const selecao = window.getSelection();
    selecao.removeAllRanges();
    selecao.addRange(faixa);

    let copiado = false;
    try {
        copiado = document.execCommand("copy");
    } catch (erro) {
        copiado = false;
    }

    if (copiado) {
        confirmarCopia();
    } else {
        avisoCopia.textContent = "Não foi possível copiar automaticamente. O token está selecionado: use Ctrl+C.";
    }
}

function copiarCodigo() {
    const token = tokenSpan.textContent;

    if (!token) {
        return;
    }

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(token).then(confirmarCopia, copiarPorSelecao);
    } else {
        copiarPorSelecao();
    }
}

qtdInput.addEventListener("input", function () {
    qtdInput.value = qtdInput.value.replace(/\D/g, "");
    erroQtd.textContent = "";
    marcarInvalido(qtdInput, false);
});

qtdInput.addEventListener("keydown", function (evento) {
    if (evento.key === "Enter") {
        evento.preventDefault();
        avancarEtapa();
    }
});

document.querySelectorAll('input[name="permissao"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
        erroPerm.textContent = "";
    });
});

btnAvancar.addEventListener("click", avancarEtapa);
btnVoltar.addEventListener("click", voltarEtapa);
btnCopiar.addEventListener("click", copiarCodigo);

mostrarEtapa(1);