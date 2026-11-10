/*
 * Controla a tela de manutenção de servidores. Carrega os servidores da empresa
 * autenticada, mostra componentes e permite salvar capacidade, limites e nome,
 * além de excluir um servidor com seus registros dependentes.
 */
let listaComponentesServidor = [];
let listaServidoresCadastrados = [];

/* Mostra uma mensagem simples dentro da área de componentes quando não há dados
 * para apresentar ou quando uma consulta à API falha.
 */
function mostrarEstadoComponentes(mensagem) {
    const lista = document.getElementById("componentes-lista");
    const estado = document.createElement("div");
    const texto = document.createElement("p");
    estado.className = "estado-vazio";
    estado.style.gridColumn = "1 / -1";
    estado.style.textAlign = "center";
    estado.style.padding = "32px 16px";
    estado.style.border = "1px dashed var(--cor-borda)";
    estado.style.borderRadius = "var(--raio)";
    estado.style.color = "var(--cor-texto-suave)";
    texto.style.margin = "0";
    texto.textContent = mensagem;
    estado.appendChild(texto);
    lista.replaceChildren(estado);
}

/* Faz uma chamada autenticada à API e transforma respostas de erro em mensagens
 * legíveis, preservando também respostas sem conteúdo como o status 204.
 */
async function chamarApiServidor(caminho, opcoes) {
    const resposta = await fetch(caminho, Object.assign({ credentials: "same-origin" }, opcoes || {}));
    if (resposta.status === 204) return null;
    const texto = await resposta.text();
    let dados = null;
    try {
        dados = texto ? JSON.parse(texto) : null;
    } catch (erro) {
        dados = texto;
    }
    if (!resposta.ok) {
        const mensagem = dados && typeof dados === "object" ? dados.erro || dados.mensagem : dados;
        throw new Error(mensagem || "Não foi possível concluir a operação.");
    }
    return dados;
}

/* Busca a lista restrita à empresa da sessão e preenche o seletor. A empresa
 * não é escolhida pelo formulário: o backend confirma esse vínculo no cookie.
 */
async function listarServidores() {
    const seletor = document.getElementById("servidor_selecionado_id");
    const usuario = await carregarSessaoConfiavel();
    if (!usuario) {
        window.location.replace("/paginas/autenticacao/login/login.html");
        mostrarEstadoComponentes("Sua sessão expirou. Entre novamente para carregar os servidores.");
        return;
    }

    try {
        const servidores = await chamarApiServidor(`/servidor/listar/${encodeURIComponent(usuario.idEmpresa)}`);
        listaServidoresCadastrados = servidores || [];
        seletor.replaceChildren(new Option("Selecione um servidor...", ""));
        if (!servidores || !servidores.length) {
            mostrarEstadoComponentes("Nenhum servidor está cadastrado nesta empresa.");
            return;
        }
        servidores.forEach(function (servidor) {
            const opcao = new Option(servidor.nome, servidor.id_servidor || servidor.idServidor);
            seletor.add(opcao);
        });
        mostrarEstadoComponentes("Selecione um servidor acima para visualizar e gerenciar seus recursos.");
    } catch (erro) {
        mostrarEstadoComponentes(erro.message || "Não foi possível carregar os servidores.");
    }
}

/* Cria os campos editáveis de um componente usando elementos DOM e textContent.
 * Assim, os valores vindos do banco não são interpretados como marcação HTML.
 */
