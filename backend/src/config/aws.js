function getAwsConfig() {
  return {
    region: process.env.AWS_REGION || process.env.AWS_S3_REGION || "us-east-1",
    bucket: process.env.AWS_S3_BUCKET || "",
  };
}

module.exports = { getAwsConfig };
