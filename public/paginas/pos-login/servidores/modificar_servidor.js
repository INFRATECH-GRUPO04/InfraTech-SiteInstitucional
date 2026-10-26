let listaComponentesServidor = [];

function listarServidores() {
    validarSessao();
    var idEmpresa = sessionStorage.ID_EMPRESA || 1;

    fetch(`/servidor/listar/${idEmpresa}`)
        .then(function(resposta) {
            if (resposta.ok) {
                if (resposta.status == 204) {
                    console.log("Nenhum servidor encontrado.");
                    return;
                }
                resposta.json().then(function(resposta) {
                    console.log("Servidores:", resposta);
                    
                    var select = document.getElementById("servidor_selecionado_id");
                    select.innerHTML = '<option value="">Selecione um servidor...</option>';
                    
                    for (let i = 0; i < resposta.length; i++) {
                        var servidor = resposta[i];
                        var option = document.createElement("option");
                        option.value = servidor.id_servidor || servidor.idServidor;
                        option.innerHTML = servidor.nome;
                        select.appendChild(option);
                    }
                });
            }
        });
}

function buscarComponentes() {
    var idServidor = document.getElementById("servidor_selecionado_id").value;
    var nomeInput = document.getElementById("mod_nome_servidor");

    if (idServidor == "") {
        document.getElementById("componentes-lista").innerHTML = `
            <div class="estado-vazio" style="grid-column: 1 / -1; text-align: center; padding: 32px 16px; border: 1px dashed var(--cor-borda); border-radius: var(--raio); color: var(--cor-texto-suave);">
                <p style="margin: 0; font-size: 0.95rem;">Selecione um servidor acima para visualizar e gerenciar seus recursos.</p>
            </div>
        `;
        nomeInput.value = "";
        listaComponentesServidor = [];
        return;
    }

    // Atualiza o nome no input usando o select
    var select = document.getElementById("servidor_selecionado_id");
    nomeInput.value = select.options[select.selectedIndex].text;

    fetch(`/servidor/listarComponentes/${idServidor}`)
        .then(function(resposta) {
            if (resposta.ok) {
                if (resposta.status == 204) {
                    document.getElementById("componentes-lista").innerHTML = `
                        <div class="estado-vazio" style="grid-column: 1 / -1; text-align: center; padding: 24px 16px; border: 1px dashed var(--cor-borda); border-radius: var(--raio); color: var(--cor-texto-suave);">
                            <p style="margin: 0; font-size: 0.9rem;">Nenhum componente vinculado a este servidor.</p>
                        </div>
                    `;
                    listaComponentesServidor = [];
                    return;
                }
                resposta.json().then(function(resposta) {
                    console.log("Componentes:", resposta);
                    listaComponentesServidor = resposta;
                    var divLista = document.getElementById("componentes-lista");
                    divLista.innerHTML = ""; // Limpa a lista atual

                    for (let i = 0; i < resposta.length; i++) {
                        var c = resposta[i];
                        var tipoNorm = String(c.tipo || "").toLowerCase().trim();

                        var nomeTipoFormatado = "CPU";
                        var rotuloCapacidade = "NÚCLEOS (CORES)";
                        var unidadePadrao = "Cores";

                        if (tipoNorm === "ram") {
                            nomeTipoFormatado = "Memória RAM";
                            rotuloCapacidade = "MEMÓRIA TOTAL";
                            unidadePadrao = "GB";
                        } else if (tipoNorm === "disco") {
                            nomeTipoFormatado = "Disco SSD";
                            rotuloCapacidade = "ARMAZENAMENTO";
                            unidadePadrao = "GB";
                        } else if (tipoNorm === "rede") {
                            nomeTipoFormatado = "Rede";
                            rotuloCapacidade = "LARGURA DE BANDA";
                            unidadePadrao = "Mbps";
                        }
                        
                        var html = `
                            <div class="linha-componente-novo" id="linha-comp-${c.id_componente}">
                                <div class="coluna-componente">
                                    <label>TIPO</label>
                                    <span class="rotulo-componente-texto" style="padding: 10px 0;">${nomeTipoFormatado}</span>
                                </div>
                                <div class="coluna-componente">
                                    <label>${rotuloCapacidade}</label>
                                    <div class="grupo-entrada-alocacao">
                                        <input type="number" class="controle-formulario" id="capacidade-comp-${c.id_componente}" value="${c.capacidade_total}" min="1" style="width: 100%;">
                                        <span>${c.unidade_capacidade || unidadePadrao}</span>
                                    </div>
                                </div>
                                <div class="coluna-componente pequena">
                                    <label>ATENÇÃO</label>
                                    <div class="grupo-entrada-alocacao">
                                        <input type="number" class="controle-formulario" id="atencao-comp-${c.id_componente}" value="${c.limite_atencao || ''}" min="1" max="100" style="width: 100%;">
                                        <span>%</span>
                                    </div>
                                </div>
                                <div class="coluna-componente pequena">
                                    <label>CRÍTICO</label>
                                    <div class="grupo-entrada-alocacao">
                                        <input type="number" class="controle-formulario" id="critico-comp-${c.id_componente}" value="${c.limite_critico || ''}" min="1" max="100" style="width: 100%;">
                                        <span>%</span>
                                    </div>
                                </div>
                            </div>
                        `;
                        divLista.innerHTML += html;
                    }
                });
            }
        });
}

