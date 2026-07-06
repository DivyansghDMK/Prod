# AWS Deployment Guide

## Overview
This guide covers deploying the CardioX application to AWS.

## Prerequisites
- AWS Account with admin access
- AWS CLI installed and configured
- Git installed

---

## 1. AWS Infrastructure Setup

### 1.1 RDS PostgreSQL Database
1. Go to AWS Console → RDS
2. Create a new PostgreSQL database
3. Configuration:
   - Engine: PostgreSQL 15+
   - Instance type: db.t3.medium (minimum for production)
   - Multi-AZ deployment: Enabled for high availability
   - Storage: 20GB+
   - Public accessibility: Yes (for initial setup, then restrict to VPC)
4. Save the endpoint, username, and password
5. Update security group to allow inbound traffic on port 5432

### 1.2 S3 Bucket for File Storage
1. Go to AWS Console → S3
2. Create a new bucket with unique name
3. Configuration:
   - Block all public access: Yes
   - Bucket versioning: Enabled
   - Encryption: AES-256
4. Create an IAM user with S3 access permissions
5. Save the access key ID and secret access key

### 1.3 EC2 or ECS for Backend
**Option A: EC2 (simpler)**
1. Launch an EC2 instance (Amazon Linux 2 or Ubuntu 22.04)
2. Instance type: t3.small or larger
3. Security group: Allow inbound traffic on ports 80, 443, 22
4. Attach an IAM role with S3 access

**Option B: ECS/Fargate (better for scaling)**
1. Create an ECS cluster
2. Create task definition
3. Create service with load balancer

### 1.4 Optional: CloudFront for Frontend
1. Deploy frontend to S3 bucket
2. Create CloudFront distribution
3. Configure custom domain with Route 53

---

## 2. Environment Variables

Create a `.env` file in the backend directory with these values:

```bash
# Server
PORT=4000
NODE_ENV=production
API_VERSION=v1

# Database (from RDS)
DATABASE_URL=postgresql://username:password@rds-endpoint:5432/cardiox

# JWT (generate a strong secret)
JWT_SECRET=your_very_long_random_secret_key_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# OTP
OTP_EXPIRES_MINUTES=10

# Device Management
DEVICE_OFFLINE_THRESHOLD_MINUTES=5

# AWS
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket-name
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
```

---

## 3. Database Setup

1. Connect to your RDS PostgreSQL instance
2. Run the schema files in order:
   ```bash
   psql -h rds-endpoint -U username -d cardiox -f backend/db/schema/001_initial.sql
   psql -h rds-endpoint -U username -d cardiox -f backend/db/schema/002_rbac.sql
   psql -h rds-endpoint -U username -d cardiox -f backend/db/schema/003_auth_sessions.sql
   psql -h rds-endpoint -U username -d cardiox -f backend/db/schema/004_device_management.sql
   psql -h rds-endpoint -U username -d cardiox -f backend/db/schema/005_patient_management.sql
   psql -h rds-endpoint -U username -d cardiox -f backend/db/schema/006_ecg_reports.sql
   psql -h rds-endpoint -U username -d cardiox -f backend/db/schema/007_desktop_integration.sql
   psql -h rds-endpoint -U username -d cardiox -f backend/db/schema/008_secure_sessions.sql
   psql -h rds-endpoint -U username -d cardiox -f backend/db/schema/009_indexes.sql
   ```

---

## 4. Backend Deployment

### 4.1 Using EC2
```bash
# SSH into your EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Install dependencies
sudo yum update -y
sudo yum install -y git nodejs npm

# Clone repository
git clone https://github.com/DivyansghDMK/Prod.git
cd Prod/backend

# Install npm packages
npm install

# Create .env file with production values
nano .env

# Start the server
npm start

# Optional: Use PM2 for process management
npm install -g pm2
pm2 start server.js --name cardiox-backend
pm2 save
pm2 startup
```

### 4.2 Using Docker
See `Dockerfile` and `docker-compose.yml` in the backend directory.

---

## 5. Frontend Deployment

### 5.1 Build the frontend
```bash
cd HCP
npm install
npm run build
```

### 5.2 Deploy to S3 + CloudFront
1. Upload contents of `HCP/dist` to your S3 bucket
2. Configure CloudFront to serve the bucket
3. Set up custom domain (optional)

---

## 6. Security Best Practices

1. **Never commit .env files to git**
2. Use AWS Secrets Manager or Parameter Store instead of .env files in production
3. Enable HTTPS with ACM (AWS Certificate Manager)
4. Restrict security groups to necessary IPs
5. Enable CloudWatch for logging
6. Set up regular database backups
7. Use IAM roles instead of access keys where possible

---

## 7. Monitoring

- **CloudWatch**: Monitor server metrics, logs, and alarms
- **RDS Events**: Monitor database performance
- **S3 Access Logs**: Track file access

---

## 8. Domain Setup (Optional)

1. Register a domain via Route 53 or another provider
2. Create an SSL certificate via ACM
3. Configure DNS records to point to your load balancer/CloudFront
