import { AppContextProvider } from './context/AppContext';
import AppRoutes from './routes/AppRoutes';

import './styles/global.css';
import './styles/responsive.css';
import './styles/variables.css';
import './styles/ui-scale.css';

function App() {
  return (
    <AppContextProvider>
      <AppRoutes />
    </AppContextProvider>
  );
}

export default App;