import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'

import App from './App'

import 'bootstrap/dist/css/bootstrap.min.css'
import './styles/bootstrap-rims.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
    throw new Error('Không tìm thấy #root để mount React app.')
}

createRoot(rootElement).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