function criarLinhaComponente(componente) {
    const tipo = String(componente.tipo || "cpu").toLowerCase().trim();
    const dadosTipo = {
        cpu: { nome: "CPU", capacidade: "NÚCLEOS (CORES)", unidade: "Cores" },
        ram: { nome: "Memória RAM", capacidade: "MEMÓRIA TOTAL", unidade: "GB" },
        disco: { nome: "Disco SSD", capacidade: "ARMAZENAMENTO", unidade: "GB" },
        rede: { nome: "Rede", capacidade: "LARGURA DE BANDA", unidade: "Mbps" }
    }[tipo] || { nome: tipo.toUpperCase(), capacidade: "CAPACIDADE", unidade: "" };

    const linha = document.createElement("div");
    linha.className = "linha-componente-novo";
    linha.id = `linha-comp-${componente.id_componente}`;
    const criarColuna = function (rotulo, id, valor, unidade, minimo, maximo) {
        const coluna = document.createElement("div");
        const label = document.createElement("label");
        const grupo = document.createElement("div");
        const input = document.createElement("input");
        coluna.className = "coluna-componente";
        label.textContent = rotulo;
        input.type = "number";
        input.className = "controle-formulario";
        input.id = id;
        input.value = valor == null ? "" : valor;
        input.min = minimo;
        if (maximo != null) input.max = maximo;
        grupo.className = "grupo-entrada-alocacao";
        grupo.append(input);
        if (unidade) {
            const sufixo = document.createElement("span");
            sufixo.textContent = unidade;
            grupo.append(sufixo);
        }
        coluna.append(label, grupo);
        return coluna;
    };

    const tipoColuna = document.createElement("div");
    const tipoLabel = document.createElement("label");
    const tipoTexto = document.createElement("span");
    tipoColuna.className = "coluna-componente";
    tipoLabel.textContent = "TIPO";
    tipoTexto.className = "rotulo-componente-texto";
    tipoTexto.textContent = dadosTipo.nome;
    tipoColuna.append(tipoLabel, tipoTexto);
    linha.append(tipoColuna);
    linha.append(criarColuna(dadosTipo.capacidade, `capacidade-comp-${componente.id_componente}`, componente.capacidade_total, componente.unidade_capacidade || dadosTipo.unidade, 1));

    const atencao = criarColuna("ATENÇÃO", `atencao-comp-${componente.id_componente}`, componente.limite_atencao, "%", 0, 100);
    atencao.classList.add("pequena");
    const critico = criarColuna("CRÍTICO", `critico-comp-${componente.id_componente}`, componente.limite_critico, "%", 1, 100);
    critico.classList.add("pequena");
    linha.append(atencao, critico);
    return linha;
}

/* Consulta os componentes do servidor escolhido e monta seus campos. Ao limpar
 * a seleção, restaura o estado inicial e evita salvar dados de outro servidor.
 */
async function buscarComponentes() {
    const idServidor = document.getElementById("servidor_selecionado_id").value;
    const seletor = document.getElementById("servidor_selecionado_id");
    const nomeInput = document.getElementById("mod_nome_servidor");
    const locInput = document.getElementById("mod_localizacao_servidor");
    listaComponentesServidor = [];

    const campoChave = document.getElementById("chave_servidor_input");
    const btnCopiar = document.getElementById("btn_copiar_chave");
    if (campoChave) {
        campoChave.value = "";
        campoChave.placeholder = idServidor 
            ? "Clique em 'Gerar Nova Chave' para gerar a credencial" 
            : "Selecione um servidor e clique em 'Gerar Nova Chave'";
    }
    if (btnCopiar) btnCopiar.disabled = true;

    if (!idServidor) {
        nomeInput.value = "";
        if (locInput) locInput.value = "";
        mostrarEstadoComponentes("Selecione um servidor acima para visualizar e gerenciar seus recursos.");
        return;
    }

    const servidorAtual = listaServidoresCadastrados.find(s => String(s.id_servidor || s.idServidor) === String(idServidor));
    nomeInput.value = seletor.options[seletor.selectedIndex].text;
    if (locInput) {
        locInput.value = (servidorAtual && servidorAtual.localizacao) || "";
    }
    mostrarEstadoComponentes("Carregando componentes do servidor...");
    try {
        const componentes = await chamarApiServidor(`/servidor/listarComponentes/${encodeURIComponent(idServidor)}`);
        listaComponentesServidor = componentes || [];
        if (!listaComponentesServidor.length) {
            mostrarEstadoComponentes("Nenhum componente está vinculado a este servidor.");
            return;
        }
        document.getElementById("componentes-lista").replaceChildren(
            ...listaComponentesServidor.map(criarLinhaComponente)
        );
    } catch (erro) {
        mostrarEstadoComponentes(erro.message || "Não foi possível carregar os componentes.");
    }
}

/* Valida todos os campos antes de iniciar gravações. Isso evita salvar o nome
 * e só depois descobrir que algum limite ou capacidade preenchido era inválido.
 */
function coletarAlteracoesComponentes() {
    return listaComponentesServidor.map(function (componente) {
        const capacidade = Number(document.getElementById(`capacidade-comp-${componente.id_componente}`).value);
        const atencao = Number(document.getElementById(`atencao-comp-${componente.id_componente}`).value);
        const critico = Number(document.getElementById(`critico-comp-${componente.id_componente}`).value);
        if (!Number.isFinite(capacidade) || capacidade <= 0) {
            throw new Error(`A capacidade de ${componente.tipo} deve ser maior que zero.`);
        }
        if (!Number.isInteger(atencao) || !Number.isInteger(critico)
            || atencao < 0 || critico > 100 || atencao >= critico) {
            throw new Error(`Em ${componente.tipo}, o limite de atenção deve ser menor que o crítico e ambos devem estar entre 0% e 100%.`);
        }
        if (!componente.id_metrica) {
            throw new Error(`Não há métrica cadastrada para o componente ${componente.tipo}.`);
        }
        return {
            idComponente: componente.id_componente,
            idMetrica: componente.id_metrica,
            capacidade: capacidade,
            limiteAtencao: atencao,
            limiteCritico: critico
        };
    });
}

