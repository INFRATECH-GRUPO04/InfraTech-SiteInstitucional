var clientS3 = require("@aws-sdk/client-s3");
var { fromInstanceMetadata } = require("@aws-sdk/credential-providers");

var s3 = new clientS3.S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: fromInstanceMetadata({ timeout: 5000, maxRetries: 3 })
});

module.exports = s3;