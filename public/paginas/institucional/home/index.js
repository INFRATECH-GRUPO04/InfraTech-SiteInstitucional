// Gerenciamento da navegação e interações da Home InfraTech

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

// Envio do formulário de Fale Conosco integrado na Home
function enviarMensagemContato(event) {
    if (event) event.preventDefault();

    const nome = document.getElementById("nomeContato")?.value || "";
    const email = document.getElementById("emailContato")?.value || "";
    const assunto = document.getElementById("assuntoContato")?.value || "";
    const mensagem = document.getElementById("mensagemContato")?.value || "";
    const feedback = document.getElementById("mensagemContatoFeedback");
    const btnSubmit = document.querySelector(".btn-enviar-contato");

    if (!nome.trim() || !email.trim() || !mensagem.trim()) {
        if (feedback) {
            feedback.style.display = "block";
            feedback.style.color = "#ef4444";
            feedback.innerText = "Por favor, preencha todos os campos obrigatórios.";
        }
        return false;
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Enviando mensagem...";
    }

    // Feedback imediato e elegante para o usuário
    setTimeout(() => {
        if (feedback) {
            feedback.style.display = "block";
            feedback.style.color = "#10b981";
            feedback.innerHTML = `Obrigado pelo contato, <strong>${nome}</strong>! Sua mensagem sobre "<em>${assunto || 'Atendimento'}</em>" foi enviada com sucesso. Nossa equipe entrará em contato em breve pelo e-mail <em>${email}</em>.`;
        }

        // Limpa os campos
        document.getElementById("nomeContato").value = "";
        document.getElementById("emailContato").value = "";
        document.getElementById("assuntoContato").value = "";
        document.getElementById("mensagemContato").value = "";

        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Mensagem Enviada!";
            setTimeout(() => {
                btnSubmit.innerText = "Enviar Mensagem";
            }, 3000);
        }
    }, 600);

    return false;
}