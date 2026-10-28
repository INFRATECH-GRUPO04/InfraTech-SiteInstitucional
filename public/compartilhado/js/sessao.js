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
        return "/paginas/pos-login/painel/painel.html";
    } else if (tipo === "ANALISTA_NOC") {
        return "/paginas/pos-login/dashboards/dashboard_noc.html";
    } else {
        return "/paginas/pos-login/dashboards/dashboard_dados.html";
    }
}

function protegerRotaPorPerfil(tipoAcesso) {
    var tipo = (tipoAcesso || "").toUpperCase();
    var rota = window.location.pathname.toLowerCase();

    var ehInfratech = (tipo === "INFRATECH" || tipo === "ADMIN");
    var ehGestor = (tipo === "GESTOR");
    var ehAnalistaDados = (tipo === "ANALISTA_DADOS" || tipo === "FUNCIONARIO");
    var ehAnalistaNoc = (tipo === "ANALISTA_NOC");

    if (ehAnalistaDados) {
        if (!rota.includes("dashboard_dados.html")) {
            window.location.href = "/paginas/pos-login/dashboards/dashboard_dados.html";
        }
        return;
    }

    if (ehAnalistaNoc) {
        if (!rota.includes("dashboard_noc.html")) {
            window.location.href = "/paginas/pos-login/dashboards/dashboard_noc.html";
        }
        return;
    }

    if (ehInfratech) {
        if (rota.includes("/servidores/") || rota.includes("dashboard_noc.html") || rota.includes("dashboard_dados.html")) {
            window.location.href = "/paginas/pos-login/empresas/gerenciar_empresa.html";
        }
        return;
    }

    if (ehGestor) {
        if (rota.includes("/empresas/") || rota.includes("dashboard_noc.html") || rota.includes("dashboard_dados.html")) {
            window.location.href = "/paginas/pos-login/painel/painel.html";
        }
        return;
    }
}

function configurarMenusPorPerfil(tipoAcesso) {
    var tipo = (tipoAcesso || "").toUpperCase();
    var ehInfratech = (tipo === "INFRATECH" || tipo === "ADMIN");
    var ehGestor = (tipo === "GESTOR");

    var sidebar = document.querySelector("aside.header-left");
    if (!sidebar) return;

    var categorias = sidebar.querySelectorAll(".nav-categoria");
    var links = sidebar.querySelectorAll("a.nav-item");

    categorias.forEach(function (cat) {
        var texto = cat.textContent.toLowerCase();
        if (texto.includes("servidores")) {
            cat.style.display = ehGestor ? "flex" : "none";
        } else if (texto.includes("funcion")) {
            cat.style.display = (ehInfratech || ehGestor) ? "flex" : "none";
        } else if (texto.includes("empresa")) {
            cat.style.display = ehInfratech ? "flex" : "none";
        }
    });

    links.forEach(function (link) {
        var href = (link.getAttribute("href") || "").toLowerCase();
        var texto = link.textContent.toLowerCase();

        if (href.includes("servidores") || href.includes("painel.html")) {
            link.style.display = ehGestor ? "flex" : "none";
        } else if (href.includes("empresas")) {
            link.style.display = ehInfratech ? "flex" : "none";
        } else if (href.includes("cadastro_token") || href.includes("modificar_funcionario")) {
            link.style.display = (ehInfratech || ehGestor) ? "flex" : "none";
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