function excluirServidor() {
    var idServidor = document.getElementById("servidor_selecionado_id").value;
    if (idServidor == "") return alert("Selecione um servidor primeiro.");
    if (confirm("Tem certeza que deseja excluir o servidor e todos seus componentes?")) {
        fetch(`/servidor/deletar/${idServidor}`, { method: "DELETE" })
            .then(res => {
                if (res.ok) {
                    alert("Excluído com sucesso!");
                    window.location.reload();
                } else {
                    alert("Erro ao excluir.");
                }
            });
    }
}

function atualizarServidor() {
    var idServidor = document.getElementById("servidor_selecionado_id").value;
    var nome = document.getElementById("mod_nome_servidor").value.trim();

    if (idServidor == "") return alert("Selecione um servidor.");
    if (nome == "") return alert("Preencha o nome do servidor.");

    // Validações dos componentes alterados
    var updatesComponentes = [];
    for (let i = 0; i < listaComponentesServidor.length; i++) {
        let c = listaComponentesServidor[i];
        let inputCap = document.getElementById(`capacidade-comp-${c.id_componente}`);
        let inputAtencao = document.getElementById(`atencao-comp-${c.id_componente}`);
        let inputCritico = document.getElementById(`critico-comp-${c.id_componente}`);

        if (inputCap) {
            let cap = Number(inputCap.value);
            let atencao = inputAtencao ? Number(inputAtencao.value) : undefined;
            let critico = inputCritico ? Number(inputCritico.value) : undefined;

            let tipoNorm = String(c.tipo || "").toLowerCase().trim();
            let nomeComp = "CPU";
            if (tipoNorm === "ram") nomeComp = "Memória RAM";
            else if (tipoNorm === "disco") nomeComp = "Disco SSD";
            else if (tipoNorm === "rede") nomeComp = "Rede";

            if (!cap || cap <= 0) {
                return alert(`A capacidade do componente ${nomeComp} deve ser maior que zero!`);
            }

            if (atencao !== undefined && critico !== undefined && !isNaN(atencao) && !isNaN(critico)) {
                if (atencao < 1 || atencao > 100 || critico < 1 || critico > 100) {
                    return alert(`Os limites do componente ${nomeComp} devem estar entre 1% e 100%!`);
                }
                if (atencao >= critico) {
                    return alert(`No componente ${nomeComp}, o limite de atenção (${atencao}%) deve ser menor que o crítico (${critico}%)!`);
                }
            }

            updatesComponentes.push({
                idComponente: c.id_componente,
                idMetrica: c.id_metrica,
                capacidade: cap,
                limiteAtencao: atencao,
                limiteCritico: critico
            });
        }
    }

    // 1. Atualiza o nome do servidor
    fetch(`/servidor/editar/${idServidor}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ nomeServer: nome })
    }).then(async res => {
        if (!res.ok) {
            let msg = await res.text();
            throw new Error(msg || "Erro ao atualizar o servidor.");
        }

        // 2. Atualiza cada um dos componentes e métricas
        let promises = updatesComponentes.map(comp => {
            return fetch(`/servidor/editar/componente/${comp.idComponente}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    capacidadeServer: comp.capacidade,
                    idMetricaServer: comp.idMetrica,
                    limiteAtencaoServer: comp.limiteAtencao,
                    limiteCriticoServer: comp.limiteCritico
                })
            }).then(r => {
                if (!r.ok) throw new Error("Erro ao atualizar componente");
            });
        });

        Promise.all(promises).then(() => {
            alert("Servidor e componentes atualizados com sucesso!");
            window.location.reload();
        }).catch(err => {
            console.error("#ERRO:", err);
            alert("Servidor atualizado, mas ocorreu um erro ao salvar alterações dos componentes.");
        });

    }).catch(err => {
        console.error("#ERRO:", err);
        alert(err.message || "Erro ao atualizar o servidor.");
    });
}
