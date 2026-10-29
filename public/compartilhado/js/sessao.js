// ----------- Sessao -----------
function validarSessao() {
    return carregarSessaoConfiavel().then(function (usuario) {
        if (!usuario) return window.location.replace("/paginas/autenticacao/login/login.html");
        var nome = usuario.nome;
        var bUsuario = document.getElementById("b_usuario");
        var nomeUsuario = document.getElementById("nome_usuario");
        var cargoUsuario = document.getElementById("cargo_usuario");
        if (bUsuario) bUsuario.textContent = nome;
        if (nomeUsuario) nomeUsuario.textContent = nome;
        if (cargoUsuario) cargoUsuario.textContent = rotuloCargo(usuario.tipoAcesso);
        configurarMenusPorPerfil(usuario.tipoAcesso);
        protegerRotaPorPerfil(usuario.tipoAcesso);
        inicializarMenuLateralResponsivo();
    });
}

function rotuloCargo(cargo) {
    return ({ ANALISTA_DADOS: "ENGENHEIRO DE TELEMETRIA", ANALISTA_NOC: "ANALISTA DE NOC", GESTOR: "GESTOR", FUNCIONARIO: "FUNCIONÁRIO", ADMIN: "ADMINISTRADOR", INFRATECH: "ADMINISTRADOR INFRATECH" })[String(cargo || "").toUpperCase()] || "";
}

function carregarSessaoConfiavel() {
    return fetch("/login_cadastro/sessao", { credentials: "same-origin", cache: "no-store" })
        .then(function (resposta) { return resposta.ok ? resposta.json() : null; })
        .then(function (usuario) {
            if (!usuario) return null;
            sessionStorage.EMAIL_USUARIO = usuario.email;
            sessionStorage.NOME_USUARIO = usuario.nome;
            sessionStorage.ID_USUARIO = usuario.idFuncionario;
            sessionStorage.ID_EMPRESA = usuario.idEmpresa;
            sessionStorage.TIPO_ACESSO = usuario.tipoAcesso;
            sessionStorage.PODE_EDITAR_ALERTAS = String(usuario.podeEditarAlertas === true);
            sessionStorage.PERMISSOES = JSON.stringify(usuario.permissoes || {});
            sessionStorage.removeItem("SENHA_USUARIO");
            return usuario;
        }).catch(function () { return null; });
}

function obterDestinoInicial(tipoAcesso) {
    return InfraTechPermissoes.destino(tipoAcesso);
}

function protegerRotaPorPerfil(tipoAcesso) {
    if (InfraTechPermissoes.protegida(window.location.pathname) && !InfraTechPermissoes.podeAcessar(tipoAcesso, window.location.pathname)) {
        window.location.replace(obterDestinoInicial(tipoAcesso));
    }
}

function adicionarMenuDashboards(sidebar) {
    if (!sidebar) return;

    var categoria = sidebar.querySelector(".secao-dashboards");
    if (!categoria) {
        categoria = document.createElement("h3");
        categoria.className = "nav-categoria secao-dashboards";

        var iconeCategoria = document.createElement("img");
        iconeCategoria.src = "/assets/imgs/dashboards.png";
        iconeCategoria.alt = "";
        iconeCategoria.className = "menu-icon-title";
        categoria.appendChild(iconeCategoria);
        categoria.appendChild(document.createTextNode("Dashboards"));
    }

    var perfil = InfraTechPermissoes.obter(sessionStorage.TIPO_ACESSO);
    var dashboards = InfraTechPermissoes.dashboards.filter(function (item) { return perfil.dashboards.includes(item.id); });
    var fragmento = document.createDocumentFragment();
    if (!categoria.parentElement) fragmento.appendChild(categoria);

    dashboards.forEach(function (dashboard) {
        var linkExistente = Array.from(sidebar.querySelectorAll("a.nav-item")).find(function (item) {
            try {
                return new URL(item.getAttribute("href"), window.location.href).pathname === dashboard.href;
            } catch (erro) {
                return false;
            }
        });
        var link = linkExistente || document.createElement("a");
        var icone = link.querySelector("img") || document.createElement("img");

        link.href = dashboard.href;
        link.classList.add("nav-item");
        icone.src = "/assets/imgs/dashboards.png";
        icone.alt = "";
        icone.className = "menu-icon";
        link.textContent = "";
        link.appendChild(icone);
        link.appendChild(document.createTextNode(dashboard.label));

        if (linkExistente) linkExistente.remove();

        if (window.location.pathname === dashboard.href) {
            link.classList.add("ativo");
            link.setAttribute("aria-current", "page");
        } else {
            link.classList.remove("ativo");
            link.removeAttribute("aria-current");
        }

        fragmento.appendChild(link);
    });

    var logout = sidebar.querySelector(".btn-logout");
    if (!categoria.parentElement) {
        var divisor = sidebar.querySelector("hr.linha");
        sidebar.insertBefore(fragmento, divisor ? divisor.nextElementSibling : logout || null);
    } else {
        sidebar.insertBefore(fragmento, categoria.nextElementSibling || logout || null);
    }
}

