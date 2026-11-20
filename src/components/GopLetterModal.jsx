import { useState, useEffect } from 'react'
import { saveGop, sendGopToProvider } from '../utils/api'

/**
 * Reusable GOP letter preview modal.
 * Props:
 *   claimNo   {string}
 *   memberId  {string}
 *   prvCd     {string}
 *   prvNm     {string}
 *   prvEmail  {string}
 *   onClose   {function}           — called when modal is closed
 *   onSent    {function}  optional — called after GOP successfully sent
 */
const CHANNEL_OPTIONS = [
  { value: 'Email',    label: 'Email',                    enabled: true  },
  { value: 'WhatsApp', label: 'WhatsApp',                 enabled: false },
  { value: 'Both',     label: 'Both Email and WhatsApp',  enabled: false },
]

export default function GopLetterModal({ claimNo, memberId, prvCd, prvNm, prvEmail, onClose, onSent }) {
  const [html,    setHtml]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState(false)
  const [notifyChannel, setNotifyChannel] = useState('Email')

  useEffect(() => {
    saveGop({ mode: 'R', claimNo, memberId, prvCd, expenses: [] })
      .then(h  => setHtml(h))
      .catch(() => setError('Failed to load GOP letter.'))
      .finally(() => setLoading(false))
  }, [claimNo, memberId, prvCd])

  async function handleSend() {
    setSending(true)
    try {
      await sendGopToProvider({ claimNo, memberId, prvCd, notifyChannel })
      setSuccess(true)
    } catch (err) {
      setError(err?.message || 'Failed to send GOP to provider.')
    } finally {
      setSending(false)
    }
  }

  if (success) return (
    <div className="vmodal-overlay" onClick={() => { onClose(); if (onSent) onSent() }}>
      <div className="vmodal-box" onClick={e => e.stopPropagation()}>
        <div className="vmodal-header success">
          <i className="fas fa-check-circle"></i>
          <span>GOP Sent Successfully</span>
        </div>
        <div className="vmodal-body" style={{ padding:'18px 22px', fontSize:14, color:'#333' }}>
          GOP letter has been sent to the provider successfully.
        </div>
        <div className="vmodal-footer">
          <button className="vmodal-ok" onClick={() => { onClose(); if (onSent) onSent() }}>OK</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:8, width:'90%', maxWidth:900, height:'96vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.25)' }}>

        {/* Header bar */}
        <div style={{ background:'#f5f0fb', borderBottom:'2px solid #72389c', padding:'12px 20px', display:'flex', flexDirection:'column', gap:10, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
            <div style={{ fontSize:13, color:'#333', display:'flex', flexDirection:'column', gap:2 }}>
              <span><strong>Provider:</strong> {prvNm}</span>
              <span><strong>Email:</strong> {prvEmail || '—'}</span>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button
                onClick={handleSend}
                disabled={sending || loading}
                style={{ background:'linear-gradient(135deg,#72389c 0%,#a855f7 100%)', color:'#fff', border:'none', padding:'8px 18px', fontSize:13, fontWeight:600, borderRadius:6, cursor:'pointer' }}
              >
                {sending ? 'Sending...' : '✉ Send GOP to Provider'}
              </button>
              <button
                onClick={onClose}
                style={{ background:'#eee', color:'#333', border:'none', padding:'8px 14px', fontSize:13, fontWeight:600, borderRadius:6, cursor:'pointer' }}
              >
                Close
              </button>
            </div>
          </div>

          {/* Notification channel selector */}
          <div style={{ display:'flex', alignItems:'center', gap:20, fontSize:13, color:'#333' }}>
            <span style={{ fontWeight:600 }}>Notify Provider Via:</span>
            {CHANNEL_OPTIONS.map(opt => (
              <label
                key={opt.value}
                title={opt.enabled ? '' : 'Coming soon'}
                style={{ display:'flex', alignItems:'center', gap:6, cursor: opt.enabled ? 'pointer' : 'not-allowed', color: opt.enabled ? '#333' : '#aaa' }}
              >
                <input
                  type="checkbox"
                  checked={notifyChannel === opt.value}
                  disabled={!opt.enabled}
                  onChange={() => setNotifyChannel(opt.value)}
                />
                {opt.label}
              </label>
            ))}
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
          <iframe srcDoc={html} style={{ flex:1, border:'none', width:'100%' }} title="GOP Letter" />
        )}

      </div>
    </div>
  )
}
