import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { GameProvider } from './connection';
import { App } from './App';
import './styles.css';
createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <GameProvider>
      <App />
    </GameProvider>
  </HashRouter>,
);