/* Salva o nome e, depois, as capacidades e limites dos componentes. Se alguma
 * atualização parcial falhar, informa isso explicitamente para a pessoa revisar.
 */
async function atualizarServidor() {
    const idServidor = document.getElementById("servidor_selecionado_id").value;
    const nome = document.getElementById("mod_nome_servidor").value.trim();
    const localizacao = document.getElementById("mod_localizacao_servidor") 
        ? document.getElementById("mod_localizacao_servidor").value.trim() 
        : "";
    if (!idServidor) return alert("Selecione um servidor.");
    if (!nome) return alert("Preencha o nome do servidor.");

    let alteracoes;
    try {
        alteracoes = coletarAlteracoesComponentes();
    } catch (erro) {
        return alert(erro.message);
    }

    try {
        await chamarApiServidor(`/servidor/editar/${encodeURIComponent(idServidor)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nomeServer: nome, localizacaoServer: localizacao })
        });
        await Promise.all(alteracoes.map(function (componente) {
            return chamarApiServidor(`/servidor/editar/componente/${encodeURIComponent(componente.idComponente)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    capacidadeServer: componente.capacidade,
                    idMetricaServer: componente.idMetrica,
                    limiteAtencaoServer: componente.limiteAtencao,
                    limiteCriticoServer: componente.limiteCritico
                })
            });
        }));
        alert("Servidor e componentes atualizados com sucesso.");
        await listarServidores();
        document.getElementById("servidor_selecionado_id").value = idServidor;
        await buscarComponentes();
    } catch (erro) {
        alert(erro.message || "Não foi possível salvar todas as alterações. Confira os dados e tente novamente.");
    }
}

/* Pede confirmação antes de apagar o servidor. A API remove também os registros
 * dependentes e verifica no backend se o servidor pertence à empresa da sessão.
 */
async function excluirServidor() {
    const seletor = document.getElementById("servidor_selecionado_id");
    const idServidor = seletor.value;
    if (!idServidor) return alert("Selecione um servidor primeiro.");
    const nome = seletor.options[seletor.selectedIndex].text;
    if (!confirm(`Tem certeza que deseja excluir ${nome} e seus componentes? Esta ação não pode ser desfeita.`)) return;

    try {
        await chamarApiServidor(`/servidor/deletar/${encodeURIComponent(idServidor)}`, { method: "DELETE" });
        alert("Servidor excluído com sucesso.");
        document.getElementById("mod_nome_servidor").value = "";
        if (document.getElementById("mod_localizacao_servidor")) {
            document.getElementById("mod_localizacao_servidor").value = "";
        }
        await listarServidores();
    } catch (erro) {
        alert(erro.message || "Não foi possível excluir o servidor.");
    }
}

/* Solicita a geração de uma nova chave/token para o servidor selecionado */
async function gerarChaveServidor() {
    const idServidor = document.getElementById("servidor_selecionado_id").value;
    if (!idServidor) {
        return alert("Selecione um servidor primeiro para gerar a chave de acesso.");
    }

    if (!confirm("Gerar uma nova chave invalidará a chave anterior do script de coleta deste servidor. Deseja continuar?")) {
        return;
    }

    try {
        const dados = await chamarApiServidor(`/servidor/atualizar-chave/${encodeURIComponent(idServidor)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });

        const campoChave = document.getElementById("chave_servidor_input");
        campoChave.value = dados.chave;
        const btnCopiar = document.getElementById("btn_copiar_chave");
        if (btnCopiar) btnCopiar.disabled = false;

        alert("Chave gerada com sucesso! Copie agora e insira na configuração do script de coleta local.");
    } catch (erro) {
        alert(erro.message || "Erro ao gerar a chave do servidor.");
    }
}

/* Copia o token gerado para a área de transferência */
function copiarChaveServidor() {
    const campoChave = document.getElementById("chave_servidor_input");
    const chave = campoChave ? campoChave.value : "";
    if (!chave) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(chave).then(() => {
            alert("Chave copiada para a área de transferência!");
        }).catch(() => {
            campoChave.select();
            document.execCommand("copy");
            alert("Chave copiada para a área de transferência!");
        });
    } else {
        campoChave.select();
        document.execCommand("copy");
        alert("Chave copiada para a área de transferência!");
    }
}

/* Carrega os servidores assim que o navegador termina de montar a página. */
window.addEventListener("load", listarServidores);
