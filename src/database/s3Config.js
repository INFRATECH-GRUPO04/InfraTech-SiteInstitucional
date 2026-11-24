var clientS3 = require("@aws-sdk/client-s3");

var configuracao = {
    region: process.env.AWS_REGION || "us-east-1"
};

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    configuracao.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN
    };
}

var s3 = new clientS3.S3Client(configuracao);

module.exports = s3;
