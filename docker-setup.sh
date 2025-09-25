#!/bin/bash

# Docker Setup Script for Capstone Project
# This script handles secure environment variable setup

echo "Capstone Docker Setup"
echo "===================="

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "Warning: .env.local not found!"
    echo "Creating .env.local from .env.example..."
    
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        echo "Created .env.local"
        echo "Please edit .env.local and add your actual Gemini API key"
        echo ""
        echo "Your API key should replace: your_gemini_api_key_here"
        echo ""
        read -p "Press Enter after you've updated .env.local with your API key..."
    else
        echo "Error: .env.example not found! Please create .env.local manually."
        exit 1
    fi
fi

echo "Building and starting Docker containers..."

# Export environment variables for docker-compose
export $(grep -v '^#' .env.local | xargs)

# Choose build type
echo ""
echo "Choose build type:"
echo "1) Production build (recommended)"
echo "2) Development build (with hot reloading)"
echo ""
read -p "Enter choice [1]: " choice
choice=${choice:-1}

case $choice in
    1)
        echo "Starting production build..."
        docker-compose up --build
        ;;
    2)
        echo "Starting development build..."
        docker-compose --profile dev up --build
        ;;
    *)
        echo "Invalid choice. Starting production build..."
        docker-compose up --build
        ;;
esac