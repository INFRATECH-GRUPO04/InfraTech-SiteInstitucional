// Sessão InfraTech
function validarSessao() {
    var email = sessionStorage.EMAIL_USUARIO;
    var nome = sessionStorage.NOME_USUARIO;

    var b_usuario = document.getElementById("b_usuario");
    var nome_usuario = document.getElementById("nome_usuario");

    if (email != null && nome != null) {
        if (b_usuario) {
            b_usuario.textContent = nome;
        }
        if (nome_usuario) {
            nome_usuario.textContent = nome;
        }
    } else {
        // Redireciona para a página de login se não houver sessão ativa
        var caminhoLogin = window.location.pathname.includes("/paginas/pos-login/")
            ? "../../autenticacao/login/login.html"
            : "/paginas/autenticacao/login/login.html";
        window.location.href = caminhoLogin;
    }
}

function limparSessao() {
    sessionStorage.clear();
    var caminhoLogin = window.location.pathname.includes("/paginas/pos-login/")
        ? "../../autenticacao/login/login.html"
        : "/paginas/autenticacao/login/login.html";
    window.location.href = caminhoLogin;
}

// Carregamento (loading)
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