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

// ----------- Fale Conosco (EmailJS) -----------
const EMAILJS_PUBLIC_KEY = "D9fz0v6QW3lOWXZS5";
const EMAILJS_SERVICE_ID = "service_7t4b4j4";
const EMAILJS_TEMPLATE_ID = "template_ss6qs7s";

if (typeof emailjs !== "undefined") {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

let timerMensagemEnviada = null;

function criarElementoFeedback(tag, texto) {
    const elemento = document.createElement(tag);
    elemento.textContent = texto;
    return elemento;
}

function definirFeedback(feedback, tipo, conteudo) {
    if (!feedback) return;

    feedback.style.display = "block";
    feedback.style.color = tipo === "erro"
        ? "var(--cor-perigo, #dc2626)"
        : "var(--cor-sucesso, #05df72)";

    if (typeof conteudo === "string") {
        feedback.textContent = conteudo;
    } else {
        feedback.replaceChildren(conteudo);
    }
}

async function enviarMensagemContato(event) {
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

    if (!nome.trim() || !email.trim() || !assunto.trim() || !mensagem.trim()) {
        definirFeedback(feedback, "erro", "Por favor, preencha todos os campos obrigatórios.");
        return false;
    }

    if (typeof emailjs === "undefined") {
        definirFeedback(feedback, "erro", "Não foi possível carregar o serviço de e-mail. Recarregue a página e tente novamente.");
        return false;
    }

    if (timerMensagemEnviada) {
        clearTimeout(timerMensagemEnviada);
        timerMensagemEnviada = null;
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Enviando mensagem...";
    }

    try {
        await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            {
                nome: nome.trim(),
                email: email.trim(),
                assunto: assunto.trim(),
                mensagem: mensagem.trim(),
                data_envio: new Date().toLocaleString("pt-BR")
            }
        );

        const conteudoSucesso = document.createDocumentFragment();
        conteudoSucesso.append(
            "Obrigado pelo contato, ",
            criarElementoFeedback("strong", nome.trim()),
            '! Sua mensagem sobre "',
            criarElementoFeedback("em", assunto.trim()),
            '" foi enviada com sucesso. Nossa equipe entrará em contato em breve pelo e-mail ',
            criarElementoFeedback("em", email.trim()),
            "."
        );
        definirFeedback(feedback, "sucesso", conteudoSucesso);

        if (iptNome) iptNome.value = "";
        if (iptEmail) iptEmail.value = "";
        if (iptAssunto) iptAssunto.value = "";
        if (iptMensagem) iptMensagem.value = "";

        if (btnSubmit) {
            btnSubmit.innerText = "Mensagem Enviada!";
            timerMensagemEnviada = setTimeout(() => {
                if (btnSubmit) btnSubmit.innerText = "Enviar Mensagem";
                timerMensagemEnviada = null;
            }, 3000);
        }
    } catch (erro) {
        console.error("Erro ao enviar mensagem de contato:", erro);
        definirFeedback(feedback, "erro", "Não foi possível enviar sua mensagem. Tente novamente em instantes.");
        if (btnSubmit) btnSubmit.innerText = "Enviar Mensagem";
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }

    return false;
}
