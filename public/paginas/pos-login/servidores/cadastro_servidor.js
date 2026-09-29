let contador = 0;
let inputsLista = [];

window.onload = function () {
    adicionarComponente("cpu");
    adicionarComponente("ram");
    adicionarComponente("disco");
};

function adicionarComponente(tipoInit = "cpu") {
    const divPai = document.getElementById("alinhar");
    const div = document.createElement("div");
    div.id = `a${contador}`;
    div.className = "caixa-alocacao";
    inputsLista.push(div.id);

    let isCpu = tipoInit === "cpu";

    div.innerHTML = `
        <div class="linha-alocacao">
            <div class="rotulo-alocacao">
                <select class="controle-formulario" style="width: 100%; border: none; background-color: transparent; padding: 0; font-weight: bold; color: white;" id="input${contador}" disabled>
                    <option value="cpu" ${tipoInit === 'cpu' ? 'selected' : ''}>CPU</option>
                    <option value="ram" ${tipoInit === 'ram' ? 'selected' : ''}>Memória RAM</option>
                    <option value="disco" ${tipoInit === 'disco' ? 'selected' : ''}>Disco SSD</option>
                </select>
            </div>
            <div class="entradas-alocacao" style="margin-left: auto;">
                <div class="grupo-entrada-alocacao">
                    <input type="number" class="controle-formulario" id="input-capacidade${contador}" value="${isCpu ? 8 : (tipoInit === 'ram' ? 32 : 1000)}" min="1">
                    <span id="b${contador}">${isCpu ? 'Cores' : 'GB'}</span>
                </div>
            </div>
        </div>
        <div class="sub-linha-alocacao">
            <div class="grupo-limite-alerta" style="margin-left: 0;">
                <label>Atenção:</label>
                <div class="grupo-entrada-alocacao">
                    <input type="number" class="controle-formulario" id="input-atencao${contador}" value="${isCpu ? 75 : 80}" min="1" max="100" style="width: 70px;">
                    <span>%</span>
                </div>
                <label style="margin-left: 15px;">Crítico:</label>
                <div class="grupo-entrada-alocacao">
                    <input type="number" class="controle-formulario" id="input-critico${contador}" value="${isCpu ? 90 : 95}" min="1" max="100" style="width: 70px;">
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

    // 1. Cadastra o Servidor
    fetch("/servidor/cadastrar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            nomeServer: nomeServidor,
            idEmpresaServer: sessionStorage.ID_EMPRESA || 1 // fallback
        })
    })
        .then(function (resposta) {
            if (!resposta.ok) {
                throw new Error("Houve um erro ao cadastrar o servidor!");
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
                window.location.href = "modificar_servidor.html";
            }).catch(erro => {
                console.log("#ERRO Componentes:", erro);
                alert("Servidor cadastrado, mas houve um erro ao salvar um ou mais componentes.");
            });

        })
        .catch(function (erro) {
            console.log("#ERRO:", erro);
            alert("Erro ao cadastrar servidor.");
        });
}