function configurarMenusPorPerfil(tipoAcesso) {
    var sidebar = document.querySelector("aside.header-left");
    if (!sidebar) return;
    adicionarMenuDashboards(sidebar);
    adicionarMenuGerenciarAcesso(sidebar);
    sidebar.querySelectorAll("a.nav-item").forEach(function (link) {
        var rota = new URL(link.getAttribute("href") || "#", window.location.href).pathname;
        var liberado = InfraTechPermissoes.podeAcessar(tipoAcesso, rota);
        link.hidden = !liberado;
        link.style.display = liberado ? "flex" : "none";
        link.classList.toggle("ativo", liberado && rota === window.location.pathname);
        if (liberado && rota === window.location.pathname) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
    });
    sidebar.querySelectorAll(".nav-categoria").forEach(function (categoria) {
        var item = categoria.nextElementSibling;
        var visivel = false;
        while (item && !item.classList.contains("nav-categoria") && !item.classList.contains("btn-logout")) {
            if (item.matches("a.nav-item") && item.style.display !== "none") visivel = true;
            item = item.nextElementSibling;
        }
        categoria.style.display = visivel ? "flex" : "none";
        categoria.hidden = !visivel;
    });
    var logo = sidebar.querySelector(".logo a");
    if (logo) logo.href = obterDestinoInicial(tipoAcesso);
    window.dispatchEvent(new CustomEvent('infratech:sessao-validada', { detail: { tipoAcesso: tipoAcesso } }));
}

function adicionarMenuGerenciarAcesso(sidebar) {
    var caminho = "/paginas/pos-login/funcionarios/gerenciar_funcionario/gerenciar_funcionario.html";
    var link = Array.from(sidebar.querySelectorAll("a.nav-item")).find(function (item) {
        return new URL(item.getAttribute("href"), window.location.href).pathname === caminho;
    });
    var categoria = sidebar.querySelector(".secao-funcionarios");
    if (!categoria) {
        categoria = document.createElement("h3");
        categoria.className = "nav-categoria secao-funcionarios";
        categoria.innerHTML = '<img src="/assets/imgs/funcionarios.png" alt="" class="menu-icon-title">Funcionários';
        sidebar.insertBefore(categoria, sidebar.querySelector(".btn-logout"));
    }
    if (!link) {
        link = document.createElement("a");
        link.className = "nav-item";
    }
    link.href = caminho;
    link.innerHTML = '<img src="/assets/imgs/funcionarios.png" alt="" class="menu-icon">Gerenciar acesso';
    categoria.after(link);
}

// Injeta e controla o botão hambúrguer global e sobreposição para menu deslizante lateral
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
    fetch("/login_cadastro/sair", { method: "POST", credentials: "same-origin" }).finally(function () {
        sessionStorage.clear();
        window.location.href = "/paginas/autenticacao/login/login.html";
    });
}

// Algumas telas pós-login não chamam validarSessao() no body. Ainda assim,
// quando já existe uma sessão, elas recebem a mesma navegação lateral.
document.addEventListener("DOMContentLoaded", function () {
    var sidebar = document.querySelector("aside.header-left");
    if (!sidebar) return;
    carregarSessaoConfiavel().then(function (usuario) {
        if (!usuario) return window.location.replace("/paginas/autenticacao/login/login.html");
        var cargo = document.getElementById("cargo_usuario");
        if (cargo) cargo.textContent = rotuloCargo(usuario.tipoAcesso);
        var nome = document.getElementById("nome_usuario");
        if (nome) nome.textContent = usuario.nome;
        configurarMenusPorPerfil(usuario.tipoAcesso);
        protegerRotaPorPerfil(usuario.tipoAcesso);
        inicializarMenuLateralResponsivo();
    });
});

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
