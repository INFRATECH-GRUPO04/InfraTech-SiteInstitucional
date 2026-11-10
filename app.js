/*
 * Este arquivo inicia o backend: carrega as configurações, prepara o Express,
 * instala proteções comuns e conecta cada endereço da API ao módulo responsável.
 */
// var ambiente_processo = 'producao';
var ambiente_processo = 'desenvolvimento';

var caminho_env = ambiente_processo === 'producao' ? '.env' : '.env.dev';
// Acima, temos o uso do operador ternário para definir o caminho do arquivo .env
// A sintaxe do operador ternário é: condição ? valor_se_verdadeiro : valor_se_falso

require("dotenv").config({ path: caminho_env });

console.log("ARQUIVO ENV:", caminho_env);
console.log("BANCO CARREGADO:", process.env.DB_DATABASE);

var express = require("express");
var cors = require("cors");
var path = require("path");
var fs = require("fs");
var PORTA_APP = process.env.APP_PORT;
var HOST_APP = process.env.APP_HOST;

/* Cria a aplicação principal e carrega os módulos que dividem as funcionalidades
 * em rotas, regras de acesso e operações específicas do sistema.
 */
var app = express();

var indexRouter = require("./src/routes/index");
var login_cadastroRouter = require("./src/routes/login_cadastro");
var servidorRouter = require("./src/routes/servidor")
var cadastro_empresaRouter = require("./src/routes/cadastro_empresa");
var gerenciar_empresaRouter = require("./src/routes/gerenciarEmpresa");
var gerenciarFuncionarioRouter = require("./src/routes/gerenciar_funcionario")
var agenteRouter = require("./src/routes/agente")

var cryptoRouter = require("./src/routes/crypto");
var autorizacao = require("./src/seguranca/autorizacao");

/* Converte JSON e formulários recebidos para req.body e protege as páginas antes
 * de publicá-las. As páginas, estilos e scripts do navegador ficam em pastas
 * planas; este resolvedor encontra cada arquivo pelo nome e mantém os endereços
 * antigos usados nos links, sem afetar os arquivos restantes de public.
 */
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// Verifica o acesso às páginas protegidas antes de servir os arquivos públicos.
app.use(autorizacao.bloquearPagina);
app.use(function (req, res, next) {
    var extensao = path.extname(req.path).toLowerCase();
    var pastasFront = {
        ".html": path.join(__dirname, "public", "html"),
        ".css": path.join(__dirname, "public", "css"),
        ".js": path.join(__dirname, "public", "js")
    };
    var pasta = pastasFront[extensao];

    if (req.path === "/") {
        return res.sendFile(path.join(pastasFront[".html"], "inicio.html"));
    }

    if (!pasta) return next();

    var nomeArquivo = path.basename(req.path);
    if (extensao === ".html" && req.path === "/index.html") {
        nomeArquivo = "inicio.html";
    }

    var arquivo = path.join(pasta, nomeArquivo);
    if (!fs.existsSync(arquivo) || !fs.statSync(arquivo).isFile()) return next();

    return res.sendFile(arquivo);
});
app.use(express.static(path.join(__dirname, "public")));

app.use(cors());

/* Liga cada prefixo de URL ao seu módulo de rotas. Nas áreas restritas, a sessão
 * e a permissão são verificadas antes que a chamada alcance a funcionalidade.
 */
app.use("/", indexRouter);
app.use("/login_cadastro", login_cadastroRouter);
app.use("/crypto", autorizacao.autenticar, autorizacao.exigirPermissao('administrar'), cryptoRouter);
app.use("/servidor", autorizacao.autenticar, servidorRouter);
app.use("/cadastro_empresa", autorizacao.autenticar, autorizacao.exigirPermissao('gerenciarEmpresas'), cadastro_empresaRouter);
app.use("/gerenciar_empresa", autorizacao.autenticar, autorizacao.exigirPermissao('gerenciarEmpresas'), gerenciar_empresaRouter);
app.use("/gerenciar-empresa", autorizacao.autenticar, autorizacao.exigirPermissao('gerenciarEmpresas'), gerenciar_empresaRouter);
app.use("/gerenciar_funcionario", autorizacao.autenticar, autorizacao.exigirPermissao('administrar'), gerenciarFuncionarioRouter);
app.use("/agente", agenteRouter)

module.exports = app;

if (require.main === module) app.listen(PORTA_APP, function () {
    console.log(`
    ##   ##  ######   #####             ####       ##     ######     ##              ##  ##    ####    ######  
    ##   ##  ##       ##  ##            ## ##     ####      ##      ####             ##  ##     ##         ##  
    ##   ##  ##       ##  ##            ##  ##   ##  ##     ##     ##  ##            ##  ##     ##        ##   
    ## # ##  ####     #####    ######   ##  ##   ######     ##     ######   ######   ##  ##     ##       ##    
    #######  ##       ##  ##            ##  ##   ##  ##     ##     ##  ##            ##  ##     ##      ##     
    ### ###  ##       ##  ##            ## ##    ##  ##     ##     ##  ##             ####      ##     ##      
    ##   ##  ######   #####             ####     ##  ##     ##     ##  ##              ##      ####    ######  
    \n\n\n                                                                                                 
    Servidor do seu site já está rodando! Acesse o caminho a seguir para visualizar .: http://${HOST_APP}:${PORTA_APP} :. \n\n
    Você está rodando sua aplicação em ambiente de .:${process.env.AMBIENTE_PROCESSO}:. \n\n
    \tSe .:desenvolvimento:. você está se conectando ao banco local. \n
    \tSe .:producao:. você está se conectando ao banco remoto. \n\n
    \t\tPara alterar o ambiente, comente ou descomente as linhas 1 ou 2 no arquivo 'app.js'\n\n`);
});
