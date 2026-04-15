import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * iOS Safari reports an unreliable window.innerHeight that changes as browser
 * chrome appears/disappears.  Write the actual visible height into a CSS
 * variable so the layout uses `var(--app-height)` rather than `100vh`.
 */
function syncAppHeight() {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
}

syncAppHeight();
window.addEventListener('resize', syncAppHeight);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
