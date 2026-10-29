var crypto = require("crypto");
var fs = require("fs");
var clientS3 = require("@aws-sdk/client-s3");
var agenteModel = require("../models/agenteModel");

// Na EC2 com perfil de acesso (IAM role), o SDK pega as credenciais sozinho
var s3 = new clientS3.S3Client({ region: process.env.AWS_REGION || "us-east-1" });

// Primeira linha que cada tipo de CSV precisa ter (é a mesma que o script Python gera)
var CABECALHOS = {
    dados: "id_empresa,id_servidor,username,data_hora,cpu,inte_cpu,ram_disponivel,ram_total,ram,disco,disco_disponivel,disco_total,bytes_enviados,bytes_recebidos,pacotes_enviados,pacotes_recebidos",
    processos: "id_empresa,id_servidor,Usuario,data_hora,PID,Nome,Username"
};

// Roda antes das duas rotas: confere a chave e descobre de qual servidor ela é
function validarChave(req, res, next) {
    var chave = req.headers["x-chave-servidor"];

    if (!chave || chave.length > 200) {
        return res.status(401).json({ erro: "Chave do servidor não enviada ou inválida" });
    }

    // O banco guarda só o hash da chave, nunca a chave
    var hash = crypto.createHash("sha256").update(chave).digest("hex");

    agenteModel.buscarPorChave(hash)
        .then(function (resultado) {
            if (resultado.length == 0) {
                return res.status(401).json({ erro: "Chave inválida" });
            }
            req.servidor = resultado[0];  // As próximas funções usam isso
            next();
        })
        .catch(function (erro) {
            console.log(erro);
            res.status(500).json({ erro: "Erro ao validar a chave" });
        });
}

// POST /agente/autenticar: o script usa para saber de qual empresa e servidor ele é
function autenticar(req, res) {
    res.json({
        idEmpresa: req.servidor.idEmpresa,
        idServidor: req.servidor.idServidor,
        nomeServidor: req.servidor.nomeServidor
    });
}

// POST /agente/enviar: recebe um CSV do script e grava no bronze
function enviar(req, res) {
    var tipo = req.headers["x-tipo-arquivo"];
    var lote = req.headers["x-lote-inicio"];
    var csv = req.body;

    if (tipo != "dados" && tipo != "processos") {
        return res.status(400).json({ erro: "Tipo de arquivo inválido" });
    }
    if (!/^\d{8}T\d{6}Z$/.test(lote)) {
        return res.status(400).json({ erro: "Lote inválido" });
    }
    if (typeof csv != "string") {
        return res.status(400).json({ erro: "Envie o CSV com Content-Type text/csv" });
    }

    var linhas = csv.split("\n");
    if (linhas[0].trim() != CABECALHOS[tipo]) {
        return res.status(400).json({ erro: "Cabeçalho do CSV diferente do esperado" });
    }

    // Não confia no que veio no arquivo: troca as 2 primeiras colunas pelos valores da chave
    var idEmpresa = req.servidor.idEmpresa;
    var idServidor = req.servidor.idServidor;
    for (var i = 1; i < linhas.length; i++) {
        if (linhas[i].trim() == "") {
            continue;
        }
        var primeira = linhas[i].indexOf(",");
        var segunda = linhas[i].indexOf(",", primeira + 1);
        if (primeira == -1 || segunda == -1) {
            return res.status(400).json({ erro: "Linha inválida no CSV" });
        }
        linhas[i] = idEmpresa + "," + idServidor + linhas[i].substring(segunda);
    }
    var conteudo = linhas.join("\n");

    // O nome é montado aqui, no back-end. O script não escolhe onde grava.
    var nomeArquivo = "01-bronze/" + lote + "_empresa-" + idEmpresa + "_servidor-" + idServidor + "_" + tipo + ".csv";

    var gravacao;
    if (process.env.S3_BUCKET) {
        gravacao = s3.send(new clientS3.PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: nomeArquivo,
            Body: conteudo,
            ContentType: "text/csv"
        }));
    } else {
        // Sem S3_BUCKET no .env: grava numa pasta local (SÓ para testar no seu computador)
        fs.mkdirSync("01-bronze", { recursive: true });
        fs.writeFileSync(nomeArquivo, conteudo);
        gravacao = Promise.resolve();
    }

    gravacao
        .then(function () {
            return agenteModel.registrarEnvio(idServidor);
        })
        .then(function () {
            res.status(200).json({ ok: true, arquivo: nomeArquivo });
        })
        .catch(function (erro) {
            console.log(erro);
            res.status(500).json({ erro: "Falha ao gravar o arquivo" });  // O script mantém o arquivo e reenvia
        });
}

module.exports = {
    validarChave,
    autenticar,
    enviar
};
