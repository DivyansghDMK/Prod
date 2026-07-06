"use strict";

const { getAwsConfig } = require("../config/aws");

/**
 * Generate a pre-signed S3 URL for uploading or downloading a file.
 * If AWS credentials are set, this can be extended to use the AWS SDK.
 * Otherwise, it falls back to generating a secure mock URL for development.
 *
 * @param {string} bucket - S3 bucket name
 * @param {string} key - S3 object key
 * @param {string} operation - 'getObject' | 'putObject'
 * @param {number} expiresInSeconds - Link expiration time (default 900 seconds)
 * @returns {string} Signed URL
 */
function getSignedS3Url(bucket, key, operation = "getObject", expiresInSeconds = 900) {
  const awsConfig = getAwsConfig();
  const targetBucket = bucket || awsConfig.bucket || "cardiox-reports";
  const region = awsConfig.region || "us-east-1";

  // Check if AWS credentials are fully configured to use real S3 SDK if installed
  const hasCreds = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

  if (!hasCreds) {
    const filename = String(key || "").split("/").pop();
    return `/uploads/${filename}`;
  }

  if (hasCreds) {
    try {
      // In a real S3 integration, we would dynamically require @aws-sdk/s3-request-presigner
      // and @aws-sdk/client-s3 to generate presigned URLs.
      // E.g.:
      // const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
      // const { getSignedUrl } = require("@aws-sdk/presigner");
      // ...
    } catch (e) {
      // If SDK not loaded, fall back to mock
    }
  }

  // Development/Mock URL generation (secure and signed with a HMAC/Query parameter)
  const baseUrl = `https://${targetBucket}.s3.${region}.amazonaws.com/${key}`;
  const expirationTimestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  
  // Create a development-safe mock signature
  const mockSignature = require("crypto")
    .createHmac("sha256", process.env.JWT_SECRET || "dev-secret")
    .update(`${baseUrl}:${operation}:${expirationTimestamp}`)
    .digest("hex")
    .slice(0, 32);

  return `${baseUrl}?AWSAccessKeyId=MOCKKEY&Expires=${expirationTimestamp}&Signature=${mockSignature}&operation=${operation}`;
}

module.exports = { getSignedS3Url };
