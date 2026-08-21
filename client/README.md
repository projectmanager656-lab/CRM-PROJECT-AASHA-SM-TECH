# IT Company Management System - Client

React frontend for the IT Company Management System with modern tooling and structured architecture.

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Configuration

Create `.env` file in the client root:

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_ENV=development
VITE_ENABLE_AUTH=false
```

### Running the Development Server

```bash
npm run dev
```

The application will open in your browser at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## 📁 Project Structure

```
client/
├── public/
│   ├── assets/
│   │   ├── images/
│   │   └── icons/
│   ├── logo.png
│   └── index.html
├── src/
│   ├── components/
│   │   ├── common/         # Shared UI components
│   │   ├── layout/         # Layout components
│   │   └── ui/             # Reusable UI components
│   ├── layouts/
│   │   ├── MainLayout.jsx
│   │   ├── AuthLayout.jsx
│   │   ├── ErrorLayout.jsx
│   │   └── BlankLayout.jsx
│   ├── routes/
│   │   ├── AppRoutes.jsx
│   │   └── routeConfig.js
│   ├── services/
│   │   └── apiClient.js    # Axios configuration
│   ├── context/
│   │   └── AppContext.jsx  # Global state (Phase 2)
│   ├── hooks/              # Custom React hooks
│   ├── constants/          # App constants
│   ├── utils/              # Utility functions
│   ├── styles/
│   │   ├── global.css      # Global styles
│   │   ├── variables.css   # CSS variables
│   │   └── responsive.css  # Responsive utilities
│   ├── App.jsx             # Root component
│   ├── main.jsx            # Entry point
│   └── .env                # Environment variables
├── .env.example
├── vite.config.js          # Vite configuration
├── package.json
└── README.md
```

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| VITE_API_URL | Backend API base URL | http://localhost:5000/api/v1 |
| VITE_ENV | Environment (development/production) | development |
| VITE_ENABLE_AUTH | Enable authentication features | false |

## 📦 Dependencies

### Production
- **react** - UI library
- **react-dom** - DOM rendering
- **react-router-dom** - Client-side routing
- **axios** - HTTP client

### Development
- **vite** - Build tool and dev server
- **@vitejs/plugin-react** - React support for Vite
- **eslint** - Code linting
- **@types/react** - React type definitions

## 🛠 Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## 🎨 Styling Approach

### CSS Variables
Define global variables in `src/styles/variables.css`:
```css
--color-primary: #2563eb
--spacing-md: 1rem
--font-size-base: 1rem
```

### Global Styles
Global CSS in `src/styles/global.css` with:
- CSS reset
- Base element styles
- Utility classes
- Typography setup

### Responsive Design
Mobile-first approach using:
- Media queries in `responsive.css`
- CSS Grid and Flexbox
- Responsive utility classes

## 🔌 API Client Configuration

The Axios client is configured in `src/services/apiClient.js`:

```javascript
import apiClient from './services/apiClient';

// Make requests
apiClient.get('/endpoint')
apiClient.post('/endpoint', data)
apiClient.put('/endpoint', data)
apiClient.delete('/endpoint')
```

### Interceptors
- **Request Interceptor** - Adds JWT token to Authorization header
- **Response Interceptor** - Handles 401 errors and redirects to login (Phase 2)

## 🧭 Routing Configuration

Routes are configured in `src/routes/routeConfig.js`:

```javascript
const routeConfig = [
  {
    path: '/',
    component: Dashboard,
    layout: MainLayout,
  },
  // Add more routes here
];
```

Routes are rendered in `src/routes/AppRoutes.jsx` using React Router v6.

## 📐 Component Structure

### Layout Components
- **MainLayout** - Primary application layout with sidebar, header, etc.
- **AuthLayout** - Authentication pages (login, register, forgot password)
- **ErrorLayout** - Error page layout (404, 500, etc.)
- **BlankLayout** - Minimal layout with no header/sidebar

### Common Components
Reusable components in `src/components/common/`:
- Button
- Input
- Modal
- Alert
- Card
- etc.

### UI Components
Standalone UI elements in `src/components/ui/`:
- Avatar
- Badge
- Skeleton
- Spinner
- etc.

## 🔄 Application Context (Phase 2)

Global application state will be managed using React Context in `src/context/AppContext.jsx`:

```javascript
import { useContext } from 'react';
import { AppContext } from '../context/AppContext';

function MyComponent() {
  const { user, loading } = useContext(AppContext);
  // Use global state
}
```

## 🪝 Custom Hooks (Phase 2)

Custom hooks will be created in `src/hooks/`:
- `useAuth` - Authentication state
- `useFetch` - Data fetching
- `useForm` - Form handling
- etc.

## ⚙️ Build Configuration

### Vite Configuration
- **Dev Server** runs on port 5173
- **Automatic Browser Open** on dev start
- **Strict Port** mode disabled (fallback port if 5173 in use)
- **Production Build** with terser minification
- **Source Maps** disabled for production

### Environment Variables in Vite
Access using `import.meta.env.VITE_*`:
```javascript
const apiUrl = import.meta.env.VITE_API_URL;
```

## 🔐 Authentication (Phase 2)

Authentication setup is prepared with:
- Axios interceptors for JWT
- Context for global auth state
- AuthLayout for protected routes
- Logout handling with token cleanup

## 🎯 Development Best Practices

### Component Patterns
```jsx
// Functional component
export default function MyComponent() {
  return <div>Content</div>;
}

// With hooks
import { useState, useEffect } from 'react';

export default function MyComponent() {
  const [state, setState] = useState(null);
  
  useEffect(() => {
    // Side effects
  }, []);
  
  return <div>{state}</div>;
}
```

### API Calls
```javascript
import apiClient from '../services/apiClient';

// In a component
useEffect(() => {
  apiClient
    .get('/endpoint')
    .then(response => setData(response.data))
    .catch(error => console.error(error));
}, []);
```

### Conditional Rendering
```jsx
{condition && <Component />}
{condition ? <ComponentA /> : <ComponentB />}
```

## 🚀 Production Build

1. Build the project:
   ```bash
   npm run build
   ```

2. Serve the `dist` folder with your web server (nginx, Apache, Node.js, etc.)

3. Ensure API URL points to production backend

## 🧪 Testing (Phase 2)

Testing with Vitest and React Testing Library:

```bash
npm run test
```

## 🐛 Troubleshooting

### Port Already in Use
Vite will automatically use a different port if 5173 is taken.
Or change in `vite.config.js`:
```javascript
server: {
  port: 3000
}
```

### API Connection Issues
- Check `VITE_API_URL` in `.env`
- Ensure backend is running on correct port
- Check browser console for CORS errors

### Build Errors
- Clear `dist` folder: `rm -rf dist`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check all import paths are correct

## 📚 Documentation

See main project README for:
- [Architecture Guide](../docs/architecture/)
- [API Documentation](../docs/api/)
- [Workflow Guides](../docs/workflows/)

## 🔜 Next Phases

- Phase 2: Authentication & user management
- Phase 3: Dashboard and module pages
- Phase 4: Advanced features
- Phase 5: PWA and offline support

## 📞 Support

For issues or questions, refer to the main project documentation.

---

**Version:** 1.0.0
**Status:** Phase 1 - Foundation Complete
**React Version:** 18.2+
**Vite Version:** 5.0+
