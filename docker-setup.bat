@echo off
REM Docker Setup Script for Capstone Project (Windows)
REM This script handles secure environment variable setup

echo Capstone Docker Setup
echo ====================

REM Check if .env.local exists
if not exist ".env.local" (
    echo Warning: .env.local not found!
    echo Creating .env.local from .env.example...
    
    if exist ".env.example" (
        copy ".env.example" ".env.local" >nul
        echo Created .env.local
        echo Please edit .env.local and add your actual Gemini API key
        echo.
        echo Your API key should replace: your_gemini_api_key_here
        echo.
        pause
    ) else (
        echo Error: .env.example not found! Please create .env.local manually.
        pause
        exit /b 1
    )
)

echo Building and starting Docker containers...
echo.

REM Choose build type
echo Choose build type:
echo 1^) Production build ^(recommended^)
echo 2^) Development build ^(with hot reloading^)
echo.
set /p choice="Enter choice [1]: "
if "%choice%"=="" set choice=1

if "%choice%"=="1" (
    echo Starting production build...
    docker-compose up --build
) else if "%choice%"=="2" (
    echo Starting development build...
    docker-compose --profile dev up --build
) else (
    echo Invalid choice. Starting production build...
    docker-compose up --build
)