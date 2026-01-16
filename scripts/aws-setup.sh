#!/bin/bash
# AWS Infrastructure Setup Script for ft_transcendence
# This script creates all necessary AWS resources for deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration (override with environment variables)
AWS_REGION="${AWS_REGION:-eu-west-1}"
PROJECT_NAME="${PROJECT_NAME:-ft-transcendence}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.medium}"
KEY_NAME="${KEY_NAME:-ft-transcendence}"
VOLUME_SIZE="${VOLUME_SIZE:-30}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ft_transcendence AWS Setup Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Region: ${YELLOW}${AWS_REGION}${NC}"
echo -e "Instance Type: ${YELLOW}${INSTANCE_TYPE}${NC}"
echo -e "Key Name: ${YELLOW}${KEY_NAME}${NC}"
echo ""

# Check AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
  echo -e "${RED}Error: AWS CLI not configured. Run 'aws configure' first.${NC}"
  exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "AWS Account ID: ${YELLOW}${AWS_ACCOUNT_ID}${NC}"
echo ""

# Confirm before proceeding
read -p "Continue with setup? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo -e "${GREEN}Step 1: Creating ECR Repositories${NC}"
echo "----------------------------------------"

for repo in "${PROJECT_NAME}-api" "${PROJECT_NAME}-web"; do
  if aws ecr describe-repositories --repository-names "$repo" --region "$AWS_REGION" &> /dev/null; then
    echo -e "  ${YELLOW}Repository $repo already exists${NC}"
  else
    aws ecr create-repository \
      --repository-name "$repo" \
      --region "$AWS_REGION" \
      --image-scanning-configuration scanOnPush=true \
      --output text > /dev/null
    echo -e "  ${GREEN}Created repository: $repo${NC}"
  fi
done

echo ""
echo -e "${GREEN}Step 2: Creating Security Group${NC}"
echo "----------------------------------------"

SG_NAME="${PROJECT_NAME}-sg"
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text --region "$AWS_REGION")

if aws ec2 describe-security-groups --group-names "$SG_NAME" --region "$AWS_REGION" &> /dev/null; then
  echo -e "  ${YELLOW}Security group $SG_NAME already exists${NC}"
  SG_ID=$(aws ec2 describe-security-groups --group-names "$SG_NAME" --query "SecurityGroups[0].GroupId" --output text --region "$AWS_REGION")
else
  SG_ID=$(aws ec2 create-security-group \
    --group-name "$SG_NAME" \
    --description "Security group for $PROJECT_NAME" \
    --vpc-id "$VPC_ID" \
    --query "GroupId" \
    --output text \
    --region "$AWS_REGION")

  # Allow SSH
  aws ec2 authorize-security-group-ingress \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0 \
    --region "$AWS_REGION" > /dev/null

  # Allow HTTP
  aws ec2 authorize-security-group-ingress \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    --region "$AWS_REGION" > /dev/null

  # Allow HTTPS
  aws ec2 authorize-security-group-ingress \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    --region "$AWS_REGION" > /dev/null

  echo -e "  ${GREEN}Created security group: $SG_NAME ($SG_ID)${NC}"
fi

echo ""
echo -e "${GREEN}Step 3: Creating Key Pair${NC}"
echo "----------------------------------------"

KEY_FILE="$HOME/.ssh/${KEY_NAME}.pem"

if aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$AWS_REGION" &> /dev/null; then
  echo -e "  ${YELLOW}Key pair $KEY_NAME already exists${NC}"
  if [ ! -f "$KEY_FILE" ]; then
    echo -e "  ${RED}Warning: Key file $KEY_FILE not found locally${NC}"
    echo -e "  ${RED}You may need to create a new key pair or restore the file${NC}"
  fi
else
  aws ec2 create-key-pair \
    --key-name "$KEY_NAME" \
    --query "KeyMaterial" \
    --output text \
    --region "$AWS_REGION" > "$KEY_FILE"
  chmod 400 "$KEY_FILE"
  echo -e "  ${GREEN}Created key pair: $KEY_NAME${NC}"
  echo -e "  ${GREEN}Key saved to: $KEY_FILE${NC}"
fi

echo ""
echo -e "${GREEN}Step 4: Launching EC2 Instance${NC}"
echo "----------------------------------------"

# Get latest Ubuntu 24.04 AMI
AMI_ID=$(aws ec2 describe-images \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" \
  --query "Images | sort_by(@, &CreationDate) | [-1].ImageId" \
  --output text \
  --region "$AWS_REGION")

echo -e "  Using AMI: ${YELLOW}$AMI_ID${NC} (Ubuntu 24.04)"

# Check if instance already exists
EXISTING_INSTANCE=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=$PROJECT_NAME" "Name=instance-state-name,Values=running,pending" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text \
  --region "$AWS_REGION" 2>/dev/null || echo "None")

if [ "$EXISTING_INSTANCE" != "None" ] && [ -n "$EXISTING_INSTANCE" ]; then
  echo -e "  ${YELLOW}Instance already exists: $EXISTING_INSTANCE${NC}"
  INSTANCE_ID="$EXISTING_INSTANCE"
else
  INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SG_ID" \
    --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":$VOLUME_SIZE,\"VolumeType\":\"gp3\"}}]" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$PROJECT_NAME}]" \
    --query "Instances[0].InstanceId" \
    --output text \
    --region "$AWS_REGION")
  echo -e "  ${GREEN}Launched instance: $INSTANCE_ID${NC}"
fi

echo ""
echo -e "${GREEN}Step 5: Waiting for Instance${NC}"
echo "----------------------------------------"

echo "  Waiting for instance to be running..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$AWS_REGION"

PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query "Reservations[0].Instances[0].PublicIpAddress" \
  --output text \
  --region "$AWS_REGION")

PUBLIC_DNS=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query "Reservations[0].Instances[0].PublicDnsName" \
  --output text \
  --region "$AWS_REGION")

echo -e "  ${GREEN}Instance is running!${NC}"
echo -e "  Public IP: ${YELLOW}$PUBLIC_IP${NC}"
echo -e "  Public DNS: ${YELLOW}$PUBLIC_DNS${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Next steps:"
echo ""
echo -e "1. Update ${YELLOW}.kamal/secrets${NC} with:"
echo -e "   AWS_ACCOUNT_ID=${GREEN}$AWS_ACCOUNT_ID${NC}"
echo -e "   AWS_REGION=${GREEN}$AWS_REGION${NC}"
echo -e "   AWS_EC2_HOST=${GREEN}$PUBLIC_DNS${NC}"
echo ""
echo -e "2. Configure DNS to point your domain to: ${GREEN}$PUBLIC_IP${NC}"
echo ""
echo -e "3. Test SSH connection:"
echo -e "   ${YELLOW}ssh -i $KEY_FILE ubuntu@$PUBLIC_DNS${NC}"
echo ""
echo -e "4. Deploy with Kamal:"
echo -e "   ${YELLOW}./deploy.sh setup${NC}"
echo -e "   ${YELLOW}./deploy.sh -d web${NC}"
echo ""

# Save configuration
CONFIG_FILE=".aws-setup-output"
cat > "$CONFIG_FILE" << EOF
# AWS Setup Output - Generated $(date)
AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID
AWS_REGION=$AWS_REGION
AWS_EC2_HOST=$PUBLIC_DNS
AWS_EC2_IP=$PUBLIC_IP
INSTANCE_ID=$INSTANCE_ID
SECURITY_GROUP_ID=$SG_ID
KEY_FILE=$KEY_FILE
EOF

echo -e "Configuration saved to: ${GREEN}$CONFIG_FILE${NC}"
