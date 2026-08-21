# IT Company Management System - Phase 1 Foundation

A production-ready **IT Company Management System** built with MERN stack (MongoDB, Express, React, Node.js).

## 📋 Project Overview

This is a unified, single-application approach to managing:
- **CRM** - Customer Relationship Management
- **HRMS** - Human Resources Management System
- **Project Management** - Project tracking and delivery
- **Payroll** - Employee compensation management
- **Admin Dashboard** - System administration
- **Reports & Analytics** - Business intelligence
- **Notifications** - Real-time alerts and messaging

## 🏗 Architecture

### Technology Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | React 18 + React Router |
| **Backend** | Node.js + Express.js |
| **Database** | MongoDB + Mongoose |
| **Authentication** | JWT (Phase 2) |
| **API Style** | REST with versioning |
| **HTTP Client** | Axios |
| **Package Manager** | npm |

### Project Structure

```
IT-Company-Management-System/
├── client/                 # React frontend application
│   ├── public/
│   ├── src/
│   └── package.json
├── server/                 # Node.js backend application
│   ├── src/
│   ├── uploads/
│   └── package.json
├── docs/                   # Documentation
│   ├── architecture/
│   ├── api/
│   ├── database/
│   └── workflows/
├── .gitignore
├── package.json
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB >= 5.0 (local or Atlas connection string)

### Installation

1. **Clone or download the project**
   ```bash
   cd "path/to/IT-Company-Management-System"
   ```

2. **Install root dependencies**
   ```bash
   npm install
   ```

3. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

4. **Install client dependencies**
   ```bash
   cd ../client
   npm install
   cd ..
   ```

### Environment Configuration

1. **Server Configuration** (`server/.env`)
   ```
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/it-management-system
   CLIENT_URL=http://localhost:5173
   JWT_SECRET=your-super-secret-jwt-key
   ```

2. **Client Configuration** (`client/.env`)
   ```
   VITE_API_URL=http://localhost:5000/api/v1
   VITE_ENV=development
   ```

### Running the Application

#### Option 1: Run Both (from root with concurrently)
```bash
npm run dev
```

#### Option 2: Run Separately

**Start Backend:**
```bash
cd server
npm run dev
# Server running on http://localhost:5000
```

**Start Frontend (new terminal):**
```bash
cd client
npm run dev
# Client running on http://localhost:5173
```

### Verify Installation

1. **Check Backend Health:**
   ```bash
   curl http://localhost:5000/api/v1/health
   ```

   Expected response:
   ```json
   {
     "statusCode": 200,
     "success": true,
     "message": "API is running",
     "data": {
       "status": "operational",
       "timestamp": "2024-01-01T00:00:00.000Z",
       "uptime": 5.123,
       "environment": "development",
       "version": "1.0.0"
     },
     "timestamp": "2024-01-01T00:00:00.000Z"
   }
   ```

2. **Check Frontend:**
   Open http://localhost:5173 in your browser. You should see the welcome page.

## 📚 Documentation

- **[Architecture Guide](docs/architecture/)** - System design and patterns
- **[API Documentation](docs/api/)** - API endpoints and usage
- **[Database Schema](docs/database/)** - MongoDB collections and models
- **[Workflow Guides](docs/workflows/)** - Common workflows and processes

## 📁 Directory Structure Details

### Server (`server/src/`)

```
src/
├── config/              # Configuration files
│   ├── environment.js   # Environment variables
│   ├── database.js      # MongoDB connection
│   └── constants.js     # Application constants
├── middleware/          # Express middleware
│   ├── error.middleware.js
│   ├── notFound.middleware.js
│   └── requestLogger.middleware.js
├── utils/              # Utility functions
│   ├── logger.js
│   ├── apiError.js
│   ├── apiResponse.js
│   └── asyncHandler.js
├── routes/             # API routes
│   └── index.js
├── validators/         # Input validation (Phase 2)
├── app.js             # Express application setup
└── server.js          # Server entry point
```

### Client (`client/src/`)

```
src/
├── components/         # React components
│   ├── common/         # Shared components
│   ├── layout/         # Layout components
│   └── ui/             # UI components
├── layouts/            # Page layouts
│   ├── MainLayout.jsx
│   ├── AuthLayout.jsx
│   ├── ErrorLayout.jsx
│   └── BlankLayout.jsx
├── routes/             # Routing configuration
│   ├── AppRoutes.jsx
│   └── routeConfig.js
├── services/           # API services
│   └── apiClient.js
├── context/            # React Context (state management)
├── hooks/              # Custom React hooks
├── constants/          # Application constants
├── utils/              # Utility functions
├── styles/             # Global styles
├── App.jsx             # Root App component
└── main.jsx            # React entry point
```

## 🔌 API Endpoints (Phase 1)

### Base URL
```
http://localhost:5000/api/v1
```

### Health Check
```
GET /health
```

Returns API status and basic application information.

## 🛠 Available Scripts

### Root Level
```bash
npm run dev        # Run both client and server concurrently
```

### Server
```bash
cd server
npm run dev        # Start server with nodemon
npm start          # Start server in production
npm test           # Run tests
npm run lint       # Run ESLint
```

### Client
```bash
cd client
npm run dev        # Start dev server (Vite)
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

## 🔐 Authentication & Security

**Authentication will be implemented in Phase 2.**

Current setup is prepared for JWT implementation with:
- `/api/v1` versioning
- Centralized error handling
- CORS configuration
- Request logging

## 📝 Phase 1 Coverage

✅ Root project structure
✅ React client setup (Vite)
✅ Node/Express server setup
✅ Environment configuration
✅ MongoDB connection configuration
✅ Express application setup with middleware
✅ API versioning (`/api/v1`)
✅ Global error handling
✅ 404/not-found handling
✅ Request logging foundation
✅ Basic health-check API
✅ Comprehensive README files
✅ Proper `.gitignore`
✅ Production-ready `package.json` files

## 🔜 Upcoming Phases

**Phase 2:** Authentication & Authorization
- JWT implementation
- User login/registration
- Role-based access control (RBAC)

**Phase 3:** Core Modules
- User management
- Employee HRMS
- CRM module
- Projects module

**Phase 4:** Advanced Features
- Payroll system
- Reports & analytics
- Notifications system
- File uploads

**Phase 5:** DevOps & Deployment
- Docker containerization
- CI/CD pipeline
- Production deployment
- Monitoring & logging

## 🤝 Development Guidelines

### Code Standards
- Use ES6+ syntax with async/await
- Maintain separation of concerns
- Use environment variables for configuration
- Centralized error handling
- Meaningful variable and function names
- Comments only when necessary

### Commit Convention
Use conventional commits:
```
feat: add new feature
fix: fix a bug
docs: update documentation
style: formatting changes
refactor: code refactoring
test: add/update tests
chore: dependency updates
```

## 📞 Support & Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running locally OR provide MONGODB_URI for Atlas
- Check firewall settings if using remote database
- Verify connection string format

### Port Already in Use
- Server default: 5000
- Client default: 5173
- Modify in `.env` files if needed

### Module Not Found Errors
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Verify import paths match file locations

## 📄 License

ISC

## 👥 Author

Your Name / Organization

---

**Last Updated:** January 2024
**Version:** 1.0.0 (Phase 1)
