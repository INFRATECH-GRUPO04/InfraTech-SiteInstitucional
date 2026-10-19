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
                        var id = servidor.idServidor || servidor.id_servidor;
                        var option = document.createElement("option");
                        option.value = id;
                        option.innerHTML = servidor.nome;
                        select.appendChild(option);
                    }
                });
            }
        }).catch(function(erro) {
            console.error("Erro ao listar servidores:", erro);
        });
}

function buscarComponentes() {
    var idServidor = document.getElementById("servidor_selecionado_id").value;
    var nomeInput = document.getElementById("mod_nome_servidor");

    if (!idServidor || idServidor === "" || idServidor === "undefined") {
        document.getElementById("componentes-lista").innerHTML = "";
        nomeInput.value = "";
        return;
    }

    // Atualiza o nome no input usando o texto selecionado do select
    var select = document.getElementById("servidor_selecionado_id");
    nomeInput.value = select.options[select.selectedIndex].text;

    fetch(`/servidor/listarComponentes/${idServidor}`)
        .then(function(resposta) {
            if (resposta.ok) {
                if (resposta.status == 204) {
                    document.getElementById("componentes-lista").innerHTML = "<p style='color: var(--cor-cinza-claro, #ccc);'>Nenhum componente vinculado a este servidor.</p>";
                    return;
                }
                resposta.json().then(function(componentes) {
                    console.log("Componentes:", componentes);
                    var divLista = document.getElementById("componentes-lista");
                    divLista.innerHTML = "";

                    for (let i = 0; i < componentes.length; i++) {
                        var c = componentes[i];
                        var html = `
                            <div class="linha-componente-novo" data-id="${c.id_componente}">
                                <div class="coluna-componente">
                                    <label>TIPO</label>
                                    <select class="controle-formulario" style="appearance: none; -webkit-appearance: none;" disabled>
                                        <option value="cpu" ${c.tipo == 'cpu' ? 'selected' : ''}>CPU</option>
                                        <option value="ram" ${c.tipo == 'ram' ? 'selected' : ''}>Memória RAM</option>
                                        <option value="disco" ${c.tipo == 'disco' ? 'selected' : ''}>Disco SSD</option>
                                    </select>
                                </div>
                                <div class="coluna-componente">
                                    <label>CAPACIDADE</label>
                                    <div class="grupo-entrada-alocacao">
                                        <input type="number" class="controle-formulario input-mod-capacidade" value="${c.capacidade_total}" style="width: 100%;">
                                        <span>${c.tipo == 'cpu' ? 'Cores' : 'GB'}</span>
                                    </div>
                                </div>
                                <div class="coluna-componente pequena">
                                    <label>ATENÇÃO</label>
                                    <div class="grupo-entrada-alocacao">
                                        <input type="number" class="controle-formulario input-mod-atencao" value="${c.limite_atencao}" min="1" max="100" style="width: 100%;">
                                        <span>%</span>
                                    </div>
                                </div>
                                <div class="coluna-componente pequena">
                                    <label>CRÍTICO</label>
                                    <div class="grupo-entrada-alocacao">
                                        <input type="number" class="controle-formulario input-mod-critico" value="${c.limite_critico}" min="1" max="100" style="width: 100%;">
                                        <span>%</span>
                                    </div>
                                </div>
                            </div>
                        `;
                        divLista.innerHTML += html;
                    }
                });
            }
        }).catch(function(erro) {
            console.error("Erro ao buscar componentes:", erro);
        });
}

function excluirServidor() {
    var idServidor = document.getElementById("servidor_selecionado_id").value;
    if (!idServidor || idServidor === "" || idServidor === "undefined") {
        return alert("Selecione um servidor primeiro.");
    }

    if (confirm("Tem certeza que deseja excluir o servidor e todos os seus componentes vinculados?")) {
        fetch(`/servidor/deletar/${idServidor}`, { method: "DELETE" })
            .then(res => {
                if (res.ok) {
                    alert("Servidor excluído com sucesso!");
                    window.location.reload();
                } else {
                    res.text().then(texto => {
                        alert("Erro ao excluir: " + texto);
                    });
                }
            }).catch(erro => {
                console.error(erro);
                alert("Erro de comunicação ao excluir servidor.");
            });
    }
}

function atualizarServidor() {
    var idServidor = document.getElementById("servidor_selecionado_id").value;
    var nome = document.getElementById("mod_nome_servidor").value.trim();

    if (!idServidor || idServidor === "" || idServidor === "undefined") {
        return alert("Selecione um servidor.");
    }
    if (nome === "") {
        return alert("Preencha o nome do servidor.");
    }

    // Coleta dados dos componentes para atualizar também
    var linhasComponentes = document.querySelectorAll("#componentes-lista .linha-componente-novo");
    var listaComponentes = [];
    linhasComponentes.forEach(function(linha) {
        var idComp = linha.getAttribute("data-id");
        var cap = linha.querySelector(".input-mod-capacidade") ? Number(linha.querySelector(".input-mod-capacidade").value) : null;
        var atencao = linha.querySelector(".input-mod-atencao") ? Number(linha.querySelector(".input-mod-atencao").value) : null;
        var critico = linha.querySelector(".input-mod-critico") ? Number(linha.querySelector(".input-mod-critico").value) : null;

        if (idComp) {
            listaComponentes.push({
                idComponente: idComp,
                capacidade: cap,
                limiteAtencao: atencao,
                limiteCritico: critico
            });
        }
    });

    fetch(`/servidor/editar/${idServidor}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
            nomeServer: nome,
            componentes: listaComponentes
        })
    }).then(res => {
        if (res.ok) {
            alert("Servidor atualizado com sucesso!");
            window.location.reload();
        } else {
            res.text().then(texto => {
                alert("Erro ao atualizar o servidor: " + texto);
            });
        }
    }).catch(erro => {
        console.error(erro);
        alert("Erro de comunicação ao atualizar.");
    });
}
