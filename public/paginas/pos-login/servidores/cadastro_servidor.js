let contador = 0;
let inputsLista = [];

window.onload = function () {
    validarSessao();
    adicionarComponente("cpu");
    adicionarComponente("ram");
    adicionarComponente("disco");
    adicionarComponente("rede");
};

function adicionarComponente(tipoInit = "cpu") {
    const divPai = document.getElementById("alinhar");
    const div = document.createElement("div");
    div.id = `a${contador}`;
    div.className = "caixa-alocacao";
    inputsLista.push(div.id);

    let isCpu = tipoInit === "cpu";
    let rotulo = "CPU";
    let unidadeCap = "Cores";
    let capPadrao = 8;
    let atencaoPadrao = 75;
    let criticoPadrao = 90;

    if (tipoInit === "ram") {
        rotulo = "Memória RAM";
        unidadeCap = "GB";
        capPadrao = 32;
        atencaoPadrao = 80;
        criticoPadrao = 95;
    } else if (tipoInit === "disco") {
        rotulo = "Disco SSD";
        unidadeCap = "GB";
        capPadrao = 1000;
        atencaoPadrao = 80;
        criticoPadrao = 95;
    } else if (tipoInit === "rede") {
        rotulo = "Rede";
        unidadeCap = "Mbps";
        capPadrao = 1000;
        atencaoPadrao = 75;
        criticoPadrao = 90;
    }

    div.innerHTML = `
        <div class="linha-alocacao">
            <div class="rotulo-alocacao">
                <span class="rotulo-componente-texto">${rotulo}</span>
                <input type="hidden" id="input${contador}" value="${tipoInit}">
            </div>
            <div class="entradas-alocacao" style="margin-left: auto;">
                <div class="grupo-entrada-alocacao">
                    <input type="number" class="controle-formulario" id="input-capacidade${contador}" value="${capPadrao}" min="1">
                    <span id="b${contador}">${unidadeCap}</span>
                </div>
            </div>
        </div>
        <div class="sub-linha-alocacao">
            <div class="grupo-limite-alerta" style="margin-left: 0;">
                <label>Atenção:</label>
                <div class="grupo-entrada-alocacao">
                    <input type="number" class="controle-formulario" id="input-atencao${contador}" value="${atencaoPadrao}" min="1" max="100" style="width: 70px;">
                    <span>%</span>
                </div>
                <label style="margin-left: 15px;">Crítico:</label>
                <div class="grupo-entrada-alocacao">
                    <input type="number" class="controle-formulario" id="input-critico${contador}" value="${criticoPadrao}" min="1" max="100" style="width: 70px;">
                    <span>%</span>
                </div>
            </div>
        </div>
    `;

    divPai.append(div);
    contador++;
}

function removerComponente(id) {
    document.getElementById(id).remove();
    inputsLista = inputsLista.filter(item => item !== id);
}

function trocarComplemento(selectElement, spanId) {
    let span = document.getElementById(spanId);
    if (selectElement.value == "cpu") {
        span.innerHTML = "Cores";
    } else if (selectElement.value == "rede") {
        span.innerHTML = "Mbps";
    } else if (selectElement.value == "ram" || selectElement.value == "disco") {
        span.innerHTML = "GB";
    }
}

