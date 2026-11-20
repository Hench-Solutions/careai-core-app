import { useState, useEffect } from 'react'
import { fetchCaseNotes, saveCaseNote, fetchCaseStatuses, fetchNotClosedSub1, fetchNotClosedSub2 } from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'

export default function CaseNotesModal({ claimNo, memberId, currentStatusCd, onClose, onStatusChanged }) {
  const [notes,       setNotes]       = useState([])
  const [statuses,    setStatuses]    = useState([])
  const [statusErr,   setStatusErr]   = useState('')
  const [loading,     setLoading]     = useState(true)
  const [fetchErr,    setFetchErr]    = useState('')
  const [saving,      setSaving]      = useState(false)
  const [noteType,    setNoteType]    = useState('comments')   // 'comments' | 'with_status'
  const [statusCd,    setStatusCd]    = useState(currentStatusCd ? String(currentStatusCd) : '')
  const [followupDt,  setFollowupDt]  = useState('')
  const [remarks,     setRemarks]     = useState('')
  const [modalMsgs,   setModalMsgs]   = useState([])

  // "Not Closed" reason cascade — shown only when the selected status is "Not Closed"
  const [sub1Options, setSub1Options] = useState([])
  const [sub2Options, setSub2Options] = useState([])
  const [sub1Cd,      setSub1Cd]      = useState('')
  const [reasonCd,    setReasonCd]    = useState('')

  const selectedStatusNm = statuses.find(s => String(s.value) === String(statusCd))?.text || ''
  const isNotClosed = noteType === 'with_status' && selectedStatusNm.trim().toLowerCase() === 'not closed'

  async function loadNotes() {
    setLoading(true)
    setFetchErr('')
    try {
      const n = await fetchCaseNotes(claimNo)
      setNotes(n)
    } catch (err) {
      setFetchErr(err?.message || 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCaseStatuses()
      .then(s => setStatuses((s || []).filter(st => st.manualUpdate === 'Y')))
      .catch(err => setStatusErr(err?.message || 'Failed to load statuses'))
    loadNotes()
  }, [claimNo])

  // Load Sub Category 1 options once, lazily, the first time "Not Closed" becomes relevant
  useEffect(() => {
    if (isNotClosed && sub1Options.length === 0) {
      fetchNotClosedSub1().then(setSub1Options).catch(() => setSub1Options([]))
    }
  }, [isNotClosed, sub1Options.length])

  // Reset the reason cascade whenever status/note-type changes away from "Not Closed"
  useEffect(() => {
    if (!isNotClosed) {
      setSub1Cd('')
      setReasonCd('')
      setSub2Options([])
    }
  }, [isNotClosed])

  function handleSub1Change(val) {
    setSub1Cd(val)
    setReasonCd('')
    setSub2Options([])
    if (val) fetchNotClosedSub2(val).then(setSub2Options).catch(() => setSub2Options([]))
  }

  async function handleSend() {
    const errors = []
    if (!remarks.trim()) errors.push('Remarks are required.')
    if (!statusCd) errors.push('Status could not be determined. Please refresh and try again.')
    if (isNotClosed && !sub1Cd) errors.push('Sub Category 1 is required for a "Not Closed" status.')
    if (isNotClosed && !reasonCd) errors.push('Sub Category 2 is required for a "Not Closed" status.')
    if (errors.length > 0) { setModalMsgs(errors); return }

    setSaving(true)
    try {
      await saveCaseNote({
        claimNo,
        memberId,
        statusCd:       Number(statusCd),
        followupDt:     followupDt || null,
        remarks:        remarks.trim(),
        isStatusUpdate: noteType === 'with_status',
        reasonCd:       isNotClosed ? Number(reasonCd) : null
      })
      setRemarks('')
      setFollowupDt('')
      setSub1Cd('')
      setReasonCd('')
      await loadNotes()
      if (noteType === 'with_status' && onStatusChanged) onStatusChanged()
    } catch {
      setModalMsgs(['Failed to save note. Please try again.'])
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
          <span><i className="fas fa-sticky-note"></i>&nbsp; Case Notes — {claimNo}</span>
          <button className="csm-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>

        {/* Input area */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #eee' }}>

          {/* Radio toggle */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="radio"
                name="noteType"
                value="comments"
                checked={noteType === 'comments'}
                onChange={() => setNoteType('comments')}
              />
              Comments Only
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="radio"
                name="noteType"
                value="with_status"
                checked={noteType === 'with_status'}
                onChange={() => setNoteType('with_status')}
              />
              Comments with Status
            </label>
          </div>

          {/* Status dropdown — always visible; disabled in "Comments Only" mode */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>
              Status {statusErr && <span style={{ color: '#c0392b', fontSize: 11 }}>— {statusErr}</span>}
            </label>
            <select
              className="leadform-field-input"
              style={{ fontSize: 13, background: noteType === 'comments' ? '#f5f5f5' : '' }}
              value={statusCd}
              disabled={noteType === 'comments'}
              onChange={e => setStatusCd(e.target.value)}
            >
              <option value="">-- Select Status --</option>
              {statuses.map(s => (
                <option key={s.value} value={s.value}>{s.text}</option>
              ))}
            </select>
          </div>

          {/* "Not Closed" reason cascade — only shown when that status is selected */}
          {isNotClosed && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>
                  Sub Category 1 <span style={{ color: '#c0392b' }}>*</span>
                </label>
                <select
                  className="leadform-field-input"
                  style={{ fontSize: 13 }}
                  value={sub1Cd}
                  onChange={e => handleSub1Change(e.target.value)}
                >
                  {sub1Options.map(o => (
                    <option key={o.value} value={o.value}>{o.text}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>
                  Sub Category 2 <span style={{ color: '#c0392b' }}>*</span>
                </label>
                <select
                  className="leadform-field-input"
                  style={{ fontSize: 13, background: sub1Cd ? '' : '#f5f5f5' }}
                  value={reasonCd}
                  disabled={!sub1Cd}
                  onChange={e => setReasonCd(e.target.value)}
                >
                  {sub2Options.map(o => (
                    <option key={o.value} value={o.value}>{o.text}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Follow-up date */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>
              Follow-up Date
            </label>
            <input
              type="date"
              className="leadform-field-input"
              style={{ fontSize: 13 }}
              value={followupDt}
              onChange={e => setFollowupDt(e.target.value)}
            />
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
                ? <><i className="fas fa-spinner fa-spin"></i> Updating...</>
                : <><i className="fas fa-paper-plane"></i> Update</>}
            </button>
          </div>
        </div>

        {/* Notes history */}
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: '10px 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#888' }}>
              <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Loading...
            </div>
          ) : fetchErr ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#c0392b', fontSize: 13 }}>
              <i className="fas fa-exclamation-circle" style={{ marginRight: 6 }}></i>
              {fetchErr}
              <button
                onClick={loadNotes}
                style={{ display: 'block', margin: '10px auto 0', fontSize: 12, color: '#667eea', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >Retry</button>
            </div>
          ) : notes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#aaa', fontSize: 13 }}>
              No case notes yet.
            </div>
          ) : notes.map(n => (
            <div key={n.id} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#2e1d55' }}>
                  <i className="fas fa-user" style={{ marginRight: 5, color: '#667eea' }}></i>
                  {n.userName || 'System'}
                  {n.statusNm && (
                    <span style={{ marginLeft: 8, fontWeight: 400, color: '#667eea', fontSize: 12 }}>
                      | {n.statusNm}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 11, color: '#999' }}>
                  <i className="fas fa-clock" style={{ marginRight: 3 }}></i>{n.crtdDt}
                </span>
              </div>
              {n.followupDt && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
                  <i className="fas fa-calendar-alt" style={{ marginRight: 4, color: '#38ef7d' }}></i>
                  Follow-up: <strong>{n.followupDt}</strong>
                </div>
              )}
              {n.reasonSub2Nm && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
                  <i className="fas fa-list-ul" style={{ marginRight: 4, color: '#c0392b' }}></i>
                  Reason: <strong>{n.reasonSub1Nm}</strong> — {n.reasonSub2Nm}
                </div>
              )}
              <div style={{ fontSize: 13, color: '#444', marginTop: 5, paddingLeft: 4 }}>
                {n.remarks}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
