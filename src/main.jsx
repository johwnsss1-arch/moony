import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/fredoka/latin-500.css'
import '@fontsource/fredoka/latin-600.css'
import '@fontsource/creepster/latin-400.css'
import '@fontsource/orbitron/latin-700.css'
import '@fontsource/mountains-of-christmas/latin-700.css'
import '@fontsource/m-plus-rounded-1c/latin-800.css'
import '@fontsource/pacifico/latin-400.css'
import '@fontsource/baloo-2/latin-700.css'
import '@fontsource/space-grotesk/latin-700.css'
import './index.css'
import './pages.css'
import './pages2.css'
import './pages3.css'
import './pages4.css'
import './pages5.css'
import './pages6.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
