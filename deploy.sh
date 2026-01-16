#!/bin/bash
# Deploy script for ft_transcendence on AWS
# Automatically refreshes ECR token before deployment

set -e

# Load environment variables
if [ -f .kamal/secrets ]; then
  set -a
  source .kamal/secrets
  set +a
else
  echo "Error: .kamal/secrets not found"
  echo "Copy .kamal/secrets.example to .kamal/secrets and fill in your values"
  exit 1
fi

# Validate required variables
if [ -z "$AWS_REGION" ] || [ -z "$AWS_ACCOUNT_ID" ]; then
  echo "Error: AWS_REGION and AWS_ACCOUNT_ID must be set in .kamal/secrets"
  exit 1
fi

# Refresh ECR token (valid for 12 hours)
echo "Refreshing ECR authentication token..."
export KAMAL_REGISTRY_PASSWORD=$(aws ecr get-login-password --region "$AWS_REGION")

if [ -z "$KAMAL_REGISTRY_PASSWORD" ]; then
  echo "Error: Failed to get ECR token. Check your AWS credentials."
  exit 1
fi

echo "ECR token refreshed successfully"

# Run kamal with all arguments passed to this script
echo "Running: kamal $*"
kamal "$@"
