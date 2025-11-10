# Welcome to the Form Generator (PHMC)!

This project is a modernized React application built with Vite for high performance and fast builds. It integrates with Google Firebase for data storage, authentication, and backend functions.

The goal is to provide a reliable, maintainable form management and generation system ready for production deployment.

# Breaking Changes
The `.env` file has been changed, build a fresh `.env` to properly deploy this project!

## Project Structure

Here's an overview of the main directories and their purpose:
```
project-root/
├── public/                       # Static assets served directly, copied to /build during build
├── src/                          # Main React application source
│   ├── assets/                   # (Legacy) Static media files — now handled via Firebase
│   ├── components/               # Shared reusable components (UI elements, modals, etc.)
│   ├── components/admin/         # Admin panel components and debugging utilities
│   ├── contexts/                 # Global state providers (React Context API)
│   ├── phmc-bbcode-generators/   # BBCode generators for PHMC forms
│   ├── phmc-civilian-fields/     # Civilian interaction form components
│   ├── phmc-field-data/          # Core form data and input field components
│   ├── phmc-recruitment-generators/ # Recruitment-related BBCode generators
│
├── functions/                    # Firebase Functions — scheduled jobs, API key rotation, etc.
├── migration-script-rtdb/        # Scripts for Firebase Realtime Database migrations
└── ...
```

## Getting Started

These instructions assume you’re setting up the project locally and deploying to a production-ready environment (e.g., Firebase Hosting, Vercel, or your own server).

### 1. Clone the Repository
```
git clone https://github.com/Ancad-Studios/phmc-tools.git
cd forms
```
### 2. Install Dependencies
Make sure you have Node.js (v18 or later) and npm installed.
```
npm install
```

## Development

To start the development server with hot module replacement:
```
npm run dev
```
Configure the vite.config.js to change the server port, by default it's 3000

### Building for Production

Build the optimized production bundle with:
```
npm run build
```
The compiled output will be available in the /build directory.
You can deploy this folder to any production web server or hosting service.

## Custom Server Deployments
Copy the build/ folder to your production web server and configure it to serve static files (for example, using Nginx or Apache).

# Important Changes
!!! Rotate the API keys from `REACT_APP` to `VITE_` as it will not build and break!!!!!!