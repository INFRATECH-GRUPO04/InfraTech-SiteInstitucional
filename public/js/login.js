async function entrar() {
    const email = document.getElementById('emailInput').value.trim();
    const senha = document.getElementById('passwordInput').value;
    const botao = document.getElementById('btn_entrar');
    const card = document.getElementById('cardErro');
    const mensagem = document.getElementById('mensagem_erro');
    function informar(texto, sucesso = false) {
        if (!card || !mensagem) return alert(texto);
        card.style.display = 'block';
        card.style.borderColor = sucesso ? 'var(--cor-sucesso, #05df72)' : 'var(--cor-perigo, #ff3366)';
        mensagem.textContent = texto;
    }
    if (!email || !senha) { informar('Preencha o e-mail e a senha.'); return false; }
    if (botao) { botao.disabled = true; botao.textContent = 'Autenticando...'; }
    try {
        const resposta = await fetch('/login_cadastro/autenticar', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailServer: email, senhaServer: senha })
        });
        if (!resposta.ok) throw new Error((await resposta.text()) || 'Não foi possível entrar.');
        const usuario = await resposta.json();
        if (!InfraTechPermissoes.obter(usuario.tipoAcesso).monitorar) throw new Error('Cargo sem acesso configurado.');
        sessionStorage.EMAIL_USUARIO = usuario.email;
        sessionStorage.NOME_USUARIO = usuario.nome || usuario.email;
        sessionStorage.ID_USUARIO = usuario.idFuncionario;
        sessionStorage.ID_EMPRESA = usuario.idEmpresa;
        sessionStorage.TIPO_ACESSO = usuario.tipoAcesso;
        sessionStorage.removeItem('SENHA_USUARIO');
        informar('Login realizado! Abrindo sua página...', true);
        window.location.assign(usuario.destino || obterDestinoInicial(usuario.tipoAcesso));
    } catch (erro) {
        informar(erro instanceof TypeError ? 'Não foi possível conectar ao servidor. Verifique se ele está iniciado.' : erro.message);
    } finally {
        if (botao) { botao.disabled = false; botao.textContent = 'Entrar no Sistema'; }
    }
    return false;
}
