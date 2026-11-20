import { useState, useEffect } from 'react'
import { fetchCommunicationLog, resendCommunication, getLeadByClaimNo } from '../utils/api'

// Demo-only: interleaves a synthetic WhatsApp copy of each row right after its
// Email original. Purely a display arrangement over already-fetched data — no
// API/DB changes, no new record is ever created. Controlled by
// VITE_WHATSAPP_CHANNEL so it can be switched on/off per environment without
// touching this component. When enabled, the patient's real mobile number is
// pulled in via the existing getLeadByClaimNo endpoint (already used elsewhere
// in the app) so the WhatsApp rows show a real number, not a blank one.
const WHATSAPP_DEMO_ENABLED = import.meta.env.VITE_WHATSAPP_CHANNEL === 'Y'

function withWhatsAppDemoRows(rows, patientMobileNo) {
  if (!WHATSAPP_DEMO_ENABLED) return rows
  return rows.flatMap(r => [
    r,
    { ...r, channel: 'WhatsApp', recipientEmail: '', recipientCc: '', recipientMobile: patientMobileNo || r.recipientMobile }
  ])
}

// Builds a short (~160 char) WhatsApp-style notification text from data already
// on the row + the patient's name — no AI call, just a template over existing
// fields, kept within the classic single-SMS-segment length.
function buildWhatsAppMessage(row, patientName) {
  const greeting = patientName ? `Hi ${patientName}` : 'Hello'
  const subject = (row.subject || 'an update regarding your case').replace(/\s+/g, ' ').trim()
  const status = row.status?.toLowerCase() === 'success' ? '' : ' (action may be needed)'
  let msg = `${greeting}, ${subject}${status}. Please check your email or the patient portal for full details. - CareAI Team`
  if (msg.length > 160) msg = msg.slice(0, 157).trimEnd() + '...'
  return msg
}

