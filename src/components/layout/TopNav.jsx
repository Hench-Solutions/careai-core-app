import { useState, useRef, useEffect } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { authUtils } from '../../utils/auth'
import { clearMenuCache } from '../../utils/api'

const breadcrumbMap = {
  '/dashboard': 'Dashboard',
  '/lead': 'Lead',
  '/leads/search': 'Lead Search',
  '/leads/actions': 'Lead Actions',
  '/leads/estimate-request': 'Estimate Request',
  '/leads/estimate-status':  'Estimate Status',
  '/leads/estimate-compare': 'Estimate Compare',
  '/appointments': 'Appointments',
  '/appointments/confirm': 'Appointment Confirm',
  '/documents': 'Document Upload',
  '/estimate/view': 'View Estimate',
  '/reports/mis': 'MIS Reports',
}

export default function TopNav({ collapsed, onToggle }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  const user        = authUtils.getUser()
  const displayName = user?.user_Full_Name || user?.user_Nm || 'User'

  const handleLogout = () => {
    authUtils.clearSession()
    clearMenuCache()
    navigate('/login', { replace: true })
  }

  const pageName = breadcrumbMap[location.pathname] || 'CareAi'

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className={`top-nav ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Toggle */}
      <button className="top-nav-toggle" onClick={onToggle} title="Toggle Sidebar">
        <i className="fas fa-bars"></i>
      </button>

      {/* Breadcrumb */}
      <div className="top-nav-breadcrumb">
        <span>Home</span> &nbsp;/&nbsp; <strong>{pageName}</strong>
      </div>

      {/* Right Side */}
      <div className="top-nav-right">
        {/* Notifications */}
        <button className="top-nav-icon-btn" title="Notifications">
          <i className="fas fa-bell"></i>
          <span className="top-nav-badge">3</span>
        </button>

        {/* User Profile */}
        <div className="top-nav-user" ref={dropdownRef} onClick={() => setDropdownOpen(!dropdownOpen)}>
          <div className="top-nav-user-avatar">
            <i className="fas fa-user"></i>
          </div>
          <span className="top-nav-user-name">{displayName}</span>
          <i className="fas fa-angle-down" style={{ fontSize: 11, color: '#999' }}></i>

          {dropdownOpen && (
            <div className="top-nav-dropdown">
              <Link to="/profile" onClick={() => setDropdownOpen(false)}>
                <i className="fas fa-user"></i>
                Profile
              </Link>
              <Link to="/settings" onClick={() => setDropdownOpen(false)}>
                <i className="fas fa-cog"></i>
                Settings
              </Link>
              <div className="top-nav-dropdown-divider"></div>
              <Link to="#" onClick={e => { e.preventDefault(); handleLogout() }}>
                <i className="fas fa-sign-out-alt"></i>
                Log Out
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
