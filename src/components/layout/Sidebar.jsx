import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { authUtils } from '../../utils/auth'
import { getUserMenu, clearMenuCache } from '../../utils/api'
import logo from '../../assets/images/logo.png'

export default function Sidebar({ collapsed, onToggle }) {
  const [menuSections, setMenuSections] = useState([])
  const [openSection,  setOpenSection]  = useState(null)   // L1 accordion — only one open at a time
  const [openMenus,    setOpenMenus]    = useState({})     // L3 submenu expand state
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    getUserMenu().then(setMenuSections)
  }, [])

  // Auto-expand the section that contains the current active page
  useEffect(() => {
    if (!menuSections.length) return
    for (const section of menuSections) {
      const isActive = section.items.some(item => {
        if (item.pageUrl && location.pathname.startsWith(item.pageUrl)) return true
        return item.children?.some(c => c.pageUrl && location.pathname.startsWith(c.pageUrl))
      })
      if (isActive) { setOpenSection(section.pageId); return }
    }
  }, [menuSections, location.pathname])

  const handleLogout = () => {
    clearMenuCache()
    authUtils.clearSession()
    navigate('/login', { replace: true })
  }

  const toggleSection = (pageId) => {
    setOpenSection(prev => prev === pageId ? null : pageId)
  }

  const toggleSubmenu = (pageId) => {
    setOpenMenus(prev => ({ ...prev, [pageId]: !prev[pageId] }))
  }

  const isChildActive = (children) =>
    children?.some(c => c.pageUrl && location.pathname.startsWith(c.pageUrl))

  // Direct-nav: section has its own URL (no L2 items), or has exactly one childless L2 item
  const isDirectNav = (section) =>
    (section.items.length === 0 && !!section.pageUrl) ||
    (section.items.length === 1 && !section.items[0].children?.length)

  const getDirectNavUrl = (section) =>
    section.items.length === 0 ? section.pageUrl : section.items[0].pageUrl

  const handleSectionClick = (section) => {
    if (isDirectNav(section)) {
      navigate(getDirectNavUrl(section))
    } else {
      toggleSection(section.pageId)
    }
  }

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <img src={logo} alt="CareAi" className="sidebar-logo" />
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {menuSections.map((section) => {
          const isSectionOpen    = openSection === section.pageId
          const isDirect         = isDirectNav(section)
          const directUrl        = isDirect ? getDirectNavUrl(section) : ''
          const isDirectActive   = isDirect && !!directUrl && location.pathname.startsWith(directUrl)

          return (
            <div className="sidebar-section" key={section.pageId}>

              {/* L1 — clickable section header */}
              <div
                className={`sidebar-section-title ${isSectionOpen || isDirectActive ? 'open' : ''}`}
                onClick={() => handleSectionClick(section)}
              >
                <span>{section.section}</span>
                {!isDirect && <i className="fas fa-chevron-right sidebar-section-title-arrow"></i>}
              </div>

              {/* L2 — collapsible body, only visible when section is open (hidden for direct-nav) */}
              {!isDirect && <div className={`sidebar-section-body ${isSectionOpen ? 'open' : ''}`}>
                {section.items.map((item) => {
                  if (item.hasChildren) {
                    const isOpen = openMenus[item.pageId] || isChildActive(item.children)
                    return (
                      <div className={`sidebar-item ${isOpen ? 'open' : ''}`} key={item.pageId}>
                        <div
                          className={`sidebar-link ${isChildActive(item.children) ? 'active' : ''}`}
                          onClick={() => toggleSubmenu(item.pageId)}
                        >
                          <i className="fas fa-folder"></i>
                          <span className="sidebar-link-text">{item.pageTitle}</span>
                          <i className="fas fa-chevron-right sidebar-arrow"></i>
                        </div>
                        {/* L3 — child links */}
                        <div className={`sidebar-submenu ${isOpen ? 'open' : ''}`}>
                          {item.children.map((child) => (
                            <NavLink
                              key={child.pageId}
                              to={child.pageUrl}
                              className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                              }
                            >
                              <i className="fas fa-circle" style={{ fontSize: 6 }}></i>
                              <span className="sidebar-link-text">{child.pageTitle}</span>
                            </NavLink>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <NavLink
                      key={item.pageId}
                      to={item.pageUrl}
                      className={({ isActive }) =>
                        `sidebar-link ${isActive ? 'active' : ''}`
                      }
                    >
                      <i className="fas fa-circle"></i>
                      <span className="sidebar-link-text">{item.pageTitle}</span>
                    </NavLink>
                  )
                })}
              </div>}

            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button onClick={handleLogout} className="sidebar-link sidebar-logout-btn">
          <i className="fas fa-sign-out-alt"></i>
          <span className="sidebar-link-text">Logout</span>
        </button>
      </div>
    </aside>
  )
}