export default function CommunicationLogModal({ claimNo, onClose }) {
  const [rows,     setRows]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState(null)  // row being viewed (Email)
  const [waPreview, setWaPreview] = useState(null) // { mobile, message, subject, crtdDt } — WhatsApp popup
  const [sending,  setSending]  = useState(false)
  const [feedback, setFeedback] = useState('')    // 'success' | 'error' | ''
  const [patientMobileNo, setPatientMobileNo] = useState('')
  const [patientName, setPatientName] = useState('')

  useEffect(() => {
    Promise.all([
      fetchCommunicationLog(claimNo),
      WHATSAPP_DEMO_ENABLED ? getLeadByClaimNo(claimNo).catch(() => null) : Promise.resolve(null)
    ])
      .then(([data, lead]) => {
        const mobileNo = lead?.mobileNo || ''
        const name = [lead?.firstName, lead?.lastName].filter(Boolean).join(' ')
        setPatientMobileNo(mobileNo)
        setPatientName(name)
        setRows(withWhatsAppDemoRows(data, mobileNo))
      })
      .catch(() => setError('Failed to load communication log.'))
      .finally(() => setLoading(false))
  }, [claimNo])

  function openWhatsAppPreview(row) {
    setWaPreview({
      mobile: row.recipientMobile,
      message: buildWhatsAppMessage(row, patientName),
      subject: row.subject,
      crtdDt: row.crtdDt
    })
  }

  async function handleResend() {
    if (!window.confirm('Resend this communication to the original recipient?')) return
    setSending(true)
    setFeedback('')
    try {
      const res = await resendCommunication(selected.id)
      setFeedback(res?.responseObj === true ? 'success' : 'error')
    } catch {
      setFeedback('error')
    } finally {
      setSending(false)
    }
  }

  function handleBack() {
    setSelected(null)
    setFeedback('')
    // Reload list so the new RESEND entry appears
    setLoading(true)
    fetchCommunicationLog(claimNo)
      .then(data => setRows(withWhatsAppDemoRows(data, patientMobileNo)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  return (
    <div className="csm-overlay" onClick={onClose}>
      <div className="comm-log-modal" onClick={e => e.stopPropagation()}>

        <div className="csm-header">
          {selected ? (
            <>
              <h3><i className="fas fa-envelope-open-text"></i> Email Preview</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="comm-view-back-btn" onClick={handleBack}>
                  <i className="fas fa-arrow-left"></i> Back
                </button>
                <button className="csm-close" onClick={onClose}><i className="fas fa-times"></i></button>
              </div>
            </>
          ) : (
            <>
              <h3><i className="fas fa-envelope-open-text"></i> Communication Log — {claimNo}</h3>
              <button className="csm-close" onClick={onClose}><i className="fas fa-times"></i></button>
            </>
          )}
        </div>

        {/* ── Screen 1: Log list ── */}
        {!selected && (
          <div className="comm-log-body">
            {loading && <div className="comm-log-state"><i className="fas fa-spinner fa-spin"></i> Loading...</div>}
            {!loading && error && <div className="comm-log-state comm-log-error">{error}</div>}
            {!loading && !error && rows.length === 0 && <div className="comm-log-state">No communication records found.</div>}
            {!loading && !error && rows.length > 0 && (
              <div className="comm-log-table-wrap">
                <table className="comm-log-table">
                  <thead>
                    <tr>
                      <th>View</th>
                      <th>Channel</th>
                      <th>Recipient Email</th>
                      <th>CC</th>
                      <th>Mobile</th>
                      <th>Subject</th>
                      <th>Status</th>
                      <th>Failure Reason</th>
                      <th>Created By</th>
                      <th>Created On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td>
                          <button
                            className="lsrch-action-link lsrch-action-notes"
                            title={r.channel?.toLowerCase() === 'whatsapp' ? 'View WhatsApp Message' : 'View Email'}
                            onClick={() => {
                              if (r.channel?.toLowerCase() === 'whatsapp') openWhatsAppPreview(r)
                              else { setSelected(r); setFeedback('') }
                            }}
                          >
                            <i className={r.channel?.toLowerCase() === 'whatsapp' ? 'fab fa-whatsapp' : 'fas fa-eye'}></i>
                          </button>
                        </td>
                        <td>{r.channel}</td>
                        <td>{r.recipientEmail}</td>
                        <td>{r.recipientCc}</td>
                        <td>{r.recipientMobile}</td>
                        <td>{r.subject}</td>
                        <td>
                          <span className={`comm-log-status ${r.status?.toLowerCase() === 'success' ? 'comm-log-status-ok' : 'comm-log-status-fail'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>{r.failureReason || '—'}</td>
                        <td>{r.crtdUsr}</td>
                        <td>{r.crtdDt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Screen 2: Email preview + resend ── */}
        {selected && (
          <div className="comm-view-detail">
            <div className="comm-view-meta-bar">
              <div><span className="comm-view-label">To:</span> {selected.recipientEmail}</div>
              {selected.recipientCc && <div><span className="comm-view-label">CC:</span> {selected.recipientCc}</div>}
              <div><span className="comm-view-label">Subject:</span> {selected.subject}</div>
              <div><span className="comm-view-label">Sent On:</span> {selected.crtdDt}</div>
              <div>
                <span className="comm-view-label">Status:</span>
                <span className={`comm-log-status ${selected.status?.toLowerCase() === 'success' ? 'comm-log-status-ok' : 'comm-log-status-fail'}`} style={{ marginLeft: 6 }}>
                  {selected.status}
                </span>
              </div>
              <div className="comm-view-resend-row">
                <button className="gradient-btn" onClick={handleResend} disabled={sending}>
                  {sending
                    ? <><i className="fas fa-spinner fa-spin"></i> Sending...</>
                    : <><i className="fas fa-paper-plane"></i> Resend</>}
                </button>
                {feedback === 'success' && <span className="comm-view-feedback-ok"><i className="fas fa-check-circle"></i> Sent successfully</span>}
                {feedback === 'error'   && <span className="comm-view-feedback-err"><i className="fas fa-times-circle"></i> Failed to send</span>}
              </div>
            </div>
            <iframe
              className="comm-view-iframe-inline"
              srcDoc={selected.messageBody}
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          </div>
        )}

      </div>

      {waPreview && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { e.stopPropagation(); setWaPreview(null) }}
        >
          <div
            style={{ background: '#fff', borderRadius: 10, width: 'min(380px, 100%)', boxShadow: '0 12px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ background: '#075e54', color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fab fa-whatsapp" style={{ fontSize: 18 }}></i> {waPreview.mobile || 'WhatsApp'}
              </span>
              <button
                onClick={() => setWaPreview(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#fff', lineHeight: 1 }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div style={{ background: '#e5ddd5', padding: 20, minHeight: 140 }}>
              <div style={{ background: '#dcf8c6', borderRadius: '8px 8px 8px 0', padding: '10px 12px', maxWidth: '90%', boxShadow: '0 1px 1px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: 13.5, color: '#111', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{waPreview.message}</div>
                <div style={{ fontSize: 10.5, color: '#667781', textAlign: 'right', marginTop: 4 }}>
                  {waPreview.crtdDt} <i className="fas fa-check-double" style={{ color: '#53bdeb', marginLeft: 3 }}></i>
                </div>
              </div>
            </div>
            <div style={{ padding: '9px 16px', fontSize: 11, color: '#888', borderTop: '1px solid #eee' }}>
              {waPreview.message.length} / 160 characters &middot; generated from: "{waPreview.subject}"
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
