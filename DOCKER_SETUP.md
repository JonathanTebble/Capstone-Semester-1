# Docker Setup Guide - Capstone Project

This document provides complete instructions for running the containerized Capstone application.

## Prerequisites

### For Recipients (People receiving this project)

1. **Install Docker Desktop**
   - Download from: https://www.docker.com/products/docker-desktop/
   - Run the installer as Administrator
   - During installation, ensure "Use WSL 2 instead of Hyper-V" is checked (Windows)
   - Restart your computer after installation
   - Launch Docker Desktop and wait for it to start (Docker whale icon in system tray)

2. **Verify Docker Installation**
   Open Command Prompt or PowerShell and run:
   ```bash
   docker --version
   docker-compose --version
   ```
   You should see version numbers for both commands.

## Quick Start (Easiest Method)

### Step 1: Get the Project
- Extract the project files to a folder on your computer
- Open Command Prompt or PowerShell in the project folder

### Step 2: Set Up Environment Variables
1. Copy `.env.example` to `.env.local`:
   ```bash
   copy .env.example .env.local
   ```
   
2. Edit `.env.local` and add your Gemini API key:
   ```
   VITE_GEMINI_API_KEY=your_actual_api_key_here
   ```
   
   **Get a Gemini API key from:** https://aistudio.google.com/app/apikey

### Step 3: Run the Application
Choose one option:

**Production Version (Recommended):**
```bash
docker-compose up --build
```

**Development Version (with hot reloading):**
```bash
docker-compose --profile dev up --build
```

### Step 4: Access the Application
- **Production**: Open http://localhost:3000
- **Development**: Open http://localhost:5173

### Step 5: Stop the Application
Press `Ctrl+C` in the terminal, or run:
```bash
docker-compose down
```

## Manual Docker Commands (Alternative Method)

If you prefer using Docker commands directly:

### Production Build
```bash
# Build the image
docker build -t capstone-app .

# Run the container
docker run -p 3000:80 --env-file .env.local capstone-app
```

### Development Build
```bash
# Build development image
docker build -f Dockerfile.dev -t capstone-app-dev .

# Run development container
docker run -p 5173:5173 --env-file .env.local -v "%cd%:/app" -v /app/node_modules capstone-app-dev
```

## Automated Setup Script (Windows)

For even easier setup, run the provided script:
```bash
docker-setup.bat
```

This script will:
- Check if Docker is installed
- Create `.env.local` if it doesn't exist
- Prompt you to add your API key
- Let you choose production or development mode
- Start the application

## Troubleshooting

### Common Issues

**1. "docker is not recognized"**
- Docker Desktop is not installed or not running
- Restart Docker Desktop and try again

**2. "Port already in use"**
- Another application is using the port
- Stop other applications using ports 3000 or 5173
- Or use different ports: `docker run -p 3001:80 capstone-app`

**3. "API key not working"**
- Verify your Gemini API key is correct in `.env.local`
- Check for extra spaces or characters
- Ensure the API key has proper permissions

**4. "Images not loading"**
- The asset import fix has been applied
- Rebuild the image if you made any changes: `docker-compose up --build`

### Useful Docker Commands

```bash
# View running containers
docker ps

# View all containers
docker ps -a

# Stop all containers
docker stop $(docker ps -q)

# Remove all containers
docker rm $(docker ps -aq)

# View Docker logs
docker-compose logs

# Rebuild without cache
docker-compose build --no-cache

# Remove all unused Docker objects
docker system prune -a
```

## File Structure Overview

```
Capstone-Semester-1/
├── Dockerfile              # Production build configuration
├── Dockerfile.dev          # Development build configuration
├── docker-compose.yml      # Container orchestration
├── nginx.conf              # Web server configuration
├── .dockerignore           # Files to ignore during build
├── .env.example            # Environment template
├── .env.local              # Your API key (create this)
├── docker-setup.bat        # Automated setup script
└── src/                    # Application source code
```

## For Developers

### Making Changes
- **Production**: Rebuild with `docker-compose up --build`
- **Development**: Changes are automatically reflected (hot reload)

### Environment Variables
- Never commit `.env.local` to version control
- Use `.env.example` as a template for others
- Production deployments should use secure secret management

### Ports
- **Production**: http://localhost:3000 (nginx serves optimized build)
- **Development**: http://localhost:5173 (Vite dev server with hot reload)

## Deployment Notes

This setup is configured for:
- ✅ Local development and testing
- ✅ Production-ready builds with nginx
- ✅ Hot reloading for development
- ✅ Secure API key handling
- ✅ Cross-platform compatibility (Windows, Mac, Linux)

## Support

If you encounter issues:
1. Ensure Docker Desktop is running
2. Verify your `.env.local` file has the correct API key
3. Try rebuilding: `docker-compose up --build`
4. Check Docker logs: `docker-compose logs`
5. Restart Docker Desktop if needed

---

**That's it!** Your containerized Capstone application should now be running successfully.