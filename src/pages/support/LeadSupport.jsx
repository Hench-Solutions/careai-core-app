import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchSupportRecords, submitSupportAction } from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'

// Extensible — add more { value, label } entries here as new support
// activities are needed. Each one must have a matching precondition +
// effect wired up server-side (EstimateDAL.SupportSearchAsync/SubmitAsync).
const ACTIONS = [
  { value: 'REOPEN_APPROVE',  label: 'Re-Approve Estimate' },
  { value: 'REOPEN_GENERATE', label: 'Re-Generate Estimate' },
]

const fieldLabel = { fontSize: 13, fontWeight: 600, color: '#555' }
const fieldValue = { fontSize: 13, color: '#222' }

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={fieldLabel}>{label}</span>
      <span style={fieldValue}>{value || '—'}</span>
    </div>
  )
}

export default function LeadSupport() {
  const navigate = useNavigate()
  const [claimNo,   setClaimNo]   = useState('')
  const [action,    setAction]    = useState('')
  const [searching, setSearching] = useState(false)
  const [searched,  setSearched]  = useState(false)
  const [records,   setRecords]   = useState([])
  const [remarks,   setRemarks]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [modalMsgs, setModalMsgs] = useState([])
  const [successMsg, setSuccessMsg] = useState('')

  async function handleSearch() {
    const errs = []
    if (!claimNo.trim()) errs.push('Claim No. is required.')
    if (!action)         errs.push('Please select an action.')
    if (errs.length) { setModalMsgs(errs); return }

    setSearching(true)
    setSearched(false)
    setRecords([])
    setRemarks('')
    try {
      const rows = await searchSupportRecords(claimNo.trim(), action)
      setRecords(rows)
      setSearched(true)
    } catch (err) {
      setModalMsgs([err?.message || 'This claim is not eligible for the selected action.'])
    } finally {
      setSearching(false)
    }
  }

  async function handleSubmit() {
    if (!remarks.trim()) { setModalMsgs(['Remarks are required.']); return }

    setSaving(true)
    try {
      await submitSupportAction({
        claimNo:  claimNo.trim(),
        memberId: records[0]?.memberId || '',
        action,
        remarks:  remarks.trim()
      })
      setSuccessMsg('Case reopened successfully. The relevant team can now proceed.')
      setRecords([])
      setSearched(false)
      const reopenedClaimNo = claimNo.trim()
      setClaimNo('')
      setAction('')
      setRemarks('')
      setTimeout(() => navigate(`/leads/actions?claimNo=${reopenedClaimNo}`), 1800)
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to submit. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="lsrch-page">
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />
      <ValidationModal messages={successMsg ? [successMsg] : []} onClose={() => setSuccessMsg('')} type="success" />

      <div className="page-header-banner">
        <h2><i className="fas fa-user-shield" style={{ marginRight: 10 }}></i>Lead Support for Team Lead</h2>
      </div>

      <div className="leadform-container" style={{ maxWidth: 900 }}>

        {/* Search bar */}
        <div className="leadform-section leadform-section-active">
          <div className="leadform-section-header">
            <span className="leadform-section-title">Search</span>
          </div>
          <div className="leadform-grid">
            <div className="leadform-field">
              <label className="leadform-field-label">
                Claim No. <span className="leadform-required-star">*</span>
              </label>
              <input
                className="leadform-field-input"
                type="text"
                value={claimNo}
                onChange={e => setClaimNo(e.target.value)}
                placeholder="e.g. CLM262700046"
              />
            </div>
            <div className="leadform-field">
              <label className="leadform-field-label">
                Action <span className="leadform-required-star">*</span>
              </label>
              <select
                className="leadform-field-input"
                value={action}
                onChange={e => setAction(e.target.value)}
              >
                <option value="">-- Select Action --</option>
                {ACTIONS.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="btn-gradient" style={{ fontSize: 13, padding: '8px 24px' }}
              onClick={handleSearch} disabled={searching}>
              {searching
                ? <><i className="fas fa-spinner fa-spin"></i> Searching...</>
                : <><i className="fas fa-search"></i> Search</>}
            </button>
          </div>
        </div>

        {/* Results */}
        {searched && (
          <div className="leadform-section leadform-section-active" style={{ marginTop: 16 }}>
            <div className="leadform-section-header">
              <span className="leadform-section-title">Record{records.length > 1 ? 's' : ''} Found</span>
            </div>

            {records.length === 0 ? (
              <p style={{ padding: '12px 0', color: '#888', fontSize: 13 }}>
                This claim is not eligible for the selected action.
              </p>
            ) : (
              <>
                {records.map(r => (
                  <div key={r.requestNo} style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 24px',
                    padding: '14px 0', borderBottom: '1px solid #f0f0f0'
                  }}>
                    <DetailRow label="Claim No."       value={r.claimNo} />
                    <DetailRow label="Member Name"      value={r.memberName} />
                    <DetailRow label="Current Status"   value={r.currentStatusNm} />

                    <DetailRow label="Accepted Provider" value={r.prvNm} />
                    <DetailRow label="Estimate Amount"  value={r.treatmentCost ? Number(r.treatmentCost).toFixed(2) : ''} />
                    <DetailRow label="Currency"          value={r.currency} />

                    <DetailRow label="Line of Treatment" value={r.lineOfTreatment} />
                    <DetailRow label="Room Type"         value={r.roomTypeNm} />
                    <DetailRow label="No. of Days"       value={r.los} />

                    <DetailRow label="ICD"               value={r.icdCd ? `${r.icdCd} — ${r.icdDesc}` : ''} />
                    <DetailRow label="CPT"                value={r.cptCd ? `${r.cptCd} — ${r.cptDesc}` : ''} />
                    <DetailRow label="DRG"                value={r.drgCd ? `${r.drgCd} — ${r.drgDesc}` : ''} />

                    <DetailRow label="Approved By"       value={r.isApproved ? `${r.appByNm || '—'} (${r.appDt || '—'})` : 'Not approved'} />
                    <DetailRow label="Shared Date"       value={r.isShared ? `${r.estSharedByNm || '—'} (${r.estSharedDt || '—'})` : 'Not shared'} />
                  </div>
                ))}

                <div style={{ marginTop: 16 }}>
                  <label className="leadform-field-label">
                    Remarks (Reason for reopening) <span className="leadform-required-star">*</span>
                  </label>
                  <textarea
                    className="leadform-field-textarea"
                    rows={3}
                    maxLength={500}
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Enter the reason for reopening this case..."
                    style={{ width: '100%', marginTop: 6, boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginTop: 14 }}>
                  <button className="btn-gradient" style={{ fontSize: 13, padding: '8px 24px' }}
                    onClick={handleSubmit} disabled={saving}>
                    {saving
                      ? <><i className="fas fa-spinner fa-spin"></i> Submitting...</>
                      : <><i className="fas fa-save"></i> Submit</>}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
