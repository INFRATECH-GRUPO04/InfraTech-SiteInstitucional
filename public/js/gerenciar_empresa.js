(function () {
    "use strict";

    // Só o login interno (Admin) usa esta página
    if (sessionStorage.TIPO_ACESSO !== "ADMIN") {
        window.location.replace("../index.html");
        return;
    }

    var API = "/gerenciar-empresa";

    var UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
        "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

    // chave = nome do campo na resposta da API; o envio usa chave + "Server"
    var CAMPOS = [
        { id: "ed_razao", chave: "razaoSocial", rotulo: "Razão social" },
        { id: "ed_fantasia", chave: "nomeFantasia", rotulo: "Nome fantasia" },
        { id: "ed_cnpj", chave: "cnpj", rotulo: "CNPJ" },
        { id: "ed_segmento", chave: "segmentoAtuacao", rotulo: "Segmento de atuação" },
        { id: "ed_email", chave: "email", rotulo: "E-mail" },
        { id: "ed_telefone", chave: "telefone", rotulo: "Telefone" },
        { id: "ed_cep", chave: "cep", rotulo: "CEP" },
        { id: "ed_logradouro", chave: "logradouro", rotulo: "Logradouro" },
        { id: "ed_numero", chave: "numero", rotulo: "Número" },
        { id: "ed_complemento", chave: "complemento", rotulo: "Complemento" },
        { id: "ed_bairro", chave: "bairro", rotulo: "Bairro" },
        { id: "ed_cidade", chave: "cidade", rotulo: "Cidade" },
        { id: "ed_estado", chave: "estado", rotulo: "UF" }
    ];

    var empresas = [];
    var abaAtual = 1;
    var termoBusca = "";
    var empresaEmEdicao = null;
    var detalhesSolicitado = null;
    var acaoConfirmar = null;
    var confirmando = false;
    var timerToast = null;

    var corpoTabela = document.getElementById("corpo_tabela");
    var areaTabela = document.getElementById("area_tabela");
    var estadoVazio = document.getElementById("estado_vazio");
    var estadoTitulo = document.getElementById("estado_titulo");
    var estadoTexto = document.getElementById("estado_texto");
    var btnRecarregar = document.getElementById("btn_recarregar");
    var contAtivas = document.getElementById("cont_ativas");
    var contDesativadas = document.getElementById("cont_desativadas");
    var iptBusca = document.getElementById("ipt_busca");

    var dlgDetalhes = document.getElementById("dlg_detalhes");
    var detalhesCorpo = document.getElementById("detalhes_corpo");
    var btnDetalhesEditar = document.getElementById("btn_detalhes_editar");

    var dlgEditar = document.getElementById("dlg_editar");
    var formEdicao = document.getElementById("form_edicao");
    var edicaoAviso = document.getElementById("edicao_aviso");

    var dlgConfirmar = document.getElementById("dlg_confirmar");
    var confirmarTitulo = document.getElementById("confirmar_titulo");
    var confirmarTexto = document.getElementById("confirmar_texto");
    var confirmarLista = document.getElementById("confirmar_lista");
    var confirmarErro = document.getElementById("confirmar_erro");
    var btnConfirmarOk = document.getElementById("btn_confirmar_ok");
    var btnConfirmarCancelar = document.getElementById("btn_confirmar_cancelar");

    var toast = document.getElementById("toast");

    // ---------- utilitários ----------

    function criar(tag, classe, texto) {
        var el = document.createElement(tag);
        if (classe) {
            el.className = classe;
        }
        if (texto !== undefined && texto !== null) {
            el.textContent = texto;
        }
        return el;
    }

    function apenasDigitos(valor) {
        return String(valor == null ? "" : valor).replace(/\D/g, "");
    }

    function semAcento(texto) {
        return String(texto == null ? "" : texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }

    function mascaraCnpj(valor) {
        var d = apenasDigitos(valor).slice(0, 14);
        var s = d.slice(0, 2);
        if (d.length > 2) { s += "." + d.slice(2, 5); }
        if (d.length > 5) { s += "." + d.slice(5, 8); }
        if (d.length > 8) { s += "/" + d.slice(8, 12); }
        if (d.length > 12) { s += "-" + d.slice(12, 14); }
        return s;
    }

    function mascaraTelefone(valor) {
        var d = apenasDigitos(valor).slice(0, 11);
        if (d.length === 0) {
            return "";
        }
        var s = "(" + d.slice(0, 2);
        if (d.length > 2) { s += ") "; }
        if (d.length <= 10) {
            s += d.slice(2, 6);
            if (d.length > 6) { s += "-" + d.slice(6); }
        } else {
            s += d.slice(2, 7) + "-" + d.slice(7);
        }
        return s;
    }

    function mascaraCep(valor) {
        var d = apenasDigitos(valor).slice(0, 8);
        return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
    }

    function mascaraCpf(valor) {
        var d = apenasDigitos(valor).slice(0, 11);
        var s = d.slice(0, 3);
        if (d.length > 3) { s += "." + d.slice(3, 6); }
        if (d.length > 6) { s += "." + d.slice(6, 9); }
        if (d.length > 9) { s += "-" + d.slice(9, 11); }
        return s;
    }

    function formatarData(valor) {
        if (!valor) {
            return "";
        }
        var data = new Date(valor);
        return isNaN(data.getTime()) ? "" : data.toLocaleDateString("pt-BR");
    }

    function cnpjValido(cnpj) {
        if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
            return false;
        }

        function digito(base) {
            var pesos = base.length === 12
                ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
                : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
            var soma = 0;
            for (var i = 0; i < base.length; i++) {
                soma += Number(base.charAt(i)) * pesos[i];
            }
            var resto = soma % 11;
            return resto < 2 ? 0 : 11 - resto;
        }

        var d1 = digito(cnpj.substring(0, 12));
        var d2 = digito(cnpj.substring(0, 12) + d1);
        return Number(cnpj.charAt(12)) === d1 && Number(cnpj.charAt(13)) === d2;
    }

    function emailValido(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function estaAtiva(empresa) {
        return Number(empresa.status) === 1;
    }

    // ---------- API ----------

    async function chamarApi(metodo, caminho, corpo) {
        var resposta;

        try {
            resposta = await fetch(API + caminho, {
                method: metodo,
                headers: { "Content-Type": "application/json" },
                body: corpo ? JSON.stringify(corpo) : undefined
            });
        } catch (erro) {
            throw new Error("Não foi possível falar com o servidor. Verifique a conexão e tente de novo.");
        }

        var dados = null;
        try {
            dados = await resposta.json();
        } catch (erro) {
            dados = null;
        }

        if (!resposta.ok) {
            throw new Error((dados && dados.mensagem) || "Algo deu errado. Tente novamente.");
        }
        return dados;
    }

    async function carregarEmpresas() {
        // Só troca a tabela por "Carregando" na primeira vez; depois das ações ela é atualizada no lugar
        if (empresas.length === 0) {
            mostrarEstado("Carregando empresas…", "", false);
        }

        try {
            empresas = await chamarApi("GET", "/listar");
            renderizar();
        } catch (erro) {
            empresas = [];
            contAtivas.textContent = "0";
            contDesativadas.textContent = "0";
            mostrarEstado("Não foi possível carregar as empresas", erro.message, true);
        }
    }

    // ---------- lista ----------

    function mostrarEstado(titulo, texto, comBotao) {
        areaTabela.hidden = true;
        estadoVazio.hidden = false;
        estadoTitulo.textContent = titulo;
        estadoTexto.textContent = texto;
        estadoTexto.hidden = !texto;
        btnRecarregar.hidden = !comBotao;
    }

    function passaNaBusca(empresa) {
        var termo = semAcento(termoBusca).trim();
        if (!termo) {
            return true;
        }

        var texto = semAcento([empresa.nomeFantasia, empresa.razaoSocial, empresa.email].join(" "));
        if (texto.indexOf(termo) !== -1) {
            return true;
        }

        var digitos = apenasDigitos(termoBusca);
        return digitos.length > 0 && apenasDigitos(empresa.cnpj).indexOf(digitos) !== -1;
    }

    function renderizar() {
        var ativas = empresas.filter(estaAtiva);
        var desativadas = empresas.filter(function (e) { return !estaAtiva(e); });

        contAtivas.textContent = ativas.length;
        contDesativadas.textContent = desativadas.length;

        var daAba = abaAtual === 1 ? ativas : desativadas;
        var lista = daAba.filter(passaNaBusca);

        corpoTabela.replaceChildren();

        if (lista.length === 0) {
            if (termoBusca.trim()) {
                mostrarEstado("Nenhuma empresa encontrada", "Confira a grafia ou tente buscar pelo CNPJ ou pelo e-mail.", false);
            } else if (abaAtual === 1) {
                mostrarEstado("Nenhuma empresa ativa", "As empresas cadastradas e ativas aparecem aqui.", false);
            } else {
                mostrarEstado("Nenhuma empresa desativada", "Quando você desativar uma empresa, ela aparece aqui e pode ser reativada.", false);
            }
            return;
        }

        estadoVazio.hidden = true;
        areaTabela.hidden = false;

        lista.forEach(function (empresa) {
            corpoTabela.appendChild(criarLinha(empresa));
        });
    }

    function criarBotao(rotulo, classe, rotuloAcessivel, aoClicar) {
        var botao = criar("button", "btn " + classe, rotulo);
        botao.type = "button";
        botao.setAttribute("aria-label", rotuloAcessivel);
        botao.addEventListener("click", aoClicar);
        return botao;
    }

    function criarLinha(empresa) {
        var tr = criar("tr");

        var tdEmpresa = criar("td");
        tdEmpresa.appendChild(criar("div", "empresa-nome", empresa.nomeFantasia));
        tdEmpresa.appendChild(criar("div", "texto-suave", empresa.razaoSocial));
        tr.appendChild(tdEmpresa);

        tr.appendChild(criar("td", "col-cnpj", mascaraCnpj(empresa.cnpj)));

        var tdContato = criar("td");
        tdContato.appendChild(criar("div", "", empresa.email));
        tdContato.appendChild(criar("div", "texto-suave", mascaraTelefone(empresa.telefone)));
        tr.appendChild(tdContato);

        var tdStatus = criar("td");
        tdStatus.appendChild(estaAtiva(empresa)
            ? criar("span", "selo selo-ativa", "Ativa")
            : criar("span", "selo selo-desativada", "Desativada"));
        tr.appendChild(tdStatus);

        var tdAcoes = criar("td", "col-acoes");
        var acoes = criar("div", "acoes");
        var nome = empresa.nomeFantasia;

        acoes.appendChild(criarBotao("Detalhes", "btn-suave", "Ver detalhes de " + nome, function () {
            abrirDetalhes(empresa.idEmpresa);
        }));
        acoes.appendChild(criarBotao("Editar", "btn-ciano", "Editar " + nome, function () {
            abrirEdicao(empresa.idEmpresa);
        }));

        if (estaAtiva(empresa)) {
            acoes.appendChild(criarBotao("Desativar", "btn-perigo", "Desativar " + nome, function () {
                pedirMudancaDeStatus(empresa, 0);
            }));
        } else {
            acoes.appendChild(criarBotao("Reativar", "btn-sucesso", "Reativar " + nome, function () {
                pedirMudancaDeStatus(empresa, 1);
            }));
        }

        tdAcoes.appendChild(acoes);
        tr.appendChild(tdAcoes);
        return tr;
    }

    // ---------- aviso de resultado ----------

    function mostrarToast(mensagem, tipo) {
        clearTimeout(timerToast);
        toast.textContent = mensagem;
        toast.className = "toast toast-" + (tipo || "sucesso") + " visivel";
        timerToast = setTimeout(function () {
            toast.classList.remove("visivel");
        }, 4500);
    }

    // ---------- confirmação (editar, desativar e reativar sempre passam por aqui) ----------

    function pedirConfirmacao(opcoes) {
        confirmarTitulo.textContent = opcoes.titulo;

        confirmarTexto.replaceChildren();
        (opcoes.paragrafos || []).forEach(function (texto) {
            var p = criar("p");
            if (Array.isArray(texto)) {
                // [antes, destaque, depois]
                p.appendChild(document.createTextNode(texto[0]));
                p.appendChild(criar("strong", "", texto[1]));
                p.appendChild(document.createTextNode(texto[2]));
            } else {
                p.textContent = texto;
            }
            confirmarTexto.appendChild(p);
        });

        confirmarLista.replaceChildren();
        (opcoes.mudancas || []).forEach(function (mudanca) {
            var li = criar("li");
            li.appendChild(criar("span", "mudanca-campo", mudanca.rotulo));
            li.appendChild(criar("span", "mudanca-antes", mudanca.antes));
            li.appendChild(document.createTextNode(" → "));
            li.appendChild(criar("span", "mudanca-depois", mudanca.depois));
            confirmarLista.appendChild(li);
        });
        confirmarLista.hidden = !(opcoes.mudancas && opcoes.mudancas.length);

        confirmarErro.hidden = true;
        confirmarErro.textContent = "";

        btnConfirmarOk.textContent = opcoes.rotulo;
        btnConfirmarOk.className = "btn btn-principal" + (opcoes.tipo ? " tipo-" + opcoes.tipo : "");

        acaoConfirmar = opcoes.acao;
        dlgConfirmar.showModal();
    }

    function definirConfirmando(valor) {
        confirmando = valor;
        btnConfirmarOk.disabled = valor;
        btnConfirmarCancelar.disabled = valor;
    }

    btnConfirmarOk.addEventListener("click", async function () {
        if (!acaoConfirmar || confirmando) {
            return;
        }

        confirmarErro.hidden = true;
        definirConfirmando(true);

        try {
            await acaoConfirmar();
            dlgConfirmar.close();
        } catch (erro) {
            confirmarErro.textContent = erro.message;
            confirmarErro.hidden = false;
        } finally {
            definirConfirmando(false);
        }
    });

    btnConfirmarCancelar.addEventListener("click", function () {
        dlgConfirmar.close();
    });

    // Não deixa fechar (Esc) enquanto a alteração está sendo enviada
    dlgConfirmar.addEventListener("cancel", function (evento) {
        if (confirmando) {
            evento.preventDefault();
        }
    });

    dlgConfirmar.addEventListener("close", function () {
        acaoConfirmar = null;
    });

    // ---------- desativar / reativar ----------

    function pedirMudancaDeStatus(empresa, novoStatus) {
        var desativando = novoStatus === 0;

        pedirConfirmacao({
            titulo: desativando ? "Desativar esta empresa?" : "Reativar esta empresa?",
            paragrafos: desativando
                ? [
                    ["Você vai desativar ", empresa.nomeFantasia, "."],
                    "Os logins do gestor e dos funcionários da empresa ficam bloqueados a partir do próximo acesso.",
                    "Nada é apagado: servidores, funcionários e métricas continuam salvos. Você pode reativar a empresa a qualquer momento na aba Desativadas."
                ]
                : [
                    ["Você vai reativar ", empresa.nomeFantasia, "."],
                    "Os logins do gestor e dos funcionários da empresa voltam a funcionar a partir do próximo acesso."
                ],
            rotulo: desativando ? "Desativar empresa" : "Reativar empresa",
            tipo: desativando ? "perigo" : "sucesso",
            acao: async function () {
                var dados = await chamarApi("PUT", "/status/" + empresa.idEmpresa, { statusServer: novoStatus });
                mostrarToast(dados.mensagem, "sucesso");
                await carregarEmpresas();
            }
        });
    }

    // ---------- detalhes ----------

    function linhaInfo(rotulo, valor, classeExtra) {
        var bloco = criar("div", "info" + (classeExtra ? " " + classeExtra : ""));
        bloco.appendChild(criar("dt", "", rotulo));

        var dd = criar("dd");
        if (valor) {
            dd.textContent = valor;
        } else {
            dd.textContent = "Não informado";
            dd.className = "vazio";
        }
        bloco.appendChild(dd);
        return bloco;
    }

    function itemResumo(valor, rotulo) {
        var item = criar("div", "resumo-item");
        item.appendChild(criar("span", "resumo-valor", valor));
        item.appendChild(criar("span", "resumo-rotulo", rotulo));
        return item;
    }

    function montarEnderecoEmLinha(e) {
        if (!e.logradouro) {
            return "";
        }
        var linha = e.logradouro + ", " + e.numero;
        if (e.complemento) {
            linha += " - " + e.complemento;
        }
        return linha;
    }

    function renderizarDetalhes(dados) {
        var e = dados.empresa;
        var g = dados.gestor;

        detalhesCorpo.replaceChildren();

        var resumo = criar("div", "resumo");
        resumo.appendChild(itemResumo(String(dados.qtdServidores), "servidores ativos"));
        resumo.appendChild(itemResumo(String(dados.qtdFuncionarios), "funcionários ativos"));
        resumo.appendChild(itemResumo(formatarData(e.dtCadastro) || "-", "cliente desde"));
        detalhesCorpo.appendChild(resumo);

        // Empresa
        var secEmpresa = criar("div", "detalhes-secao");
        secEmpresa.appendChild(criar("h3", "secao-titulo", "Dados da empresa"));
        var gEmpresa = criar("dl", "info-grade");
        gEmpresa.appendChild(linhaInfo("Razão social", e.razaoSocial));
        gEmpresa.appendChild(linhaInfo("Nome fantasia", e.nomeFantasia));
        gEmpresa.appendChild(linhaInfo("CNPJ", mascaraCnpj(e.cnpj)));
        gEmpresa.appendChild(linhaInfo("Segmento de atuação", e.segmentoAtuacao));
        gEmpresa.appendChild(linhaInfo("E-mail", e.email));
        gEmpresa.appendChild(linhaInfo("Telefone", mascaraTelefone(e.telefone)));
        secEmpresa.appendChild(gEmpresa);
        detalhesCorpo.appendChild(secEmpresa);

        // Endereço
        var secEndereco = criar("div", "detalhes-secao");
        secEndereco.appendChild(criar("h3", "secao-titulo", "Endereço"));
        var gEndereco = criar("dl", "info-grade");
        gEndereco.appendChild(linhaInfo("Endereço", montarEnderecoEmLinha(e)));
        gEndereco.appendChild(linhaInfo("CEP", e.cep ? mascaraCep(e.cep) : ""));
        gEndereco.appendChild(linhaInfo("Bairro", e.bairro));
        gEndereco.appendChild(linhaInfo("Cidade / UF", e.cidade ? e.cidade + " / " + e.estado : ""));
        secEndereco.appendChild(gEndereco);
        detalhesCorpo.appendChild(secEndereco);

        // Gestor
        var secGestor = criar("div", "detalhes-secao");
        secGestor.appendChild(criar("h3", "secao-titulo", "Gestor"));

        if (!g) {
            secGestor.appendChild(criar("p", "nota", "Esta empresa ainda não tem um gestor cadastrado."));
        } else {
            var gGestor = criar("dl", "info-grade");
            gGestor.appendChild(linhaInfo("Nome", g.nome));
            gGestor.appendChild(linhaInfo("E-mail de login", g.email));

            var blocoSenha = criar("div", "info");
            blocoSenha.appendChild(criar("dt", "", "Senha"));
            blocoSenha.appendChild(criar("dd", "valor-senha", g.senha));
            gGestor.appendChild(blocoSenha);

            gGestor.appendChild(linhaInfo("CPF", g.cpf ? mascaraCpf(g.cpf) : ""));
            gGestor.appendChild(linhaInfo("Acesso", Number(g.status) === 1 ? "Ativo" : "Desativado"));
            secGestor.appendChild(gGestor);
            secGestor.appendChild(criar("p", "nota", "Você só consulta estes dados. Quem altera a senha é o próprio gestor."));
        }
        detalhesCorpo.appendChild(secGestor);
    }

    async function abrirDetalhes(idEmpresa) {
        var empresa = empresas.find(function (e) { return e.idEmpresa === idEmpresa; });
        detalhesSolicitado = idEmpresa;

        document.getElementById("detalhes_titulo").textContent = empresa ? empresa.nomeFantasia : "Detalhes da empresa";
        detalhesCorpo.replaceChildren(criar("p", "detalhes-carregando", "Carregando detalhes…"));
        btnDetalhesEditar.hidden = true;
        btnDetalhesEditar.dataset.id = String(idEmpresa);
        dlgDetalhes.showModal();

        try {
            var dados = await chamarApi("GET", "/detalhes/" + idEmpresa);
            if (detalhesSolicitado !== idEmpresa) {
                return; // o modal foi fechado ou aberto para outra empresa
            }
            renderizarDetalhes(dados);
            btnDetalhesEditar.hidden = false;
        } catch (erro) {
            if (detalhesSolicitado !== idEmpresa) {
                return;
            }
            var aviso = criar("p", "aviso-erro", erro.message);
            aviso.setAttribute("role", "alert");
            detalhesCorpo.replaceChildren(aviso);
        }
    }

    btnDetalhesEditar.addEventListener("click", function () {
        var id = Number(btnDetalhesEditar.dataset.id);
        dlgDetalhes.close();
        abrirEdicao(id);
    });

    dlgDetalhes.addEventListener("close", function () {
        detalhesSolicitado = null;
    });

    // Clique fora do modal de detalhes fecha (a edição não fecha assim, para não perder o que foi digitado)
    dlgDetalhes.addEventListener("click", function (evento) {
        if (evento.target === dlgDetalhes) {
            dlgDetalhes.close();
        }
    });

    // ---------- edição ----------

    function normalizarEmpresa(empresa) {
        return {
            razaoSocial: String(empresa.razaoSocial || "").trim(),
            nomeFantasia: String(empresa.nomeFantasia || "").trim(),
            cnpj: apenasDigitos(empresa.cnpj),
            segmentoAtuacao: String(empresa.segmentoAtuacao || "").trim(),
            email: String(empresa.email || "").trim(),
            telefone: apenasDigitos(empresa.telefone),
            cep: apenasDigitos(empresa.cep),
            logradouro: String(empresa.logradouro || "").trim(),
            numero: String(empresa.numero || "").trim(),
            complemento: String(empresa.complemento || "").trim(),
            bairro: String(empresa.bairro || "").trim(),
            cidade: String(empresa.cidade || "").trim(),
            estado: String(empresa.estado || "").trim().toUpperCase()
        };
    }

    function preencherFormulario(empresa) {
        var d = normalizarEmpresa(empresa);

        CAMPOS.forEach(function (campo) {
            document.getElementById(campo.id).value = d[campo.chave];
        });

        document.getElementById("ed_cnpj").value = mascaraCnpj(d.cnpj);
        document.getElementById("ed_telefone").value = mascaraTelefone(d.telefone);
        document.getElementById("ed_cep").value = mascaraCep(d.cep);
    }

    function lerFormulario() {
        var valores = {};
        CAMPOS.forEach(function (campo) {
            valores[campo.chave] = document.getElementById(campo.id).value;
        });
        return normalizarEmpresa(valores);
    }

    function limparErros() {
        edicaoAviso.hidden = true;
        edicaoAviso.textContent = "";

        CAMPOS.forEach(function (campo) {
            var input = document.getElementById(campo.id);
            input.closest(".campo").classList.remove("com-erro");
            input.removeAttribute("aria-invalid");
            document.getElementById("erro_" + campo.id).textContent = "";
        });
    }

    function validar(dados, original) {
        var erros = {};

        if (!dados.razaoSocial || dados.razaoSocial.length > 100) {
            erros.razaoSocial = "Informe a razão social (até 100 caracteres).";
        }
        if (!dados.nomeFantasia || dados.nomeFantasia.length > 100) {
            erros.nomeFantasia = "Informe o nome fantasia (até 100 caracteres).";
        }
        if (dados.cnpj.length !== 14) {
            erros.cnpj = "O CNPJ deve ter 14 dígitos.";
        } else if (dados.cnpj !== original.cnpj && !cnpjValido(dados.cnpj)) {
            // O dígito verificador só é cobrado quando o CNPJ muda (empresas com CNPJ de teste seguem editáveis)
            erros.cnpj = "CNPJ inválido. Confira os dígitos.";
        }
        if (!dados.segmentoAtuacao || dados.segmentoAtuacao.length > 80) {
            erros.segmentoAtuacao = "Informe o segmento de atuação (até 80 caracteres).";
        }
        if (!dados.email || dados.email.length > 200 || !emailValido(dados.email)) {
            erros.email = "Informe um e-mail válido, como contato@empresa.com.";
        }
        if (dados.telefone.length < 10 || dados.telefone.length > 11) {
            erros.telefone = "Informe o telefone com DDD (10 ou 11 dígitos).";
        }
        if (dados.cep.length !== 8) {
            erros.cep = "O CEP deve ter 8 dígitos.";
        }
        if (!dados.logradouro || dados.logradouro.length > 100) {
            erros.logradouro = "Informe o logradouro (até 100 caracteres).";
        }
        if (!dados.numero || dados.numero.length > 20) {
            erros.numero = "Informe o número (até 20 caracteres).";
        }
        if (dados.complemento.length > 100) {
            erros.complemento = "O complemento pode ter até 100 caracteres.";
        }
        if (!dados.bairro || dados.bairro.length > 100) {
            erros.bairro = "Informe o bairro (até 100 caracteres).";
        }
        if (!dados.cidade || dados.cidade.length > 100) {
            erros.cidade = "Informe a cidade (até 100 caracteres).";
        }
        if (UFS.indexOf(dados.estado) === -1) {
            erros.estado = "Selecione a UF.";
        }

        return erros;
    }

    function mostrarErros(erros) {
        var primeiro = null;

        CAMPOS.forEach(function (campo) {
            var mensagem = erros[campo.chave];
            if (!mensagem) {
                return;
            }
            var input = document.getElementById(campo.id);
            input.closest(".campo").classList.add("com-erro");
            input.setAttribute("aria-invalid", "true");
            document.getElementById("erro_" + campo.id).textContent = mensagem;
            if (!primeiro) {
                primeiro = input;
            }
        });

        if (primeiro) {
            primeiro.focus();
        }
    }

    function formatarParaExibir(chave, valor) {
        if (!valor) {
            return "(vazio)";
        }
        if (chave === "cnpj") { return mascaraCnpj(valor); }
        if (chave === "telefone") { return mascaraTelefone(valor); }
        if (chave === "cep") { return mascaraCep(valor); }
        return valor;
    }

    function listarMudancas(original, novo) {
        var mudancas = [];

        CAMPOS.forEach(function (campo) {
            if (original[campo.chave] !== novo[campo.chave]) {
                mudancas.push({
                    rotulo: campo.rotulo,
                    antes: formatarParaExibir(campo.chave, original[campo.chave]),
                    depois: formatarParaExibir(campo.chave, novo[campo.chave])
                });
            }
        });

        return mudancas;
    }

    function abrirEdicao(idEmpresa) {
        empresaEmEdicao = empresas.find(function (e) { return e.idEmpresa === idEmpresa; });
        if (!empresaEmEdicao) {
            return;
        }

        limparErros();
        preencherFormulario(empresaEmEdicao);
        document.getElementById("editar_titulo").textContent = "Editar " + empresaEmEdicao.nomeFantasia;
        dlgEditar.showModal();
    }

    formEdicao.addEventListener("submit", function (evento) {
        evento.preventDefault();
        if (!empresaEmEdicao) {
            return;
        }

        limparErros();

        var empresa = empresaEmEdicao;
        var original = normalizarEmpresa(empresa);
        var dados = lerFormulario();

        var erros = validar(dados, original);
        if (Object.keys(erros).length > 0) {
            mostrarErros(erros);
            return;
        }

        var mudancas = listarMudancas(original, dados);
        if (mudancas.length === 0) {
            edicaoAviso.textContent = "Você ainda não alterou nenhum campo.";
            edicaoAviso.hidden = false;
            return;
        }

        pedirConfirmacao({
            titulo: "Salvar as alterações?",
            paragrafos: [
                ["Confira o que vai mudar em ", empresa.nomeFantasia, ":"]
            ],
            mudancas: mudancas,
            rotulo: "Salvar alterações",
            tipo: "",
            acao: async function () {
                var corpo = {};
                CAMPOS.forEach(function (campo) {
                    corpo[campo.chave + "Server"] = dados[campo.chave];
                });

                var resposta = await chamarApi("PUT", "/editar/" + empresa.idEmpresa, corpo);
                dlgEditar.close();
                mostrarToast(resposta.mensagem, "sucesso");
                await carregarEmpresas();
            }
        });
    });

    // Formatação enquanto digita
    document.getElementById("ed_cnpj").addEventListener("input", function (evento) {
        evento.target.value = mascaraCnpj(evento.target.value);
    });
    document.getElementById("ed_telefone").addEventListener("input", function (evento) {
        evento.target.value = mascaraTelefone(evento.target.value);
    });
    document.getElementById("ed_cep").addEventListener("input", function (evento) {
        evento.target.value = mascaraCep(evento.target.value);
    });

    // Some com a mensagem de erro de um campo assim que a pessoa volta a mexer nele
    CAMPOS.forEach(function (campo) {
        var input = document.getElementById(campo.id);
        var aoMudar = function () {
            input.closest(".campo").classList.remove("com-erro");
            input.removeAttribute("aria-invalid");
            document.getElementById("erro_" + campo.id).textContent = "";
            edicaoAviso.hidden = true;
        };
        input.addEventListener("input", aoMudar);
        input.addEventListener("change", aoMudar);
    });

    // ---------- eventos gerais ----------

    document.querySelectorAll("[data-fechar]").forEach(function (botao) {
        botao.addEventListener("click", function () {
            botao.closest("dialog").close();
        });
    });

    document.querySelectorAll(".aba").forEach(function (aba) {
        aba.addEventListener("click", function () {
            abaAtual = Number(aba.dataset.status);
            document.querySelectorAll(".aba").forEach(function (outra) {
                var ativa = outra === aba;
                outra.classList.toggle("ativa", ativa);
                outra.setAttribute("aria-selected", ativa ? "true" : "false");
            });
            renderizar();
        });
    });

    iptBusca.addEventListener("input", function () {
        termoBusca = iptBusca.value;
        renderizar();
    });

    btnRecarregar.addEventListener("click", carregarEmpresas);

    // ---------- início ----------

    (function iniciar() {
        var seletorUf = document.getElementById("ed_estado");
        var opcaoVazia = criar("option", "", "UF");
        opcaoVazia.value = "";
        seletorUf.appendChild(opcaoVazia);
        UFS.forEach(function (uf) {
            var opcao = criar("option", "", uf);
            opcao.value = uf;
            seletorUf.appendChild(opcao);
        });

        if (sessionStorage.NOME_USUARIO) {
            document.getElementById("nome_usuario").textContent = sessionStorage.NOME_USUARIO;
        }

        carregarEmpresas();
    })();
})();
