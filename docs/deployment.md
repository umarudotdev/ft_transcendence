# Deployment with Kamal on AWS

This guide covers deploying ft_transcendence to AWS using
[Kamal](https://kamal-deploy.org/), a deployment tool from 37signals that uses
Docker containers.

## Prerequisites

- AWS account with appropriate permissions
- [AWS CLI](https://aws.amazon.com/cli/) installed and configured
- [Kamal CLI](https://kamal-deploy.org/docs/installation/) installed:
  `gem install kamal`
- Docker installed on your local machine

## Architecture Overview

```
                         ┌─────────────────────────────────────────┐
                         │            Route 53 (DNS)               │
                         │    yourdomain.com → EC2 Public IP       │
                         │    api.yourdomain.com → EC2 Public IP   │
                         └─────────────────┬───────────────────────┘
                                           │
                         ┌─────────────────▼───────────────────────┐
                         │         EC2 Instance (t3.medium)        │
                         │  ┌───────────────────────────────────┐  │
                         │  │        Traefik Proxy              │  │
                         │  │   (SSL via Let's Encrypt)         │  │
                         │  └───────────┬───────────┬───────────┘  │
                         │              │           │              │
                         │   ┌──────────▼───┐ ┌─────▼──────────┐   │
                         │   │ API Service  │ │  Web Service   │   │
                         │   │ (ElysiaJS)   │ │  (SvelteKit)   │   │
                         │   │ Port 3000    │ │  Port 3000     │   │
                         │   └──────┬───────┘ └────────────────┘   │
                         │          │                              │
                         │   ┌──────▼───────┐                      │
                         │   │ PostgreSQL   │                      │
                         │   │ (Docker)     │                      │
                         │   └──────────────┘                      │
                         └─────────────────────────────────────────┘

                         ┌─────────────────────────────────────────┐
                         │              AWS ECR                    │
                         │   ft-transcendence-api:latest           │
                         │   ft-transcendence-web:latest           │
                         └─────────────────────────────────────────┘
```

## Quick Start (Automated)

Run the setup script to create all AWS resources automatically:

```bash
# Make sure AWS CLI is configured
aws configure

# Run the setup script
./scripts/aws-setup.sh
```

This creates:

- ECR repositories for API and Web images
- Security group with ports 22, 80, 443
- SSH key pair
- EC2 instance (t3.medium, Ubuntu 24.04)

Then follow the output instructions to complete deployment.

## AWS Setup (Manual)

### 1. Create ECR Repositories

```bash
# Set your region
export AWS_REGION=eu-west-1

# Create repositories
aws ecr create-repository --repository-name ft-transcendence-api --region $AWS_REGION
aws ecr create-repository --repository-name ft-transcendence-web --region $AWS_REGION
```

### 2. Launch EC2 Instance

**Recommended specs:**

- **Instance type**: t3.medium (2 vCPU, 4GB RAM) minimum
- **AMI**: Ubuntu 24.04 LTS
- **Storage**: 30GB gp3
- **Security Group**: Allow ports 22, 80, 443

```bash
# Create security group
aws ec2 create-security-group \
  --group-name ft-transcendence-sg \
  --description "ft_transcendence security group"

# Allow SSH, HTTP, HTTPS
aws ec2 authorize-security-group-ingress --group-name ft-transcendence-sg --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name ft-transcendence-sg --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name ft-transcendence-sg --protocol tcp --port 443 --cidr 0.0.0.0/0
```

**Create a key pair:**

```bash
aws ec2 create-key-pair \
  --key-name ft-transcendence \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/ft-transcendence.pem

chmod 400 ~/.ssh/ft-transcendence.pem
```

**Launch instance:**

```bash
aws ec2 run-instances \
  --image-id ami-0c38b837cd80f13bb \
  --instance-type t3.medium \
  --key-name ft-transcendence \
  --security-groups ft-transcendence-sg \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=ft-transcendence}]'
```

### 3. Configure DNS (Route 53)

Create A records pointing to your EC2 public IP:

- `yourdomain.com` → EC2 Public IP
- `api.yourdomain.com` → EC2 Public IP

### 4. Create IAM User for Deployments

```bash
# Create user
aws iam create-user --user-name kamal-deploy

# Attach ECR policy
aws iam attach-user-policy \
  --user-name kamal-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

# Create access key (save these!)
aws iam create-access-key --user-name kamal-deploy
```

## Configuration

### 1. Set Up Secrets

```bash
cp .kamal/secrets.example .kamal/secrets
```

Edit `.kamal/secrets`:

```bash
# AWS Configuration
AWS_ACCOUNT_ID=123456789012
AWS_REGION=eu-west-1
AWS_EC2_HOST=ec2-xx-xx-xx-xx.eu-west-1.compute.amazonaws.com
DOMAIN=yourdomain.com

# ECR password (refresh before each deploy - valid for 12 hours)
KAMAL_REGISTRY_PASSWORD=$(aws ecr get-login-password --region eu-west-1)

# Database
DATABASE_URL=postgres://postgres:STRONG_PASSWORD_HERE@ft-transcendence-api-db:5432/ft_transcendence
POSTGRES_USER=postgres
POSTGRES_PASSWORD=STRONG_PASSWORD_HERE

# Application URLs
FRONTEND_URL=https://yourdomain.com
PUBLIC_API_URL=https://api.yourdomain.com

# 42 OAuth
INTRA_CLIENT_ID=your-client-id
INTRA_CLIENT_SECRET=your-client-secret
INTRA_REDIRECT_URI=https://api.yourdomain.com/api/auth/42/callback

# Encryption keys (generate with: openssl rand -hex 32)
TOTP_ENCRYPTION_KEY=your-32-char-hex-key
CHAT_ENCRYPTION_KEY=your-32-char-hex-key
```

### 2. Generate Encryption Keys

```bash
# Generate secure keys
echo "TOTP_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "CHAT_ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

### 3. Refresh ECR Token

ECR tokens expire after 12 hours. Create a helper script:

```bash
# Create deploy script
cat > deploy.sh << 'EOF'
#!/bin/bash
set -e

# Refresh ECR token
export KAMAL_REGISTRY_PASSWORD=$(aws ecr get-login-password --region $AWS_REGION)

# Source other secrets
source .kamal/secrets

# Deploy
kamal deploy "$@"
EOF

chmod +x deploy.sh
```

## Deployment

### First-Time Setup

```bash
# 1. Refresh ECR token
export KAMAL_REGISTRY_PASSWORD=$(aws ecr get-login-password --region eu-west-1)

# 2. Bootstrap server (installs Docker)
kamal server bootstrap

# 3. Deploy API (includes database)
kamal setup

# 4. Deploy Web
kamal deploy -d web
```

### Regular Deployments

```bash
# Refresh ECR token first!
export KAMAL_REGISTRY_PASSWORD=$(aws ecr get-login-password --region eu-west-1)

# Deploy API
kamal deploy

# Deploy Web
kamal deploy -d web
```

### Using the Deploy Script

```bash
./deploy.sh          # Deploy API
./deploy.sh -d web   # Deploy Web
```

## Operations

### View Logs

```bash
# API logs
kamal app logs

# Web logs
kamal app logs -d web

# Database logs
kamal accessory logs db

# Traefik logs
kamal proxy logs
```

### SSH Access

```bash
# SSH into EC2
ssh -i ~/.ssh/ft-transcendence.pem ubuntu@$AWS_EC2_HOST

# Execute command in API container
kamal app exec "bun run --help"

# Interactive shell in container
kamal app exec --interactive /bin/sh
```

### Database Operations

```bash
# Access PostgreSQL
kamal accessory exec db "psql -U postgres -d ft_transcendence"

# Backup database
kamal accessory exec db "pg_dump -U postgres ft_transcendence" > backup.sql

# Restore database
cat backup.sql | kamal accessory exec db "psql -U postgres -d ft_transcendence"
```

### Rollback

```bash
kamal rollback        # Rollback API
kamal rollback -d web # Rollback Web
```

## Production Considerations

### Use AWS RDS (Recommended)

For production, consider using AWS RDS instead of containerized PostgreSQL:

1. Create RDS PostgreSQL instance
2. Update `DATABASE_URL` in secrets
3. Remove `db` accessory from `config/deploy.yml`

```bash
# Example RDS connection string
DATABASE_URL=postgres://postgres:password@mydb.xxxxx.eu-west-1.rds.amazonaws.com:5432/ft_transcendence
```

### Enable CloudWatch Logging

Add to your EC2 instance for centralized logging:

```bash
# Install CloudWatch agent on EC2
sudo apt-get install amazon-cloudwatch-agent
```

### Set Up Auto-Scaling (Optional)

For high availability, consider:

1. Create an AMI from your configured EC2
2. Set up an Auto Scaling Group
3. Add an Application Load Balancer
4. Enable sticky sessions for WebSocket support

### Cost Estimate

| Resource      | Specification   | Monthly Cost (approx) |
| ------------- | --------------- | --------------------- |
| EC2 t3.medium | 2 vCPU, 4GB RAM | ~$30                  |
| EBS 30GB gp3  | Storage         | ~$3                   |
| ECR           | 10GB images     | ~$1                   |
| Data Transfer | 100GB out       | ~$9                   |
| **Total**     |                 | **~$43/month**        |

## Troubleshooting

### ECR Authentication Failed

```bash
# Refresh token
aws ecr get-login-password --region $AWS_REGION | docker login \
  --username AWS \
  --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

### SSH Connection Refused

```bash
# Check security group allows port 22
aws ec2 describe-security-groups --group-names ft-transcendence-sg

# Verify key permissions
chmod 400 ~/.ssh/ft-transcendence.pem
```

### Container Won't Start

```bash
# Check container logs
kamal app logs --lines 100

# Check if port is in use
kamal app exec "netstat -tlnp"
```

### SSL Certificate Issues

```bash
# Check Traefik logs
kamal proxy logs

# Verify DNS propagation
dig yourdomain.com
dig api.yourdomain.com
```

## Security Checklist

- [ ] Strong database password (use `openssl rand -base64 32`)
- [ ] Unique encryption keys for TOTP and chat
- [ ] SSH key-based authentication only
- [ ] Security group limits SSH to your IP
- [ ] Regular security updates on EC2
- [ ] ECR image scanning enabled
- [ ] CloudWatch alarms for unusual activity

## CI/CD with GitHub Actions

The project includes automated deployment via GitHub Actions.

### Setup

1. **Add Repository Variables** (Settings → Secrets and variables → Actions →
   Variables):

   | Variable         | Example                                           |
   | ---------------- | ------------------------------------------------- |
   | `AWS_REGION`     | `eu-west-1`                                       |
   | `AWS_ACCOUNT_ID` | `123456789012`                                    |
   | `AWS_EC2_HOST`   | `ec2-xx-xx-xx-xx.eu-west-1.compute.amazonaws.com` |
   | `DOMAIN`         | `yourdomain.com`                                  |

2. **Add Repository Secrets** (Settings → Secrets and variables → Actions →
   Secrets):

   | Secret                  | Description                               |
   | ----------------------- | ----------------------------------------- |
   | `AWS_ACCESS_KEY_ID`     | IAM user access key                       |
   | `AWS_SECRET_ACCESS_KEY` | IAM user secret key                       |
   | `SSH_PRIVATE_KEY`       | Contents of `~/.ssh/ft-transcendence.pem` |
   | `DATABASE_URL`          | PostgreSQL connection string              |
   | `FRONTEND_URL`          | `https://yourdomain.com`                  |
   | `PUBLIC_API_URL`        | `https://api.yourdomain.com`              |
   | `POSTGRES_USER`         | Database username                         |
   | `POSTGRES_PASSWORD`     | Database password                         |
   | `TOTP_ENCRYPTION_KEY`   | 32-char hex key                           |
   | `CHAT_ENCRYPTION_KEY`   | 32-char hex key                           |
   | `INTRA_CLIENT_ID`       | 42 OAuth client ID (optional)             |
   | `INTRA_CLIENT_SECRET`   | 42 OAuth client secret (optional)         |
   | `INTRA_REDIRECT_URI`    | 42 OAuth redirect URI (optional)          |

3. **Create Production Environment** (Settings → Environments → New
   environment):
   - Name: `production`
   - Add protection rules if desired (required reviewers, wait timer)

### Deployment Workflow

**Automatic deployment** triggers on push to `main`/`master`:

- Runs tests (lint, typecheck)
- Deploys API and Web in parallel

**Manual deployment** via Actions tab:

- Select "Deploy" workflow
- Click "Run workflow"
- Choose service: `all`, `api`, or `web`

### Workflow Files

| File                           | Purpose                                  |
| ------------------------------ | ---------------------------------------- |
| `.github/workflows/ci.yml`     | PR checks (lint, typecheck, test, build) |
| `.github/workflows/deploy.yml` | Production deployment to AWS             |
