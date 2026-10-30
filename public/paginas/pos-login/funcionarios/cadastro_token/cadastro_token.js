validarSessao();

const paineis = document.querySelectorAll(".step-panel");
const pontos = document.querySelectorAll(".step-dot");
const linhas = document.querySelectorAll(".step-line");

const qtdInput = document.getElementById("ipt_qtd_token");
const erroQtd = document.getElementById("erro_qtd");
const qtdUserSpan = document.getElementById("qtd_user");

const erroPerm = document.getElementById("erro_perm");
const erroGeracao = document.getElementById("erro_geracao");
const qtdUsersSpan = document.getElementById("qtd_users");
const tipoUserSpan = document.getElementById("tipo_user");
const revisaoToken = document.getElementById("revisao_token");
const resultadoToken = document.getElementById("resultado_token");

const tokenSpan = document.getElementById("token");
const btnCopiar = document.getElementById("btn_copiar");
const avisoCopia = document.getElementById("aviso_copia");
const btnAvancar = document.getElementById("btn_avancar");
const btnVoltar = document.getElementById("voltar");
const btnAjudaToken = document.getElementById("btn_ajuda_token");
const ajudaToken = document.getElementById("ajuda_token");

const ROTULOS_BOTAO = {
    1: "Continuar →",
    2: "Revisar token",
    3: "Gerar token"
};

let etapaAtual = 1;
let quantidade = 0;
let carregando = false;
let tokenGerado = false;
let temporizadorCopia = null;

function atualizarBotoes() {
    btnAvancar.textContent = carregando ? "Gerando token..." : ROTULOS_BOTAO[etapaAtual];
    btnAvancar.disabled = carregando;
    btnAvancar.setAttribute("aria-busy", String(carregando));
    btnVoltar.disabled = carregando;
    btnVoltar.hidden = tokenGerado;
    btnVoltar.textContent = etapaAtual === 1 ? "Cancelar" : "Voltar";
    if (etapaAtual === 3 && tokenGerado) {
        btnAvancar.textContent = carregando ? "Gerando token..." : "+ Gerar novo token";
    }
}

function focarEtapa(numero) {
    const alvo = {
        1: qtdInput,
        2: permissaoSelecionada() || document.getElementById("perm_analista_dados") || document.getElementById("perm_gestor") || document.getElementById("perm_infratech"),
        3: tokenGerado ? btnCopiar : btnAvancar
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

    if (!/^\d+$/.test(valor) || numero < 1 || numero > 1000) {
        erroQtd.textContent = "Informe uma quantidade inteira entre 1 e 1.000 cadastros.";
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
    const rotulo = document.querySelector('label[for="' + radio.id + '"] strong');
    return rotulo ? rotulo.textContent.trim() : document.querySelector('label[for="' + radio.id + '"]').textContent.trim();
}

function gerarToken() {
    const permissao = permissaoSelecionada();

    if (!permissao) {
        erroGeracao.textContent = "Escolha uma permissão para continuar.";
        return;
    }

    const idEmpresa = sessionStorage.ID_EMPRESA;

    if (!idEmpresa) {
        erroGeracao.textContent = "Sessão inválida. Faça login novamente.";
        return;
    }

    erroGeracao.textContent = "";
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
            tokenGerado = true;
            revisaoToken.hidden = true;
            resultadoToken.hidden = false;
            atualizarBotoes();
            focarEtapa(3);
        })
        .catch(function () {
            carregando = false;
            atualizarBotoes();
            erroGeracao.textContent = "Não foi possível gerar o token. Tente novamente.";
            btnAvancar.focus();
        });
}

function avancarEtapa() {
    if (carregando) {
        return;
    }

    if (etapaAtual === 1 && validarEtapa1()) {
        mostrarEtapa(2);
    } else if (etapaAtual === 2) {
        const permissao = permissaoSelecionada();
        if (!permissao) {
            erroPerm.textContent = "Escolha uma permissão para continuar.";
            return;
        }
        erroPerm.textContent = "";
        qtdUsersSpan.textContent = quantidade;
        tipoUserSpan.textContent = rotuloDaPermissao(permissao);
        revisaoToken.hidden = false;
        resultadoToken.hidden = true;
        mostrarEtapa(3);
    } else if (etapaAtual === 3) {
        if (tokenGerado) {
            reiniciarWizard();
        } else {
            gerarToken();
        }
    }
}

function voltarEtapa() {
    if (carregando) {
        return;
    }

    if (etapaAtual === 1) {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = "../../../../dashboard/dash-geral.html";
        }
    } else if (etapaAtual > 1) {
        mostrarEtapa(etapaAtual - 1);
    }
}

function reiniciarWizard() {
    qtdInput.value = "1";
    quantidade = 1;
    marcarInvalido(qtdInput, false);
    erroQtd.textContent = "";
    erroPerm.textContent = "";
    erroGeracao.textContent = "";
    tokenSpan.textContent = "";
    avisoCopia.textContent = "";
    tokenGerado = false;
    revisaoToken.hidden = false;
    resultadoToken.hidden = true;

    document.getElementById("perm_analista_dados").checked = true;

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
btnAjudaToken.addEventListener("click", function () {
    const aberto = btnAjudaToken.getAttribute("aria-expanded") === "true";
    btnAjudaToken.setAttribute("aria-expanded", String(!aberto));
    ajudaToken.hidden = aberto;
});
document.addEventListener("click", function (evento) {
    if (!evento.target.closest(".ajuda-token-ancora") && !ajudaToken.hidden) {
        ajudaToken.hidden = true;
        btnAjudaToken.setAttribute("aria-expanded", "false");
    }
});
document.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape" && !ajudaToken.hidden) {
        ajudaToken.hidden = true;
        btnAjudaToken.setAttribute("aria-expanded", "false");
        btnAjudaToken.focus();
    }
});
mostrarEtapa(1);
