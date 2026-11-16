import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 元件展示頁只在開發模式存在：正式 build 時 import.meta.env.DEV 是 false，
// 這個動態 import 會被整段移除，展示頁不會被打包。
// ?demo 是共用元件；?demo=training 是弱點特訓的各種畫面。
const demo = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('demo') : null
const DemoPage = demo === null ? null : demo === 'training' ? lazy(() => import('./demo/TrainingDemo.tsx')) : lazy(() => import('./demo/DemoPage.tsx'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {DemoPage ? (
      <Suspense fallback={null}>
        <DemoPage />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
