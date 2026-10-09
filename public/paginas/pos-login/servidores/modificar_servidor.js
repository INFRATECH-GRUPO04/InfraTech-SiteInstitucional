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
                        option.value = servidor.idServidor;
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
        document.getElementById("componentes-lista").innerHTML = "";
        nomeInput.value = "";
        return;
    }

    // Atualiza o nome no input usando o select
    var select = document.getElementById("servidor_selecionado_id");
    nomeInput.value = select.options[select.selectedIndex].text;

    fetch(`/servidor/listarComponentes/${idServidor}`)
        .then(function(resposta) {
            if (resposta.ok) {
                if (resposta.status == 204) {
                    document.getElementById("componentes-lista").innerHTML = "<p>Nenhum componente encontrado.</p>";
                    return;
                }
                resposta.json().then(function(resposta) {
                    console.log("Componentes:", resposta);
                    var divLista = document.getElementById("componentes-lista");
                    divLista.innerHTML = ""; // Limpa a lista atual

                    for (let i = 0; i < resposta.length; i++) {
                        var c = resposta[i];
                        
                        // Cria a div do componente
                        var html = `
                            <div class="linha-componente-novo">
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
                                        <input type="number" class="controle-formulario" value="${c.capacidade_total}" style="width: 100%;">
                                        <span>${c.tipo == 'cpu' ? 'Cores' : 'GB'}</span>
                                    </div>
                                </div>
                                <div class="coluna-componente pequena">
                                    <label>ATENÇÃO</label>
                                    <div class="grupo-entrada-alocacao">
                                        <input type="number" class="controle-formulario" value="${c.limite_atencao}" style="width: 100%;">
                                        <span>%</span>
                                    </div>
                                </div>
                                <div class="coluna-componente pequena">
                                    <label>CRÍTICO</label>
                                    <div class="grupo-entrada-alocacao">
                                        <input type="number" class="controle-formulario" value="${c.limite_critico}" style="width: 100%;">
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
    if(idServidor == "") return alert("Selecione um servidor primeiro.");
    if(confirm("Tem certeza que deseja excluir o servidor e todos seus componentes?")) {
        fetch(`/servidor/deletar/${idServidor}`, { method: "DELETE" })
            .then(res => {
                if(res.ok) {
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
    var nome = document.getElementById("mod_nome_servidor").value;

    if (idServidor == "") return alert("Selecione um servidor.");
    if (nome == "") return alert("Preencha o nome do servidor.");

    fetch(`/servidor/editar/${idServidor}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ nomeServer: nome })
    }).then(res => {
        if (res.ok) {
            alert("Servidor atualizado com sucesso!");
            window.location.reload();
        } else {
            alert("Erro ao atualizar o servidor.");
        }
    });
}