function cadastrarServidorCompleto() {
    var nomeServidor = document.getElementById("nome_servidor_id").value.trim();

    if (nomeServidor.length == 0 || nomeServidor.length > 45) {
        alert("O nome do servidor deve ter entre 1 e 45 caracteres!");
        return;
    }

    if (inputsLista.length == 0) {
        alert("Adicione pelo menos um componente!");
        return;
    }

    // Validação individual dos componentes e limites de alerta
    for (let i = 0; i < inputsLista.length; i++) {
        let id = inputsLista[i];
        let indice = id.substring(1);
        let componente = document.getElementById(`input${indice}`).value;
        let capacidade = Number(document.getElementById(`input-capacidade${indice}`).value);
        let limiteAtencao = Number(document.getElementById(`input-atencao${indice}`).value);
        let limiteCritico = Number(document.getElementById(`input-critico${indice}`).value);

        let nomeComp = componente.toUpperCase();
        if (componente === "ram") nomeComp = "Memória RAM";
        if (componente === "disco") nomeComp = "Disco SSD";
        if (componente === "rede") nomeComp = "Rede";

        if (!capacidade || capacidade <= 0) {
            alert(`A capacidade do componente ${nomeComp} deve ser maior que zero!`);
            return;
        }

        if (componente === "cpu" && !Number.isInteger(capacidade)) {
            alert(`A quantidade de núcleos da CPU deve ser um número inteiro!`);
            return;
        }

        if (isNaN(limiteAtencao) || limiteAtencao < 1 || limiteAtencao > 100) {
            alert(`O limite de atenção do componente ${nomeComp} deve estar entre 1% e 100%!`);
            return;
        }

        if (isNaN(limiteCritico) || limiteCritico < 1 || limiteCritico > 100) {
            alert(`O limite crítico do componente ${nomeComp} deve estar entre 1% e 100%!`);
            return;
        }

        if (limiteAtencao >= limiteCritico) {
            alert(`No componente ${nomeComp}, o limite de atenção (${limiteAtencao}%) deve ser menor que o limite crítico (${limiteCritico}%)!`);
            return;
        }
    }

    var idEmpresa = sessionStorage.ID_EMPRESA;
    if (!idEmpresa) {
        alert("Sessão inválida ou empresa não identificada. Por favor, realize o login novamente.");
        window.location.href = "/paginas/autenticacao/login/login.html";
        return;
    }

    // 1. Cadastra o Servidor
    fetch("/servidor/cadastrar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            nomeServer: nomeServidor,
            idEmpresaServer: idEmpresa
        })
    })
        .then(async function (resposta) {
            if (!resposta.ok) {
                let msg = await resposta.text();
                throw new Error(msg || "Houve um erro ao cadastrar o servidor!");
            }
            return resposta.json();
        })
        .then(function (dados) {
            let idServidorCadastrado = dados.idServidor;
            console.log("Servidor cadastrado com sucesso! ID:", idServidorCadastrado);

            // 2. Cadastra os Componentes vinculados ao servidor
            let promises = inputsLista.map(id => {
                let indice = id.substring(1);
                let componente = document.getElementById(`input${indice}`).value;
                let capacidade = Number(document.getElementById(`input-capacidade${indice}`).value);
                let limiteAtencao = Number(document.getElementById(`input-atencao${indice}`).value);
                let limiteCritico = Number(document.getElementById(`input-critico${indice}`).value);
                let valorComponente = 0;

                if (componente == "cpu") valorComponente = 1;
                else if (componente == "ram") valorComponente = 2;
                else if (componente == "disco") valorComponente = 3;
                else if (componente == "rede") valorComponente = 4;

                return fetch("/servidor/cadastrar/componente", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        fkServidorServer: idServidorCadastrado,
                        fkComponenteServer: valorComponente,
                        capacidadeServer: capacidade,
                        limiteAtencaoServer: limiteAtencao,
                        limiteCriticoServer: limiteCritico
                    }),
                }).then(res => {
                    if (!res.ok) throw new Error("Erro no componente");
                });
            });

            Promise.all(promises).then(() => {
                alert("Servidor e componentes cadastrados com sucesso!");
                document.getElementById("nome_servidor_id").value = "";
            }).catch(erro => {
                console.log("#ERRO Componentes:", erro);
                alert("Servidor cadastrado, mas houve um erro ao salvar um ou mais componentes.");
            });

        })
        .catch(function (erro) {
            console.log("#ERRO:", erro);
            alert(erro.message || "Erro ao cadastrar servidor.");
        });
}
