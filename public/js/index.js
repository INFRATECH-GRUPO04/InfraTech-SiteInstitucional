// ----------- Navegação Home -----------
document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector("header");

    window.addEventListener("scroll", () => {
        if (window.scrollY > 40) {
            header?.classList.add("scrolled");
        } else {
            header?.classList.remove("scrolled");
        }
    });

    const btnHamburguer = document.querySelector(".btn-menu-hamburguer");
    const menuNav = document.querySelector("nav");

    if (btnHamburguer && menuNav) {
        btnHamburguer.addEventListener("click", () => {
            menuNav.classList.toggle("ativo");
        });

        document.querySelectorAll(".nav-container a").forEach(link => {
            link.addEventListener("click", () => {
                menuNav.classList.remove("ativo");
            });
        });
    }
});

// ----------- Fale Conosco -----------
function enviarMensagemContato(event) {
    if (event) event.preventDefault();

    const iptNome = document.getElementById("contato_nome") || document.getElementById("nomeContato");
    const iptEmail = document.getElementById("contato_email") || document.getElementById("emailContato");
    const iptAssunto = document.getElementById("contato_assunto") || document.getElementById("assuntoContato");
    const iptMensagem = document.getElementById("contato_mensagem") || document.getElementById("mensagemContato");
    const feedback = document.getElementById("feedback_contato") || document.getElementById("mensagemContatoFeedback");
    const btnSubmit = document.getElementById("btn-enviar-contato") || document.querySelector(".btn-enviar-contato");

    const nome = iptNome?.value || "";
    const email = iptEmail?.value || "";
    const assunto = iptAssunto?.value || "";
    const mensagem = iptMensagem?.value || "";

    if (!nome.trim() || !email.trim() || !mensagem.trim()) {
        if (feedback) {
            feedback.style.display = "block";
            feedback.style.color = "var(--cor-perigo, #dc2626)";
            feedback.innerText = "Por favor, preencha todos os campos obrigatórios.";
        }
        return false;
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Enviando mensagem...";
    }

    setTimeout(() => {
        if (feedback) {
            feedback.style.display = "block";
            feedback.style.color = "var(--cor-sucesso, #05df72)";
            feedback.innerHTML = `Obrigado pelo contato, <strong>${nome}</strong>! Sua mensagem sobre "<em>${assunto || 'Atendimento'}</em>" foi enviada com sucesso. Nossa equipe entrará em contato em breve pelo e-mail <em>${email}</em>.`;
        }

        if (iptNome) iptNome.value = "";
        if (iptEmail) iptEmail.value = "";
        if (iptAssunto) iptAssunto.value = "";
        if (iptMensagem) iptMensagem.value = "";

        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Mensagem Enviada!";
            setTimeout(() => {
                btnSubmit.innerText = "Enviar Mensagem";
            }, 3000);
        }
    }, 400);

    return false;
}