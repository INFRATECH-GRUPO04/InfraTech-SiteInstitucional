/*
 * Este arquivo: Conecta ao bucket S3 da AWS e recupera o arquivo dashboard.json
 * gerado pela ETL na camada Gold para a empresa autenticada.
 */
var { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

var configS3 = {
    region: process.env.AWS_REGION || "us-east-1"
};

// Só usa credenciais explícitas se estiverem preenchidas no .env (ambiente local).
// Na EC2, sem essas variáveis, o SDK usa a IAM Role da máquina automaticamente.
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    configS3.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN || undefined
    };
}

var s3Client = new S3Client(configS3);

async function buscarDashboardGeral() {
    var bucket = process.env.S3_BUCKET;
    var prefixoGold = (process.env.S3_GOLD_PREFIX || "03-gold/").replace(/\/+$/, "") + "/";
    var chaveArquivo = `${prefixoGold}dashboard_qa.json`;

    try {
        var comando = new GetObjectCommand({
            Bucket: bucket,
            Key: chaveArquivo
        });

        var resposta = await s3Client.send(comando);
        var conteudoTexto = await resposta.Body.transformToString("utf-8");

        return JSON.parse(conteudoTexto);
    } catch (erro) {
        if (erro.name === "NoSuchKey" || (erro.$metadata && erro.$metadata.httpStatusCode === 404)) {
            console.warn(`Arquivo ainda não encontrado no S3: ${chaveArquivo}`);
            return null;
        }
        throw erro;
    }
}

module.exports = {
    buscarDashboardGeral
};