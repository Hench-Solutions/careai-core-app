import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import brandLogo from '../../assets/images/CareAIlogo1.png'
import bgImage from '../../assets/images/bg1.png'
import { authUtils } from '../../utils/auth'
import { API_BASE, API_VERSION } from '../../utils/api'
import '../../styles/login-new.css'

const PREVIEW_SCREENS = [
  {
    key: 'dashboard',
    nav: 'Dashboard',
    heading: { title: 'Good morning 👋', sub: 'Here’s what’s happening today.' },
    stats: [
      { label: 'Total Cases', value: '1,248' },
      { label: 'Active Cases', value: '632' },
      { label: 'Patients', value: '1,092' }
    ],
    charts: { funnelTitle: 'Case Pipeline', bars: [100, 82, 64, 48, 31], donutTitle: 'Cases by Status', donutCaption: '632 Active Cases' }
  },
  {
    key: 'patients',
    nav: 'Patients & Cases',
    heading: { title: 'Patient Directory', sub: 'Active journeys across every stage.' },
    stats: [
      { label: 'Total Patients', value: '1,092' },
      { label: 'New Today', value: '24' },
      { label: 'Avg. Stay', value: '4.2d' }
    ],
    rows: [
      { icon: 'AK', title: 'Aisha Khan', sub: 'Cardiac procedure · Room 4B', tag: 'Active', tagClass: 'is-green' },
      { icon: 'RS', title: 'Rahul Sen', sub: 'Orthopedic · Pre-op', tag: 'Pending', tagClass: 'is-amber' },
      { icon: 'ML', title: 'Maria Lopez', sub: 'Oncology · Follow-up', tag: 'Review', tagClass: 'is-blue' },
      { icon: 'JD', title: 'James Doyle', sub: 'Discharge planning', tag: 'Ready', tagClass: 'is-green' }
    ]
  },
  {
    key: 'leads',
    nav: 'Lead Management',
    heading: { title: 'Lead Pipeline', sub: 'Enquiry to conversion overview.' },
    stats: [
      { label: 'New Leads', value: '186' },
      { label: 'Qualified', value: '92' },
      { label: 'Converted', value: '41' }
    ],
    charts: { funnelTitle: 'Lead Stages', bars: [100, 74, 49, 26], donutTitle: 'Lead Sources', donutCaption: '186 New Leads' }
  },
  {
    key: 'insurance',
    nav: 'Insurance / GOP',
    heading: { title: 'Insurance & GOP', sub: 'Approvals moving through payers.' },
    stats: [
      { label: 'Pending', value: '18' },
      { label: 'Approved', value: '122' },
      { label: 'Denied', value: '6' }
    ],
    rows: [
      { icon: 'GP', title: 'GOP #4821', sub: 'Bupa Global · Cardiology', tag: 'Approved', tagClass: 'is-green' },
      { icon: 'GP', title: 'GOP #4829', sub: 'Allianz Care · Oncology', tag: 'Pending', tagClass: 'is-amber' },
      { icon: 'GP', title: 'GOP #4833', sub: 'Cigna Intl. · Orthopedics', tag: 'In Review', tagClass: 'is-blue' }
    ]
  },
  {
    key: 'referrals',
    nav: 'Referrals',
    heading: { title: 'Referral Network', sub: 'Partner performance this month.' },
    stats: [
      { label: 'Referrals', value: '312' },
      { label: 'Conversion', value: '27%' },
      { label: 'Partners', value: '48' }
    ],
    charts: { funnelTitle: 'Top Sources', bars: [100, 68, 52, 34], donutTitle: 'By Region', donutCaption: '312 Referrals' }
  },
  {
    key: 'providers',
    nav: 'Provider Network',
    heading: { title: 'Provider Network', sub: 'Verified specialists on call.' },
    stats: [
      { label: 'Providers', value: '214' },
      { label: 'Specialties', value: '32' },
      { label: 'Avg. Rating', value: '4.8' }
    ],
    rows: [
      { icon: 'DK', title: 'Dr. Kapoor', sub: 'Cardiology · Apollo Delhi', tag: '4.9★', tagClass: 'is-green' },
      { icon: 'DN', title: 'Dr. Novak', sub: 'Orthopedics · Vienna', tag: '4.7★', tagClass: 'is-blue' },
      { icon: 'DS', title: 'Dr. Silva', sub: 'Oncology · Lisbon', tag: '4.8★', tagClass: 'is-green' }
    ]
  },
  {
    key: 'travel',
    nav: 'Travel Assistance',
    heading: { title: 'Travel Assistance', sub: 'Coordination for upcoming trips.' },
    stats: [
      { label: 'Trips Booked', value: '58' },
      { label: 'In Transit', value: '12' },
      { label: 'Completed', value: '46' }
    ],
    rows: [
      { icon: '✈', title: 'Flight · DXB → DEL', sub: 'Patient: A. Khan', tag: 'Booked', tagClass: 'is-blue' },
      { icon: '🏨', title: 'Hotel · Care Suites', sub: '3 nights · Near hospital', tag: 'Confirmed', tagClass: 'is-green' },
      { icon: '🚐', title: 'Airport Transfer', sub: 'Pickup 6:30 AM', tag: 'Scheduled', tagClass: 'is-amber' }
    ]
  },
  {
    key: 'billing',
    nav: 'Billing & Settlement',
    heading: { title: 'Billing & Settlement', sub: 'This month’s invoices at a glance.' },
    stats: [
      { label: 'Invoiced', value: '$482K' },
      { label: 'Collected', value: '$391K' },
      { label: 'Outstanding', value: '$91K' }
    ],
    charts: { funnelTitle: 'Payment Status', bars: [100, 81, 19], donutTitle: 'By Payer', donutCaption: '$482K Invoiced' }
  },
  {
    key: 'documents',
    nav: 'Documents',
    heading: { title: 'Documents', sub: 'Case files & records, all in one place.' },
    stats: [
      { label: 'Total Docs', value: '3,482' },
      { label: 'Pending Sign', value: '14' },
      { label: 'Shared', value: '620' }
    ],
    rows: [
      { icon: 'PDF', title: 'Discharge Summary.pdf', sub: 'Updated 2h ago', tag: 'Signed', tagClass: 'is-green' },
      { icon: 'DOC', title: 'Consent Form.docx', sub: 'Awaiting signature', tag: 'Pending', tagClass: 'is-amber' },
      { icon: 'IMG', title: 'Insurance Card.jpg', sub: 'Shared with payer', tag: 'Shared', tagClass: 'is-blue' }
    ]
  }
]

