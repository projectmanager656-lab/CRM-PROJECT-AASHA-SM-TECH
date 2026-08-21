# Development Workflows

## Local Development Setup

### Initial Project Setup

1. **Clone/Download Project**
   ```bash
   cd "path/to/IT-Company-Management-System"
   ```

2. **Install Root Dependencies**
   ```bash
   npm install
   ```

3. **Install Server Dependencies**
   ```bash
   cd server
   npm install
   cd ..
   ```

4. **Install Client Dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

### Environment Configuration

1. **Server Setup** (`server/.env`)
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/it-management-system
   CLIENT_URL=http://localhost:5173
   JWT_SECRET=dev-secret-key
   ```

2. **Client Setup** (`client/.env`)
   ```env
   VITE_API_URL=http://localhost:5000/api/v1
   VITE_ENV=development
   ```

3. **Start MongoDB**
   ```bash
   mongod
   # or
   brew services start mongodb-community  # macOS
   ```

## Daily Development Workflow

### Start Development Environment

#### Option 1: Concurrent (from root)
```bash
npm run dev
# Starts both server and client automatically
```

#### Option 2: Separate Terminals
```bash
# Terminal 1 - Backend
cd server
npm run dev
# Server running on http://localhost:5000

# Terminal 2 - Frontend
cd client
npm run dev
# Client running on http://localhost:5173
```

### Verify Setup

1. **Check Backend Health**
   ```bash
   curl http://localhost:5000/api/v1/health
   ```
   Expected: JSON response with "operational" status

2. **Check Frontend**
   - Open http://localhost:5173 in browser
   - Should see welcome page

## Code Development Patterns

### Adding a New API Endpoint

1. **Create Route Handler** (Phase 2+)
   ```javascript
   // server/src/routes/[module].js
   import { asyncHandler } from '../utils/asyncHandler.js';
   import { successResponse } from '../utils/apiResponse.js';
   
   router.get('/endpoint', asyncHandler(async (req, res) => {
     const data = { /* fetch data */ };
     res.json(successResponse(data, 'Success message'));
   }));
   ```

2. **Register Route**
   ```javascript
   // server/src/routes/index.js
   import moduleRoutes from './[module].js';
   router.use('/module', moduleRoutes);
   ```

3. **Test Endpoint**
   ```bash
   curl http://localhost:5000/api/v1/module/endpoint
   ```

### Adding a New Frontend Component

1. **Create Component File**
   ```jsx
   // client/src/components/[type]/ComponentName.jsx
   export default function ComponentName() {
     return <div>Component</div>;
   }
   ```

2. **Import and Use**
   ```jsx
   import ComponentName from '../components/[type]/ComponentName';
   
   function Page() {
     return <ComponentName />;
   }
   ```

### Calling API from Frontend

```javascript
// client/src/hooks/useFetch.js (Phase 2)
import { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';

export function useFetch(endpoint) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient
      .get(endpoint)
      .then(res => setData(res.data.data))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  }, [endpoint]);

  return { data, loading, error };
}
```

## Testing Workflows

### Manual Testing

1. **API Testing with cURL**
   ```bash
   # GET request
   curl http://localhost:5000/api/v1/health
   
   # POST request
   curl -X POST http://localhost:5000/api/v1/endpoint \
     -H "Content-Type: application/json" \
     -d '{"key": "value"}'
   ```

2. **API Testing with Postman**
   - Import API requests from `docs/api/`
   - Test various endpoints
   - Check response formats

3. **Frontend Testing**
   - Open browser DevTools
   - Check Network tab for API calls
   - Check Console for errors

### Debugging

#### Backend Debugging

1. **Enable Debug Logs**
   ```javascript
   import { logger } from '../utils/logger.js';
   
   logger.debug('Debug message', { data });
   logger.info('Info message');
   logger.warn('Warning message');
   logger.error('Error message');
   ```

2. **Check Server Logs**
   - Monitor terminal running `npm run dev`
   - Look for request/response logs
   - Check error stack traces

#### Frontend Debugging

1. **Browser DevTools**
   - F12 or Cmd+Option+I
   - Network tab for API requests
   - Console tab for errors
   - Application tab for storage

2. **React DevTools Extension**
   - Install React Developer Tools
   - Inspect component props and state
   - Track re-renders

## Code Quality Workflows

### Linting

**Backend:**
```bash
cd server
npm run lint     # Check for errors
npm run lint     # Auto-fix errors
```

**Frontend:**
```bash
cd client
npm run lint     # Check for errors
npm run lint     # Auto-fix errors
```

### Code Organization

1. **File Structure**
   - Keep files focused and single-responsibility
   - Use meaningful names
   - Organize by feature/module

2. **Imports**
   - Group imports: external, internal, relative
   - Use absolute imports from root where possible
   - Avoid circular dependencies

3. **Comments**
   - Add comments only when needed
   - Explain WHY, not WHAT
   - Keep comments up-to-date

## Database Workflows

### Database Management

1. **Check Database Status**
   ```bash
   mongosh
   show dbs
   use it-management-system
   show collections
   ```

2. **View Documents**
   ```javascript
   db.users.find().pretty()
   db.employees.count()
   ```

3. **Clear Database**
   ```javascript
   db.dropDatabase()
   ```

## Git Workflows

### Committing Changes

Follow conventional commit format:

```bash
git add .
git commit -m "feat: add new feature"
git commit -m "fix: fix bug in component"
git commit -m "docs: update README"
```

### Commit Types
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting (no code change)
- `refactor:` - Code restructuring
- `test:` - Tests
- `chore:` - Dependencies, build

## Documentation Workflows

### Updating Documentation

1. **Architecture Changes**
   - Update `docs/architecture/OVERVIEW.md`
   - Update `README.md`

2. **API Changes**
   - Update `docs/api/API_REFERENCE.md`
   - Add examples and usage

3. **Database Changes**
   - Update `docs/database/CONFIGURATION.md`
   - Document schema changes

## Troubleshooting Common Issues

### "Cannot find module" Error
```bash
# Solution: Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Port Already in Use
```bash
# Change port in .env
PORT=5001
```

### MongoDB Connection Failed
```bash
# Start MongoDB
mongod
# or check if already running
brew services list  # macOS
```

### CORS Errors
- Check CLIENT_URL in server/.env
- Verify frontend URL matches
- Check browser console for details

### Hot Reload Not Working
- Restart dev server
- Check file save (might need to focus IDE)
- Restart entire development environment

## Performance Optimization Workflows (Phase 2+)

### Identifying Bottlenecks

1. **Backend Performance**
   - Monitor response times in logs
   - Check database query performance
   - Use Node.js profiling tools

2. **Frontend Performance**
   - Use Chrome DevTools Performance tab
   - Check bundle size
   - Monitor component re-renders

### Optimization Techniques

1. **Backend**
   - Add database indexes
   - Implement caching
   - Optimize queries

2. **Frontend**
   - Code splitting and lazy loading
   - Memoization with useMemo/useCallback
   - Image optimization

---

**Status:** Phase 1 - Basic Workflows
**Next:** Advanced Workflows (Phase 2+)
