# IT Company Management System - Server

Backend API server for the IT Company Management System built with Node.js, Express, and MongoDB.

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Configuration

Create `.env` file in the server root:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/it-management-system
CLIENT_URL=http://localhost:5173
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

### Running the Server

**Development (with auto-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

The server will start on `http://localhost:5000`

## 📡 API Endpoints

### Base URL
```
http://localhost:5000/api/v1
```

### Health Check
```
GET /api/v1/health
```

Returns server status and application information.

## 📁 Project Structure

```
server/
├── src/
│   ├── config/
│   │   ├── environment.js      # Environment configuration
│   │   ├── database.js         # MongoDB connection
│   │   └── constants.js        # Application constants
│   ├── middleware/
│   │   ├── error.middleware.js
│   │   ├── notFound.middleware.js
│   │   └── requestLogger.middleware.js
│   ├── utils/
│   │   ├── logger.js           # Logging utility
│   │   ├── apiError.js         # Error handling
│   │   ├── apiResponse.js      # Response formatting
│   │   └── asyncHandler.js     # Async error wrapper
│   ├── routes/
│   │   └── index.js            # API routes
│   ├── validators/             # Input validation (Phase 2)
│   ├── app.js                  # Express setup
│   └── server.js               # Entry point
├── uploads/                    # File upload directories
├── tests/                      # Test files
├── .env                        # Environment variables
├── .env.example                # Example env file
├── package.json
└── README.md
```

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| NODE_ENV | Environment (development/production) | development |
| MONGODB_URI | MongoDB connection string | localhost |
| CLIENT_URL | Frontend client URL (CORS) | http://localhost:5173 |
| JWT_SECRET | JWT signing secret | (required in production) |
| LOG_LEVEL | Logging level | info |

## 📦 Dependencies

### Production
- **express** - Web framework
- **mongoose** - MongoDB ODM
- **cors** - CORS middleware
- **dotenv** - Environment variables
- **axios** - HTTP client
- **bcryptjs** - Password hashing (Phase 2)
- **jsonwebtoken** - JWT auth (Phase 2)
- **joi** - Input validation (Phase 2)

### Development
- **nodemon** - Auto-reload development server
- **eslint** - Code linting

## 🛠 Available Scripts

```bash
npm run dev          # Start with nodemon (development)
npm start            # Start server (production)
npm test             # Run tests
npm run lint         # Run ESLint
npm run seed         # Seed database (when implemented)
```

## 🔐 Error Handling

Centralized error handling with standardized API responses:

```javascript
{
  "statusCode": 400,
  "success": false,
  "message": "Error message",
  "errors": [],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 📝 Logging

All requests are logged with:
- HTTP method and URL
- Status code
- Response time
- IP address
- User agent

## 🔌 CORS Configuration

CORS is configured to accept requests from `CLIENT_URL` environment variable.

**Allowed Methods:** GET, POST, PUT, DELETE, PATCH, OPTIONS
**Allowed Headers:** Content-Type, Authorization

## 📚 API Response Format

All API responses follow this standardized format:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Success message",
  "data": {},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🚨 Common Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "success": false,
  "message": "Validation failed",
  "errors": ["field error description"]
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "success": false,
  "message": "Authentication required"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "success": false,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "success": false,
  "message": "Internal server error occurred"
}
```

## 🔄 Development Workflow

1. Create new route in `src/routes/`
2. Create middleware if needed in `src/middleware/`
3. Use `asyncHandler` for async route handlers
4. Return responses using `successResponse` or throw `ApiError`
5. Leverage centralized error handling

## 🧪 Testing

Tests will be added in Phase 2.

```bash
npm test
```

## 🐛 Troubleshooting

### MongoDB Connection Failed
- Ensure MongoDB is running: `mongod`
- Check `MONGODB_URI` in `.env`
- Verify firewall settings for remote connections

### Port Already in Use
- Change `PORT` in `.env`
- Or kill process: `lsof -ti:5000 | xargs kill -9` (macOS/Linux)

### Module Not Found
- Clear node_modules: `rm -rf node_modules && npm install`
- Check import paths and file names

## 📖 Documentation

See main project README for:
- [Architecture Guide](../docs/architecture/)
- [API Documentation](../docs/api/)
- [Database Schema](../docs/database/)

## 🔜 Next Phases

- Phase 2: Authentication & JWT implementation
- Phase 3: User and employee management
- Phase 4: CRM and project modules
- Phase 5: Payroll and reports

## 📞 Support

For issues or questions, refer to the main project documentation.

---

**Version:** 1.0.0
**Status:** Phase 1 - Foundation Complete
