import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import { useIdleTimer } from '../../utils/useIdleTimer'

export default function Layout() {
  useIdleTimer()
  const location              = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const toggleSidebar = () => setCollapsed(prev => !prev)

  return (
    <div className="app-wrapper">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />

      <div className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <TopNav collapsed={collapsed} onToggle={toggleSidebar} />

        <main className="page-content">
          <Outlet key={location.key} />
        </main>
      </div>
    </div>
  )
}