function ProductPreview() {
  const [activeIndex, setActiveIndex] = useState(0)
  const timerRef = useRef(null)

  const startCycle = () => {
    stopCycle()
    timerRef.current = window.setInterval(() => {
      setActiveIndex(i => (i + 1) % PREVIEW_SCREENS.length)
    }, 3400)
  }

  const stopCycle = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!prefersReducedMotion) startCycle()
    return stopCycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active = PREVIEW_SCREENS[activeIndex]

  return (
    <div className="cai-preview-stage">
      <div className="cai-preview-ring cai-preview-ring--a" aria-hidden="true"></div>
      <div className="cai-preview-ring cai-preview-ring--b" aria-hidden="true"></div>

      <div className="cai-product-preview" onMouseLeave={startCycle}>
        <div className="cai-preview-sidebar">
          <div className="cai-preview-brand">
            <img className="cai-preview-brand-logo" src={brandLogo} alt="CareAI" />
          </div>
          {PREVIEW_SCREENS.map((s, i) => (
            <span
              key={s.key}
              className={i === activeIndex ? 'is-active' : ''}
              onMouseEnter={() => { stopCycle(); setActiveIndex(i) }}
              onClick={() => { stopCycle(); setActiveIndex(i); startCycle() }}
            >
              {s.nav}
            </span>
          ))}
        </div>

        <div className="cai-preview-main">
          <div className="cai-preview-search">Search patients, cases, providers...</div>

          <div className="cai-preview-screen is-visible" key={active.key}>
            <div className="cai-preview-heading">
              <strong>{active.heading.title}</strong>
              <small>{active.heading.sub}</small>
            </div>
            <div className="cai-preview-stats">
              {active.stats.map(s => (
                <div key={s.label}><span>{s.label}</span><strong>{s.value}</strong></div>
              ))}
            </div>

            {active.charts && (
              <div className="cai-preview-charts">
                <div className="cai-funnel">
                  <strong>{active.charts.funnelTitle}</strong>
                  {active.charts.bars.map((w, i) => (
                    <i key={i} style={{ width: `${w}%` }}></i>
                  ))}
                </div>
                <div className="cai-donut-card">
                  <strong>{active.charts.donutTitle}</strong>
                  <div className="cai-mini-donut"></div>
                  <span>{active.charts.donutCaption}</span>
                </div>
              </div>
            )}

            {active.rows && (
              <div className="cai-scr-rows">
                {active.rows.map((r, i) => (
                  <div className="cai-scr-row" key={i}>
                    <span className="cai-scr-row-icon">{r.icon}</span>
                    <div className="cai-scr-row-body"><strong>{r.title}</strong><span>{r.sub}</span></div>
                    <span className={`cai-scr-tag ${r.tagClass}`}>{r.tag}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()

  const [form, setForm]         = useState({ username: '', password: '' })
  const [errors, setErrors]     = useState({})
  const [showPass, setShowPass] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading]   = useState(false)

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e })
    if (errorMsg) setErrorMsg('')
  }

  const validate = () => {
    const e = {}
    if (!form.username.trim()) e.username = 'User ID is required'
    if (!form.password)        e.password = 'Password is required'
    return e
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length) { setErrors(e2); return }

    setLoading(true)
    setErrorMsg('')

    try {
      const res = await fetch(`${API_BASE}${API_VERSION ? `/${API_VERSION}` : ''}/Auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_Nm:  form.username.trim(),
          password: form.password
        })
      })

      let data = null
      try { data = await res.json() } catch { /* non-JSON response */ }

      const firstError = data?.errorObj?.[0]

      if (res.ok && firstError?.errorCode === 0 && data?.responseObj) {
        authUtils.saveSession(data.responseObj.token, data.responseObj)
        navigate('/dashboard', { replace: true })
      } else {
        setErrorMsg(firstError?.errorMessage || 'Invalid User ID or Password. Please try again.')
      }
    } catch {
      setErrorMsg('Unable to connect to server. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const year = new Date().getFullYear()

  return (
    <main className="cai-login-page" style={{ '--cai-login-bg-image': `url(${bgImage})` }}>
      <div className="cai-login-shell">

        {/* ── Left Product Panel ── */}
        <section className="cai-brand-panel" aria-label="CareAI product overview">
          <div className="cai-brand-logo-wrap">
            <img src={brandLogo} alt="CareAi" className="cai-brand-logo" />
          </div>

          <div className="cai-brand-copy">
            <h1>Welcome to <span>CareAi</span></h1>
            <p>Secure access to your connected international patient management workspace.</p>
          </div>

          <div className="cai-feature-grid">
            <article className="cai-feature">
              <div className="cai-feature-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="3"/>
                  <path d="M5.5 20c.8-4 3-6 6.5-6s5.7 2 6.5 6"/>
                </svg>
              </div>
              <div>
                <strong>Patient Journeys</strong>
                <span>Manage every stage from enquiry to discharge.</span>
              </div>
            </article>

            <article className="cai-feature">
              <div className="cai-feature-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3l7 3v5c0 4.5-2.7 7.8-7 10-4.3-2.2-7-5.5-7-10V6l7-3z"/>
                  <path d="M9.5 12l1.7 1.7 3.6-4"/>
                </svg>
              </div>
              <div>
                <strong>Insurance &amp; GOP</strong>
                <span>Coordinate approvals, payers and direct billing.</span>
              </div>
            </article>

            <article className="cai-feature">
              <div className="cai-feature-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 20V12M10 20V8M15 20V4M20 20V10"/>
                </svg>
              </div>
              <div>
                <strong>Business Intelligence</strong>
                <span>Turn operational data into actionable insights.</span>
              </div>
            </article>
          </div>

          <ProductPreview />
        </section>

        {/* ── Login Panel ── */}
        <section className="cai-login-card-wrap">
          <div className="cai-login-card">

            <header className="cai-login-header">
              <span className="cai-login-label">SECURE ACCESS</span>
              <h2>Sign in</h2>
              <p>Welcome back. Sign in to continue to CareAi.</p>
            </header>

            {errorMsg && (
              <div className="cai-login-error-banner">
                <i className="fas fa-exclamation-circle"></i>
                {errorMsg}
              </div>
            )}

            <form className="cai-login-form" onSubmit={handleLogin} noValidate>

              <div className="cai-field">
                <label htmlFor="username">User ID</label>
                <div className="cai-input-wrap">
                  <span className="cai-input-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="8" r="3.5"/>
                      <path d="M5 20c.9-4.2 3.2-6.5 7-6.5s6.1 2.3 7 6.5"/>
                    </svg>
                  </span>
                  <input
                    id="username"
                    type="text"
                    placeholder="Enter your User ID"
                    value={form.username}
                    onChange={e => handleChange('username', e.target.value)}
                    className={errors.username ? 'input-error' : ''}
                    autoComplete="username"
                  />
                </div>
                {errors.username && <span className="cai-error">{errors.username}</span>}
              </div>

              <div className="cai-field">
                <label htmlFor="password">Password</label>
                <div className="cai-input-wrap">
                  <span className="cai-input-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="5" y="10" width="14" height="10" rx="2"/>
                      <path d="M8 10V7a4 4 0 018 0v3"/>
                    </svg>
                  </span>
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={e => handleChange('password', e.target.value)}
                    className={errors.password ? 'input-error' : ''}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="cai-password-toggle"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPass(p => !p)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {showPass ? (
                        <>
                          <path d="M3 3l18 18"/>
                          <path d="M10.6 10.6a2.7 2.7 0 003.8 3.8"/>
                          <path d="M6.6 6.7C4.5 8.1 3 10 2.5 12c0 0 3.5 6 9.5 6 1.7 0 3.2-.4 4.4-1.1"/>
                          <path d="M17.9 17.9C19.9 16.5 21 12 21 12s-1.1-2-3-3.5"/>
                        </>
                      ) : (
                        <>
                          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/>
                          <circle cx="12" cy="12" r="2.7"/>
                        </>
                      )}
                    </svg>
                  </button>
                </div>
                {errors.password && <span className="cai-error">{errors.password}</span>}
              </div>

              <button type="submit" className="cai-login-button" disabled={loading}>
                {loading ? (
                  <><i className="fas fa-spinner fa-spin"></i><span>Logging in...</span></>
                ) : (
                  <>
                    <span>Sign in securely</span>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6"/>
                    </svg>
                  </>
                )}
              </button>

              <div className="cai-security-row">
                <span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3l7 3v5c0 4.5-2.7 7.8-7 10-4.3-2.2-7-5.5-7-10V6l7-3z"/>
                    <path d="M9.5 12l1.7 1.7 3.6-4"/>
                  </svg>
                  Healthcare-grade security
                </span>
                <span>Role-based access</span>
                <span>Secure cloud access</span>
              </div>

            </form>

          </div>

          <div className="cai-login-footer">
            <span>© {year} CareAi — Medical Assistance Platform (Version 1.0.0)</span>
          </div>
        </section>

      </div>
    </main>
  )
}
