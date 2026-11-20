import { useState, useEffect } from 'react'
import { fetchVisaInvite } from '../utils/api'

/**
 * Reusable Visa Invite letter preview modal.
 * Props:
 *   claimNo  {string}
 *   onClose  {function}
 */
export default function VisaInviteModal({ claimNo, onClose }) {
  const [html,    setHtml]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetchVisaInvite(claimNo)
      .then(h  => setHtml(h))
      .catch(() => setError('Failed to load Visa Invite letter.'))
      .finally(() => setLoading(false))
  }, [claimNo])

  function handlePrint() {
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      win.print()
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:8, width:'90%', maxWidth:860, height:'96vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ background:'#eaf4fb', borderBottom:'2px solid #2a96ba', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ fontWeight:700, fontSize:14, color:'#1a5276' }}>
            <i className="fas fa-passport" style={{ marginRight:8 }}></i>
            Visa Invitation Letter
          </span>
          <div style={{ display:'flex', gap:10 }}>
            {html && !loading && (
              <button
                onClick={handlePrint}
                style={{ background:'linear-gradient(135deg,#2a96ba 0%,#1a5276 100%)', color:'#fff', border:'none', padding:'8px 18px', fontSize:13, fontWeight:600, borderRadius:6, cursor:'pointer' }}
              >
                <i className="fas fa-print" style={{ marginRight:6 }}></i>Print
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background:'#eee', color:'#333', border:'none', padding:'8px 14px', fontSize:13, fontWeight:600, borderRadius:6, cursor:'pointer' }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        {loading && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#888' }}>
            <i className="fas fa-spinner fa-spin" style={{ marginRight:8 }} /> Loading...
          </div>
        )}
        {error && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#c00', fontSize:13 }}>
            {error}
          </div>
        )}
        {html && !loading && (
          <iframe srcDoc={html} style={{ flex:1, border:'none', width:'100%' }} title="Visa Invite Letter" />
        )}

      </div>
    </div>
  )
}
