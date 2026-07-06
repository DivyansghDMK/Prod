#!/bin/bash

# Frontend Deployment Script for AWS S3 + CloudFront
# Make sure you have AWS CLI configured

set -e

# Configuration
S3_BUCKET="your-s3-bucket-name"
CLOUDFRONT_DISTRIBUTION_ID="your-cloudfront-distribution-id"  # Optional
FRONTEND_DIR="../HCP"

echo "=== Starting frontend deployment ==="

# Build the frontend
echo "Building frontend..."
cd "$FRONTEND_DIR"
npm install
npm run build

# Upload to S3
echo "Uploading to S3..."
aws s3 sync dist/ "s3://$S3_BUCKET/" --delete

# Invalidate CloudFront cache (optional)
if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
  echo "Invalidating CloudFront cache..."
  aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*"
fi

echo "=== Frontend deployed successfully ==="
