// ----------- Sessão -----------
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
        window.location.href = "/paginas/autenticacao/login/login.html";
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