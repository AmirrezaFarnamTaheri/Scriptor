import { createRoot } from 'react-dom/client'
import { MobileApp } from './MobileApp'
import './mobile.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing application root')
createRoot(root).render(<MobileApp />)
