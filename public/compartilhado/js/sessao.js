// ----------- Sessao -----------
function validarSessao() {
    var email = sessionStorage.EMAIL_USUARIO;
    var nome = sessionStorage.NOME_USUARIO;
    var tipoAcesso = sessionStorage.TIPO_ACESSO;

    var b_usuario = document.getElementById("b_usuario");
    var nome_usuario = document.getElementById("nome_usuario");

    if (email != null && nome != null) {
        if (b_usuario) {
            b_usuario.textContent = nome;
        }
        if (nome_usuario) {
            nome_usuario.textContent = nome;
        }
        configurarMenusPorPerfil(tipoAcesso);
        protegerRotaPorPerfil(tipoAcesso);
        inicializarMenuLateralResponsivo();
    } else {
        window.location.href = "/paginas/autenticacao/login/login.html";
    }
}

function obterDestinoInicial(tipoAcesso) {
    var tipo = (tipoAcesso || "").toUpperCase();
    if (tipo === "INFRATECH" || tipo === "ADMIN") {
        return "/paginas/pos-login/empresas/gerenciar_empresa.html";
    } else if (tipo === "GESTOR") {
        return "/dashboard/dash-geral.html";
    } else if (tipo === "ANALISTA_DADOS" || tipo === "ANALISTA_NOC" || tipo === "FUNCIONARIO") {
        return "/dashboard/dash-geral.html";
    } else {
        return "/dashboard/dash-geral.html";
    }
}

function protegerRotaPorPerfil(tipoAcesso) {
    var tipo = (tipoAcesso || "").toUpperCase();
    var rota = window.location.pathname.toLowerCase();

    var ehInfratech = (tipo === "INFRATECH" || tipo === "ADMIN");
    var ehGestor = (tipo === "GESTOR");
    var ehAnalista = (!ehInfratech && !ehGestor);

    if (ehInfratech) {
        // Admin InfraTech só gerencia Empresas e Funcionários
        if (rota.includes("/servidores/") || rota.includes("/dashboard/")) {
            window.location.href = "/paginas/pos-login/empresas/gerenciar_empresa.html";
        }
        return;
    }

    if (ehGestor) {
        // Gestor da empresa cliente não acessa gestão de empresas de outros clientes
        if (rota.includes("/empresas/")) {
            window.location.href = "/dashboard/dash-geral.html";
        }
        return;
    }

    if (ehAnalista) {
        // Analista e funcionário não acessam gestão de empresas, equipe (funcionários) nem cadastro de hosts
        if (rota.includes("/empresas/") || rota.includes("/funcionarios/") || rota.includes("/servidores/")) {
            window.location.href = "/dashboard/dash-geral.html";
        }
        return;
    }
}

function configurarMenusPorPerfil(tipoAcesso) {
    var tipo = (tipoAcesso || "").toUpperCase();
    var ehInfratech = (tipo === "INFRATECH" || tipo === "ADMIN");
    var ehGestor = (tipo === "GESTOR");
    var ehAnalista = (!ehInfratech && !ehGestor);

    var sidebar = document.querySelector("aside.header-left");
    if (!sidebar) return;

    var categorias = sidebar.querySelectorAll(".nav-categoria");
    var links = sidebar.querySelectorAll("a.nav-item");

    // 1. Controle de Categorias
    categorias.forEach(function (cat) {
        var texto = cat.textContent.toLowerCase();
        var classes = cat.className.toLowerCase();

        if (texto.includes("empresa") || classes.includes("secao-empresas")) {
            cat.style.display = ehInfratech ? "flex" : "none";
        } else if (texto.includes("funcion") || classes.includes("secao-funcionarios")) {
            cat.style.display = (ehInfratech || ehGestor) ? "flex" : "none";
        } else if (texto.includes("servidor") || texto.includes("dash") || classes.includes("secao-dashboards")) {
            cat.style.display = (ehGestor || ehAnalista) ? "flex" : "none";
        }
    });

    // 2. Controle de Links
    links.forEach(function (link) {
        var href = (link.getAttribute("href") || "").toLowerCase();
        var texto = link.textContent.toLowerCase();

        // Links de Empresas (só Infratech/Admin)
        if (href.includes("empresa") || texto.includes("empresa")) {
            link.style.display = ehInfratech ? "flex" : "none";
        }
        // Links de Gestão de Funcionários (só Infratech e Gestor - ANALISTA NUNCA PODE)
        else if (href.includes("funcionario") || href.includes("token") || texto.includes("token") || (texto.includes("gerenciar") && !href.includes("empresa"))) {
            link.style.display = (ehInfratech || ehGestor) ? "flex" : "none";
        }
        // Links de Configuração de Hosts (Cadastrar Host, Modificar Servidor) -> Só Gestor!
        else if (href.includes("cadastro_servidor") || href.includes("modificar_servidor") || texto.includes("cadastrar host") || texto.includes("modificar")) {
            link.style.display = ehGestor ? "flex" : "none";
        }
        // Links de Dashboards -> Gestor e Analistas (Admin NÃO vê dashboards de servidores de clientes)
        else if (href.includes("dash") || href.includes("painel") || texto.includes("dash") || texto.includes("em breve")) {
            link.style.display = (ehGestor || ehAnalista) ? "flex" : "none";
        }
    });
}

// Injeta e controla o botão hambúrguer global e overlay para drawer lateral
function inicializarMenuLateralResponsivo() {
    var sidebar = document.querySelector("aside.header-left");
    if (!sidebar) return;

    // Evita duplicar se já existir
    if (document.getElementById("btn_hamburguer_global")) return;

    var btnHamburguer = document.createElement("button");
    btnHamburguer.id = "btn_hamburguer_global";
    btnHamburguer.className = "btn-hamburguer-global";
    btnHamburguer.type = "button";
    btnHamburguer.setAttribute("aria-label", "Abrir menu de navegação");
    btnHamburguer.innerHTML = "&#9776;";

    var overlay = document.createElement("div");
    overlay.id = "overlay_sidebar_global";
    overlay.className = "overlay-sidebar-global";

    document.body.prepend(overlay);
    document.body.prepend(btnHamburguer);

    function alternar() {
        sidebar.classList.toggle("aberta");
        overlay.classList.toggle("visivel");
    }

    function fechar() {
        sidebar.classList.remove("aberta");
        overlay.classList.remove("visivel");
    }

    btnHamburguer.addEventListener("click", alternar);
    overlay.addEventListener("click", fechar);

    sidebar.querySelectorAll(".nav-item, .btn-logout").forEach(function (item) {
        item.addEventListener("click", fechar);
    });
}

function limparSessao() {
    sessionStorage.clear();
    window.location.href = "/paginas/autenticacao/login/login.html";
}

function aguardar() {
    var divAguardar = document.getElementById("div_aguardar");
    if (divAguardar) {
        divAguardar.style.display = "flex";
    }
}

function finalizarAguardar(texto) {
    var divAguardar = document.getElementById("div_aguardar");
    if (divAguardar) {
        divAguardar.style.display = "none";
    }

    var divErrosLogin = document.getElementById("div_erros_login");
    if (divErrosLogin && texto) {
        divErrosLogin.style.display = "flex";
        divErrosLogin.innerHTML = texto;
    }
}