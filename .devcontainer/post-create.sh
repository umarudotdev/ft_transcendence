#!/bin/bash
set -e

echo "Starting PostgreSQL service..."
sudo service postgresql start

echo "Waiting for PostgreSQL to be ready..."
until pg_isready -U postgres; do
  sleep 1
done

echo "Creating database if it doesn't exist..."
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'ft_transcendence'" | grep -q 1 || \
  psql -U postgres -c "CREATE DATABASE ft_transcendence"

echo "Installing dependencies..."
bun install

echo "Running database migrations..."
cd apps/api && bun run migrate

echo "Setup complete!"
