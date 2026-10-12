import React from 'react';
import { createRoot } from 'react-dom/client';
import WebShell from './WebShell';
import { registerServiceWorker } from './pwa';
import './theme.css';
import '../index.css';

const container = document.getElementById('root')!;
createRoot(container).render(
  <React.StrictMode>
    <WebShell />
  </React.StrictMode>
);

// Offline app shell (no log data is ever cached — see sw.js).
registerServiceWorker();
