 function validar() {


        var nomeVar = nomeInput.value;
        var emailVar = emailInput.value;
        var senhaVar = passwordInput.value;
        var confirmacaoSenhaVar = confirmInput.value;
        let codigoVar = codigoInput.value;
        let cpfVar = cpfInput.value;
        let nascimentoVar = nascimentoInput.value;

        let indice_arroba = emailVar.indexOf("@");
        let indice_com = emailVar.indexOf(".com");
        let valida_cpf_numeros = /^\d+$/.test(cpfVar);

        if (nomeVar == "" || emailVar == "" || senhaVar == "" || confirmacaoSenhaVar == "" ||
            codigoVar == "" || cpfVar == "" || nascimentoVar == "") {

            exibirErro("Preencha todos os campos!");

            return false;

        } else if (indice_arroba == -1 || indice_com == -1) {

            exibirErro("Insira um email válido!");

            return false;

        } else if (senhaVar.length < 6) {

            exibirErro("Digite pelo menos 6 dígitos");

            return false;

        } else if (senhaVar != confirmacaoSenhaVar) {

            exibirErro("A senha está incorreta!") ;

            return false;

        } else if (cpfVar < 11 || valida_cpf_numeros == false) {

            exibirErro("CPF Inválido!");
            return false;

        } else if(nascimentoVar.length < 10) {

            exibirErro("A data de nascimento está incompleta!") ;

            return false;

        }else{

            setTimeout(sumirMensagem, 5000);
            confirmarEmailsIguais()

           return false;
        }
    }


function confirmarEmailsIguais() {
    var emailVar = emailInput.value;

    fetch("/login_cadastro/EmailsIguais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailServer: emailVar })
    }).then(function (resposta) {
        if (resposta.ok) {
        
            confirmarCodigoEmpresa(); 
        } else {
            
            resposta.text().then(texto => {
                exibirErro(texto);
            });
        }
    }).catch(function (erro) {
        console.log(erro);
    });
    return false;
}

function confirmarCodigoEmpresa() {
    var codigoVar = codigoInput.value;

    fetch("/login_cadastro/CodigoEmpresa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoServer: codigoVar })
    }).then(function (resposta) {
        if (resposta.ok) {
            
            resposta.json().then(json => {
                
                var idDaEmpresaRecebido = json.fk_empresa;
                
                
                cadastrar(idDaEmpresaRecebido); 
            });
        } else {
            
            resposta.text().then(texto => {
                exibirErro(texto);
            });
        }
    }).catch(function (erro) {
        console.log(erro);
    });
    return false;
}


function cadastrar(idDaEmpresa) {
  
    var nomeVar = nomeInput.value;
    var emailVar = emailInput.value;
    var senhaVar = passwordInput.value;
    var cpfVar = cpfInput.value;
    var nascimentoVar = nascimentoInput.value;

    var partesData = nascimentoVar.split('/');
    
    //transforma a data no formato do banco
    var dataFormatada = partesData[2] + '-' + partesData[1] + '-' + partesData[0];

    fetch("/login_cadastro/cadastrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            nomeServer: nomeVar,
            emailServer: emailVar,
            senhaServer: senhaVar,
            cpfServer: cpfVar,
            nascimentoServer: dataFormatada,
            fkEmpresaServer: idDaEmpresa 
        }),
    }).then(function (resposta) {
        console.log("resposta: ", resposta);

        if (resposta.ok) {
            
            cardErro.style.display = "block";
            mensagem_erro.innerHTML = "Cadastro realizado com sucesso!";
            
            setTimeout(() => {
                window.location = "login.html";
            }, 3000);
        } else {
            throw "Houve um erro ao tentar realizar o cadastro!";
        }
    }).catch(function (resposta) {
        console.log(`#ERRO: ${resposta}`);
    });

    return false;
}

let cronometroErro;

function exibirErro(mensagem) {
    
    let divCardErro = document.getElementById("cardErro");
    let spanMensagemErro = document.getElementById("mensagem_erro");

    clearTimeout(cronometroErro);

    divCardErro.style.display = "block";
    spanMensagemErro.innerHTML = mensagem;

   
    cronometroErro = setTimeout(function() {
        divCardErro.style.display = "none";
    }, 4000); 
}

let inputNascimento = document.getElementById('nascimentoInput');

inputNascimento.addEventListener('input', function(e) {
    // Remove tudo que não for número
    let valor = e.target.value.replace(/\D/g, "");
    
    // Adiciona as barras no lugar certo
    valor = valor.replace(/(\d{2})(\d)/, "$1/$2");
    valor = valor.replace(/(\d{2})(\d)/, "$1/$2");
    
    // Atualiza o input
    e.target.value = valor;
});

function sumirMensagem() {
    cardErro.style.display = "none";
  }