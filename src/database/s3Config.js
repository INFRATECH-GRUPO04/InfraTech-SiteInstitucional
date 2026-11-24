var clientS3 = require("@aws-sdk/client-s3");

var s3 = new clientS3.S3Client({
    region: process.env.AWS_REGION || "us-east-1"
});

module.exports = s3;