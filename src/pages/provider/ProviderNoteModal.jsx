import { useState, useEffect } from 'react'
import { getProviderStatusLog, updateProviderStatus, fetchDropdown } from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'

export default function ProviderNoteModal({ prvCd, currentStatusCd, onClose, onSaved }) {
  const [log,           setLog]           = useState([])
  const [statusOptions, setStatusOptions] = useState([])
  const [noteType,      setNoteType]      = useState('comments')   // 'comments' | 'with_status'
  const [statusCd,      setStatusCd]      = useState(currentStatusCd && Number(currentStatusCd) !== 0 ? String(currentStatusCd) : '')
  const [remarks,       setRemarks]       = useState('')
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [modalMsgs,     setModalMsgs]     = useState([])

  async function loadLog() {
    setLoading(true)
    try {
      const rows = await getProviderStatusLog(prvCd)
      setLog(rows || [])
    } catch {
      setLog([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDropdown('ddlproviderstatus')
      .then(opts => setStatusOptions(opts.filter(o => o.value !== '')))
      .catch(() => {})
    loadLog()
  }, [prvCd])  // eslint-disable-line react-hooks/exhaustive-deps

  function switchNoteType(type) {
    setNoteType(type)
    if (type === 'comments') {
      // Always use the most recent logged status — never the stale prop
      const latestCd = log.length > 0 && Number(log[0].statusCd) !== 0
        ? String(log[0].statusCd)
        : (currentStatusCd && Number(currentStatusCd) !== 0 ? String(currentStatusCd) : '')
      setStatusCd(latestCd)
    }
  }

  async function handleSend() {
    if (!remarks.trim())             { setModalMsgs(['Remarks are required.']); return }
    if (!statusCd || statusCd === '0') { setModalMsgs(['Please select a valid status.']); return }
    setSaving(true)
    try {
      await updateProviderStatus(prvCd, Number(statusCd), remarks.trim())
      setRemarks('')
      if (onSaved) onSaved()
      await loadLog()
      // After log refreshes, keep statusCd in sync with what was just saved
      setStatusCd(String(statusCd))
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to save note. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="csm-overlay" onClick={onClose}>
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />

      <div className="csm-box" style={{ maxWidth: 640, width: '95%' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="csm-header">
          <span><i className="fas fa-sticky-note"></i>&nbsp; Provider Notes — {prvCd}</span>
          <button className="csm-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>

        {/* Input area */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #eee' }}>

          {/* Radio toggle */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="radio" name={`pnType-${prvCd}`} value="comments"
                checked={noteType === 'comments'}
                onChange={() => switchNoteType('comments')} />
              Comments Only
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="radio" name={`pnType-${prvCd}`} value="with_status"
                checked={noteType === 'with_status'}
                onChange={() => switchNoteType('with_status')} />
              Comments with Status
            </label>
          </div>

          {/* Status dropdown — always visible; disabled in "Comments Only" mode */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Status</label>
            <select
              className="leadform-field-input"
              style={{ fontSize: 13, background: noteType === 'comments' ? '#f5f5f5' : '' }}
              value={statusCd}
              disabled={noteType === 'comments'}
              onChange={e => setStatusCd(e.target.value)}
            >
              <option value="">-- Select Status --</option>
              {statusOptions.map(o => (
                <option key={o.value} value={o.value}>{o.text}</option>
              ))}
            </select>
          </div>

          {/* Remarks + Send */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              className="leadform-field-textarea"
              rows={3}
              placeholder="Write case remarks..."
              style={{ flex: 1, fontSize: 13, resize: 'vertical' }}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
            <button
              className="btn-gradient"
              style={{ padding: '8px 20px', fontSize: 13, whiteSpace: 'nowrap' }}
              onClick={handleSend}
              disabled={saving}
            >
              {saving
                ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Updating…</>
                : <><i className="fas fa-sync-alt"></i>&nbsp;Update</>}
            </button>
          </div>
        </div>

        {/* Log history */}
        <div style={{ maxHeight: 300, overflowY: 'auto', padding: '10px 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#888' }}>
              <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Loading...
            </div>
          ) : log.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#aaa', fontSize: 13 }}>
              No notes yet.
            </div>
          ) : log.map((row, i) => (
            <div key={i} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#2e1d55' }}>
                  <i className="fas fa-user" style={{ marginRight: 5, color: '#667eea' }}></i>
                  {row.crtdUsr || 'System'}
                  {row.statusNm && (
                    <span style={{ marginLeft: 8, fontWeight: 400, color: '#667eea', fontSize: 12 }}>
                      | {row.statusNm}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 11, color: '#999' }}>
                  <i className="fas fa-clock" style={{ marginRight: 3 }}></i>{row.crtdDt}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#444', marginTop: 5, paddingLeft: 4 }}>
                {row.statusRemark || '—'}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
