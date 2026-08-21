# Architecture Overview

## System Design

The IT Company Management System follows a **three-tier architecture**:

### Presentation Tier (Frontend)
- **Technology:** React 18
- **Build Tool:** Vite
- **Styling:** CSS with CSS Variables
- **Routing:** React Router v6
- **HTTP Client:** Axios

### Application Tier (Backend)
- **Technology:** Node.js + Express.js
- **API Style:** REST with versioning (`/api/v1`)
- **Request Handling:** Express middleware stack
- **Error Handling:** Centralized error middleware

### Data Tier (Database)
- **Technology:** MongoDB
- **ORM:** Mongoose
- **Connection:** Mongoose with connection pooling
- **Data Models:** Will be created in Phase 2+

## API Architecture

### Versioning
All APIs are prefixed with `/api/v1` for versioning and future compatibility.

### Request/Response Format

**Request:**
```json
{
  "data": "value"
}
```

**Success Response (2xx):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Operation successful",
  "data": {},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Error Response (4xx/5xx):**
```json
{
  "statusCode": 400,
  "success": false,
  "message": "Error description",
  "errorType": "ERROR_TYPE",
  "errors": ["specific error"],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### HTTP Methods
- **GET** - Retrieve resources
- **POST** - Create new resources
- **PUT** - Update entire resources
- **DELETE** - Delete resources
- **PATCH** - Partial updates

### Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Middleware Stack

### Express Middleware Order

1. **JSON Parser** - Parse JSON request bodies
2. **URL Encoded Parser** - Parse form data
3. **CORS Middleware** - Handle cross-origin requests
4. **Request Logger** - Log all incoming requests
5. **API Routes** - Application routes
6. **404 Handler** - Handle undefined routes
7. **Error Handler** - Global error handling (last)

### Custom Middleware

- **requestLogger.middleware.js** - Request/response logging
- **error.middleware.js** - Global error handling
- **notFound.middleware.js** - 404 handling

## Authentication & Authorization (Phase 2)

### JWT Implementation
- Token-based authentication
- Stateless validation
- Refresh token rotation
- Role-based access control (RBAC)

### Security Headers
- CORS configured per environment
- JWT in Authorization header
- Secure password hashing with bcryptjs
- HTTPS enforcement in production

## Frontend Architecture

### Component Hierarchy
```
App
├── Layout (MainLayout/AuthLayout/etc.)
│   ├── Header
│   ├── Sidebar
│   └── Main Content
│       └── Page Components
│           └── Module Components
```

### State Management (Phase 2)
- React Context for global state
- Local state with useState
- Side effects with useEffect

### Routing
- Route configuration in `routeConfig.js`
- Protected routes (Phase 2)
- Dynamic imports for code splitting (Phase 2)

## Database Schema Design (Phase 2)

### Collections Structure

**Users**
- Authentication and profile

**Employees (HRMS)**
- Employee records

**Clients (CRM)**
- Client information

**Projects**
- Project tracking

**Payroll**
- Salary and compensation

**Other Modules**
- Reports, Tickets, Invoices, etc.

## Error Handling Strategy

### Custom Error Classes
- **ApiError** - Application errors with status codes
- **ValidationError** - Input validation errors
- **NotFoundError** - Resource not found
- **AuthenticationError** - Auth failures
- **AuthorizationError** - Permission denied

### Error Flow
1. Error occurs in route/middleware
2. Error passed to error middleware
3. Error formatted as ApiError
4. Error logged
5. Standardized error response sent to client

## Logging Strategy

### Log Levels
- **DEBUG** - Detailed information
- **INFO** - General information
- **WARN** - Warning messages
- **ERROR** - Error messages

### Logged Information
- Request method and URL
- Response status code
- Response time
- Client IP address
- User agent
- Error stack traces (development)

## Security Architecture

### Environment Separation
- Development - Local debugging
- Production - Secured with env variables

### Credential Management
- No hardcoded secrets
- Environment variables for sensitive data
- .env files in .gitignore

### CORS Configuration
- Frontend URL configured per environment
- Allowed methods and headers specified
- Credentials included in requests

## Deployment Architecture (Phase 5)

### Containerization
- Docker for backend and database
- Docker Compose for orchestration

### Server Setup
- Nginx as reverse proxy
- Node.js application server
- MongoDB data store

### CI/CD Pipeline
- GitHub Actions for automation
- Automated testing
- Build and deploy steps

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- Session storage in database
- Load balancer for multiple instances

### Database Optimization
- Indexing strategies
- Query optimization
- Connection pooling

### Caching
- Redis for session data (Phase 3+)
- API response caching
- Static asset caching

## Data Flow

```
User Input (React)
    ↓
Axios HTTP Request
    ↓
Express Route Handler
    ↓
Middleware Processing
    ↓
Business Logic
    ↓
Mongoose DB Query
    ↓
MongoDB
    ↓
Response → Express → Axios → React UI
```

## Integration Points

### Frontend ↔ Backend
- REST API over HTTP/HTTPS
- Axios for HTTP communication
- JWT tokens in Authorization header

### Backend ↔ Database
- Mongoose ODM for schema validation
- Connection pooling
- Error handling for DB operations

---

**Status:** Phase 1 Complete
**Next:** Authentication & Database Schema (Phase 2)
