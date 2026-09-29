
    function entrar() {
        var emailVar = emailInput.value;
        var senhaVar = passwordInput.value;

        if (emailVar == "" || senhaVar == "") {
            cardErro.style.display = "block"
            mensagem_erro.innerHTML = "(Mensagem de erro para todos os campos em branco)";
            return false;
        }
        
        fetch("/login_cadastro/autenticar", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                emailServer: emailVar,
                senhaServer: senhaVar
            })
            
        }).then(function (resposta) {
            console.log("ESTOU NO THEN DO entrar()!")

            if (resposta.ok) {
                console.log(resposta);
                console.log("Resposta ok");
                
                resposta.json().then(json => {
                    console.log("Resposta do json de login = ok. then(json)");
                    
                    console.log(json);
                    console.log(JSON.stringify(json));
                    sessionStorage.EMAIL_USUARIO = json.email;
                    sessionStorage.SENHA_USUARIO = json.senha;
                    sessionStorage.NOME_USUARIO = json.nome;
                    sessionStorage.ID_USUARIO = json.id_funcionario;
                    sessionStorage.ID_EMPRESA = json.id_empresa;
                    sessionStorage.TIPO_ACESSO = json.adm;
    

                    setTimeout(() => {
                        window.location.href = './dentro.html';
                    }, 2000);

                });

            } else {

                console.log("Houve um erro ao tentar realizar o login!");

            }

        
        })};