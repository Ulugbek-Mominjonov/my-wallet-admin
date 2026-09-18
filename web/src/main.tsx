import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@/index.css'
import '@/shared/i18n'

import { App } from '@/app/app'

const container = document.getElementById('root')
if (!container) {
  throw new Error('#root elementi topilmadi (index.html)')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
