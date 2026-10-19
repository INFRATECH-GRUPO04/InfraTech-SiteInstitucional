// ----------- Sessão -----------
function validarSessao() {
    var email = sessionStorage.EMAIL_USUARIO;
    var nome = sessionStorage.NOME_USUARIO;
    var tipoAcesso = (sessionStorage.TIPO_ACESSO || "").toUpperCase();

    var b_usuario = document.getElementById("b_usuario");
    var nome_usuario = document.getElementById("nome_usuario");

    if (email != null && nome != null) {
        if (b_usuario) {
            b_usuario.textContent = nome;
        }
        if (nome_usuario) {
            nome_usuario.textContent = nome;
        }
        aplicarControleAcesso(tipoAcesso);
    } else {
        window.location.href = "/paginas/autenticacao/login/login.html";
    }
}

function aplicarControleAcesso(tipoAcesso) {
    var pathname = window.location.pathname;

    // Regras de bloqueio de rota direta por URL
    if (tipoAcesso === "FUNCIONARIO" || tipoAcesso === "COMUM") {
        // Funcionário comum: DASHZONA (não pode acessar rotas administrativas de servidores, empresas ou tokens)
        var rotasProibidasFuncionario = ["/servidores/", "/empresas/", "/cadastro_token"];
        for (var i = 0; i < rotasProibidasFuncionario.length; i++) {
            if (pathname.includes(rotasProibidasFuncionario[i])) {
                alert("Acesso restrito: seu perfil de funcionário possui acesso apenas às Dashboards.");
                window.location.href = "/dashboard/dash-geral.html";
                return;
            }
        }
    } else if (tipoAcesso === "GESTOR") {
        // Gestor: Tudo da sua empresa (funcionários, servidores, dash e tokens). NÃO acessa CRUD global de Empresas (InfraTech).
        if (pathname.includes("/empresas/")) {
            alert("Acesso restrito: gerenciamento de empresas parceiras é exclusivo da InfraTech.");
            window.location.href = "/dashboard/dash-geral.html";
            return;
        }
    }

    // Regras de visibilidade na Sidebar
    // 1. ADMIN (InfraTech): Foco no CRUD de empresas
    if (tipoAcesso === "ADMIN") {
        // Admin InfraTech tem foco no gerenciamento de empresas parceiras
        document.querySelectorAll(".secao-empresas, [href*='/empresas/']").forEach(function(el) {
            el.style.display = "";
        });
    }

    // 2. GESTOR: Vê servidores, funcionários/tokens e dashboards. Esconde CRUD de empresas.
    if (tipoAcesso === "GESTOR") {
        document.querySelectorAll(".secao-empresas, [href*='/empresas/']").forEach(function(el) {
            el.style.display = "none";
        });
        document.querySelectorAll(".secao-funcionarios, [href*='/funcionarios/']").forEach(function(el) {
            el.style.display = "";
        });
        document.querySelectorAll(".secao-servidores, [href*='/servidores/']").forEach(function(el) {
            el.style.display = "";
        });
    }

    // 3. FUNCIONARIO: Apenas Dashboards (esconde servidores, funcionários e empresas)
    if (tipoAcesso === "FUNCIONARIO" || tipoAcesso === "COMUM") {
        document.querySelectorAll(".secao-empresas, [href*='/empresas/']").forEach(function(el) {
            el.style.display = "none";
        });
        document.querySelectorAll(".secao-funcionarios, [href*='/funcionarios/']").forEach(function(el) {
            el.style.display = "none";
        });
        // Esconde itens de modificação/cadastro de servidores na sidebar
        document.querySelectorAll("[href*='cadastro_servidor'], [href*='cadastro_instancia'], [href*='modificar_servidor']").forEach(function(el) {
            el.style.display = "none";
        });
        var tituloServidores = document.querySelector(".nav-categoria-servidores, .nav-categoria");
        if (tituloServidores && !tituloServidores.classList.contains("secao-funcionarios") && !tituloServidores.classList.contains("secao-empresas")) {
            // Mantém visível apenas se houver link para dashboards
        }
    }
}

function limparSessao() {
    sessionStorage.clear();
    window.location.href = "/paginas/autenticacao/login/login.html";
}

// ----------- Loading -----------
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