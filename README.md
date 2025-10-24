---

# Terah Web Application

This repository contains the **Terah web application**, developed using **React** and powered by **Vite** for fast and efficient front-end builds. The system was designed for scalability, ease of maintenance, and smooth developer experience.

The project has been containerised using **Docker** to simplify deployment and ensure consistency across environments.

---

## Overview

The Terah application provides a lightweight and responsive web interface built with **React**, **Vite**, and **Node.js**. It has been designed with modularity in mind, allowing for straightforward maintenance and future extension.

All environment-specific configuration is managed via `.env` files and the build system is optimised for both development and production contexts.

---

## System Requirements

**To run locally or in production, ensure the following are installed:**

* **Node.js:** v18+
* **npm:** v9+
* **Docker Desktop:** Latest stable release (if running in containerised mode)
* **Git:** For version control and repository management

---

## Installation & Setup

### Local Development Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/<your-org>/terah.git
   cd terah
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Create and configure environment file:**

   ```bash
   cp .env .env
   ```

   Then open `.env` and add your specific environment variables:

   ```
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

4. **Run the development server:**

   ```bash
   npm run dev
   ```

   The app will be available at:
   **[http://localhost:5173](http://localhost:5173)**

---

## Docker Deployment

### Quick Start

1. **Ensure Docker Desktop is running.**
2. **Run the setup script:**

   ```bash
   # Windows
   docker-setup.bat

   # Linux/Mac
   chmod +x docker-setup.sh
   ./docker-setup.sh
   ```

This will build the container and start the application automatically.

---

### Manual Docker Deployment

1. **Build and start the application using Docker Compose:**

   ```bash
   # Production
   docker-compose up --build

   # Development (with hot reloading)
   docker-compose --profile dev up --build
   ```

2. **Access your application:**

   * **Production:** [http://localhost:3000](http://localhost:3000)
   * **Development:** [http://localhost:5173](http://localhost:5173)

---

## Running and Monitoring

For local development, the React/Vite server automatically applies **Hot Module Reloading (HMR)**, ensuring instant reflection of changes in the browser.

For production environments:

* The app runs through an **nginx** container for optimized static file serving.
* Logs can be viewed using:

  ```bash
  docker logs <container_name>
  ```
* Health can be checked via HTTP status codes or container monitoring tools (e.g., Docker Desktop, Portainer).

---

## Maintenance Responsibilities

* **Routine updates:**
  Run the following regularly to keep dependencies up to date:

  ```bash
  npm update
  ```
* **Environment management:**
  All sensitive credentials (e.g., API keys) must be stored in `.env.local` (never committed to version control).
* **Code maintenance:**
  Follow standard pull request and review procedures before merging changes to the main branch.

---

## Security Notes

* `.env.local` files are ignored by Git to prevent key exposure.
* All builds are containerised for isolation and reproducibility.
* Production images are served through a secure nginx setup.
* User data and credentials (if applicable) are handled according to standard web security practices.

---

