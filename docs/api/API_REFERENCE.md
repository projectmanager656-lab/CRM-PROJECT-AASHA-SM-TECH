# API Documentation - Phase 1

## Base URL
```
http://localhost:5000/api/v1
```

## Authentication
Phase 1 contains no authentication endpoints.

Authentication will be implemented in Phase 2 with JWT tokens.

## Endpoints

### Health Check

**Endpoint:** `GET /health`

**Description:** Check API status and application information

**Request:**
```bash
curl http://localhost:5000/api/v1/health
```

**Response (200 OK):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "API is running",
  "data": {
    "status": "operational",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "uptime": 123.456,
    "environment": "development",
    "version": "1.0.0"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Status Code:** 200

---

## Response Format

### Success Response
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Success message",
  "data": {
    "field": "value"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Error Response
```json
{
  "statusCode": 400,
  "success": false,
  "message": "Error description",
  "errorType": "VALIDATION_ERROR",
  "errors": ["specific error description"],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created |
| 400 | Bad Request - Invalid data |
| 401 | Unauthorized - Auth required |
| 403 | Forbidden - Access denied |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error |

## Error Types

| Type | HTTP Code | Description |
|------|-----------|-------------|
| VALIDATION_ERROR | 400 | Input validation failed |
| AUTHENTICATION_ERROR | 401 | Authentication required |
| AUTHORIZATION_ERROR | 403 | Permission denied |
| NOT_FOUND_ERROR | 404 | Resource not found |
| DATABASE_ERROR | 500 | Database operation failed |
| INTERNAL_SERVER_ERROR | 500 | Unexpected server error |

## Request Headers

**Required:**
- `Content-Type: application/json`

**Optional (Phase 2):**
- `Authorization: Bearer <token>`

## CORS

CORS is enabled for the frontend URL configured in `.env`:

```env
CLIENT_URL=http://localhost:5173
```

### Allowed Methods
- GET
- POST
- PUT
- DELETE
- PATCH
- OPTIONS

### Allowed Headers
- Content-Type
- Authorization

## Phase 1 Limitations

- No authentication endpoints yet
- No data endpoints yet
- Only health check available
- No pagination
- No filtering
- No searching

## Testing the API

### Using cURL
```bash
# Health check
curl -X GET http://localhost:5000/api/v1/health
```

### Using Axios (Frontend)
```javascript
import apiClient from './services/apiClient';

// Health check
apiClient.get('/health')
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
```

### Using Postman
1. Create new GET request
2. URL: `http://localhost:5000/api/v1/health`
3. Send request

## API Versioning

Current version: **v1**

API endpoints are prefixed with `/api/v1/` for future versioning support.

Future versions will use `/api/v2/`, `/api/v3/`, etc., allowing multiple API versions to coexist.

## Logging

All requests are logged with:
- Timestamp
- HTTP Method
- URL Path
- Status Code
- Response Time
- Client IP
- User Agent

## Rate Limiting

Rate limiting will be implemented in Phase 3+

## Pagination

Pagination will be implemented in Phase 2+ following this format:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

## Filtering & Searching

Filtering and searching will be implemented in Phase 2+

---

**Status:** Phase 1 - Limited Endpoints
**Next:** Authentication & User Endpoints (Phase 2)
