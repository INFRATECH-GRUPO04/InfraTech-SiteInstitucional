const API_SERVIDOR_TESTE = "/servidorTeste";

let servidorSelecionadoParaTeste = null;
let servidorSelecionadoParaRemover = null;

document.addEventListener("DOMContentLoaded", () => {
    carregarTodasListas();
});

function obterHeaders() {
    const headers = {
        "Content-Type": "application/json"
    };

    const token =
        sessionStorage.getItem("TOKEN_USUARIO") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("token");

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
}

function exibirFeedback(mensagem, tipo = "sucesso") {
    const banner = document.getElementById("banner_feedback");
    banner.textContent = mensagem;
    banner.className = `banner-feedback ${tipo}`;
    banner.hidden = false;

    banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function limparCamposETela() {
    servidorSelecionadoParaTeste = null;
    servidorSelecionadoParaRemover = null;

    document.getElementById("input_novo_nome_teste").value = "";
    document.getElementById("input_novo_nome_padrao").value = "";

    document.querySelectorAll('input[name="radio_servidor_disponivel"]').forEach(r => {
        r.checked = false;
    });
    document.querySelectorAll('input[name="radio_servidor_teste"]').forEach(r => {
        r.checked = false;
    });
    document.querySelectorAll(".item-servidor-opcao").forEach(item => {
        item.classList.remove("selecionado");
    });
}

async function carregarTodasListas() {
    await Promise.all([
        carregarServidoresDisponiveis(),
        carregarServidoresDeTeste()
    ]);
}

/* Busca todos os servidores disponíveis (não marcados como teste) */
async function carregarServidoresDisponiveis() {
    const container = document.getElementById("lista_servidores_disponiveis");

    try {
        const resposta = await fetch(`${API_SERVIDOR_TESTE}/listarServidores`, {
            method: "GET",
            headers: obterHeaders(),
            credentials: "include"
        });

        if (!resposta.ok) {
            throw new Error("Erro ao listar servidores disponíveis.");
        }

        const servidores = await resposta.json();
        renderizarListaServidores(
            container,
            servidores,
            "radio_servidor_disponivel",
            "padrao",
            (servidor, elementoLabel) => {
                servidorSelecionadoParaTeste = servidor.id_servidor;
                document.getElementById("input_novo_nome_teste").value = `${servidor.nome}-TESTE`;

                container.querySelectorAll(".item-servidor-opcao").forEach(el => el.classList.remove("selecionado"));
                elementoLabel.classList.add("selecionado");
            }
        );
    } catch (erro) {
        console.error(erro);
        container.innerHTML = `<p class="texto-vazio">Não foi possível carregar os servidores.</p>`;
    }
}

/*Busca todos os servidores atualmente definidos como teste */
async function carregarServidoresDeTeste() {
    const container = document.getElementById("lista_servidores_teste");

    try {
        const resposta = await fetch(`${API_SERVIDOR_TESTE}/listarServidoresTeste`, {
            method: "GET",
            headers: obterHeaders(),
            credentials: "include"
        });

        if (!resposta.ok) {
            throw new Error("Erro ao listar servidores de teste.");
        }

        const servidoresTeste = await resposta.json();
        renderizarListaServidores(
            container,
            servidoresTeste,
            "radio_servidor_teste",
            "teste",
            (servidor, elementoLabel) => {
                servidorSelecionadoParaRemover = servidor.id_servidor;
                document.getElementById("input_novo_nome_padrao").value = servidor.nome.replace(/-TESTE$/i, "");

                container.querySelectorAll(".item-servidor-opcao").forEach(el => el.classList.remove("selecionado"));
                elementoLabel.classList.add("selecionado");
            }
        );
    } catch (erro) {
        console.error(erro);
        container.innerHTML = `<p class="texto-vazio">Não foi possível carregar os servidores de teste.</p>`;
    }
}

function renderizarListaServidores(container, lista, nomeGrupoRadio, tipoBadge, aoSelecionar) {
    container.innerHTML = "";

    if (!Array.isArray(lista) || lista.length === 0) {
        const msg = tipoBadge === "teste"
            ? "Nenhum servidor de teste ativo no momento."
            : "Nenhum servidor disponível encontrado.";
        container.innerHTML = `<p class="texto-vazio">${msg}</p>`;
        return;
    }

    lista.forEach((servidor) => {
        const label = document.createElement("label");
        label.className = "item-servidor-opcao";

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = nomeGrupoRadio;
        radio.value = servidor.id_servidor;

        const info = document.createElement("div");
        info.className = "info-servidor-opcao";

        const bolinha = document.createElement("span");
        bolinha.className = "radio-bolinha";

        const detalhes = document.createElement("div");
        detalhes.className = "detalhes-servidor-opcao";

        const nomeSpan = document.createElement("span");
        nomeSpan.className = "nome-servidor-opcao";
        nomeSpan.textContent = servidor.nome;

        const metaSpan = document.createElement("span");
        metaSpan.className = "meta-servidor-opcao";
        metaSpan.textContent = `ID #${servidor.id_servidor} • ${servidor.localizacao || "Local não informado"}`;

        detalhes.appendChild(nomeSpan);
        detalhes.appendChild(metaSpan);

        info.appendChild(bolinha);
        info.appendChild(detalhes);

        const badge = document.createElement("span");
        badge.className = `badge-servidor ${tipoBadge}`;
        badge.textContent = tipoBadge === "teste" ? "Em Teste" : "Padrão";

        label.appendChild(radio);
        label.appendChild(info);
        label.appendChild(badge);

        radio.addEventListener("change", () => {
            if (radio.checked) {
                aoSelecionar(servidor, label);
            }
        });

        container.appendChild(label);
    });
}

/*Envia atualização para definir o servidor escolhido como Servidor de Teste */
async function definirServidorTeste() {
    const novoNome = document.getElementById("input_novo_nome_teste").value.trim();

    if (!servidorSelecionadoParaTeste) {
        exibirFeedback("Selecione um servidor na lista antes de confirmar.", "erro");
        return;
    }

    if (!novoNome) {
        exibirFeedback("Informe o novo nome para o servidor de teste.", "erro");
        return;
    }

    try {
        const resposta = await fetch(`${API_SERVIDOR_TESTE}/definirTeste/${servidorSelecionadoParaTeste}`, {
            method: "PUT",
            headers: obterHeaders(),
            credentials: "include",
            body: JSON.stringify({ novoNome })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            exibirFeedback(dados.erro || "Não foi possível definir o servidor de teste.", "erro");
            return;
        }

        exibirFeedback(dados.mensagem || "Concluído! Servidor definido como teste com sucesso.", "sucesso");
        limparCamposETela();
        await carregarTodasListas();
    } catch (erro) {
        console.error(erro);
        exibirFeedback("Erro de comunicação ao definir o servidor de teste.", "erro");
    }
}

/*Envia atualização para remover o status de teste e renomear o servidor */
async function removerServidorTeste() {
    const novoNome = document.getElementById("input_novo_nome_padrao").value.trim();

    if (!servidorSelecionadoParaRemover) {
        exibirFeedback("Selecione um servidor de teste na lista para remover.", "erro");
        return;
    }

    if (!novoNome) {
        exibirFeedback("Informe o novo nome do servidor após a remoção de teste.", "erro");
        return;
    }

    try {
        const resposta = await fetch(`${API_SERVIDOR_TESTE}/removerTeste/${servidorSelecionadoParaRemover}`, {
            method: "PUT",
            headers: obterHeaders(),
            credentials: "include",
            body: JSON.stringify({ novoNome })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            exibirFeedback(dados.erro || "Não foi possível remover o servidor de teste.", "erro");
            return;
        }

        exibirFeedback(dados.mensagem || "Concluído! Servidor removido de teste e renomeado com sucesso.", "sucesso");
        limparCamposETela();
        await carregarTodasListas();
    } catch (erro) {
        console.error(erro);
        exibirFeedback("Erro de comunicação ao remover o servidor de teste.", "erro");
    }
}