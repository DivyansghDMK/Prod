#!/bin/bash

# Backend Deployment Script for AWS EC2
# Make sure you have AWS CLI configured and your key pair ready

set -e

# Configuration
EC2_USER="ec2-user"
EC2_HOST="your-ec2-public-ip"
KEY_PATH="~/path/to/your-key.pem"
APP_DIR="/home/ec2-user/Prod"

echo "=== Starting backend deployment ==="

# Copy files to EC2
echo "Copying files to EC2..."
scp -i "$KEY_PATH" -r ../backend "$EC2_USER@$EC2_HOST:$APP_DIR/"

# SSH into EC2 and deploy
echo "Connecting to EC2 and deploying..."
ssh -i "$KEY_PATH" "$EC2_USER@$EC2_HOST" << EOF
  cd $APP_DIR/backend
  
  # Install dependencies
  echo "Installing dependencies..."
  npm ci --only=production
  
  # Check if PM2 is installed
  if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
  fi
  
  # Stop existing process if running
  echo "Stopping existing backend process..."
  pm2 stop cardiox-backend 2>/dev/null || true
  
  # Start the application with PM2
  echo "Starting backend..."
  pm2 start server.js --name cardiox-backend
  
  # Save PM2 process list
  pm2 save
  
  echo "Deployment complete!"
  pm2 status
EOF

echo "=== Backend deployed successfully ==="
