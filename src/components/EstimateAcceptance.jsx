import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getEstimateAcceptance, submitEstimateAccept } from '../utils/api'
import { authUtils } from '../utils/auth'
import ValidationModal from './ValidationModal'

/**
 * EstimateAcceptance — mirrors estimate_acceptance.aspx / estimate_acceptence.ascx.
 * Public page (no auth) — member opens via email link.
 * Shows IsShared=1 estimates in comparison table, member selects EXACTLY ONE provider.
 * On Accept → status 316, email 115, redirect to /travel-info with token.
 */

const STATUS_ACCEPT = 316

const ATTR_ROWS = [
  { key: 'lineOfTreatment', label: 'Line of Treatment' },
  { key: 'icdCd',           label: 'ICD Code'          },
  { key: 'icdDesc',         label: 'ICD Description'   },
  { key: 'cptCd',           label: 'CPT Code'          },
  { key: 'cptDesc',         label: 'CPT Description'   },
  { key: 'drgCd',           label: 'DRG Code'          },
  { key: 'drgDesc',         label: 'DRG Description'   },
  { key: 'los',             label: 'No. of Days'       },
  { key: 'currency',        label: 'Currency'          },
]

/* ── Confirm modal ────────────────────────────────────────────────────────── */
function ConfirmModal({ message, onOk, onCancel }) {
  return (
    <div className="csm-overlay" onClick={onCancel}>
      <div className="confirm-modal-box" onClick={e => e.stopPropagation()}>
        <div className="confirm-modal-body">
          <i className="fas fa-question-circle confirm-modal-icon"></i>
          <p>{message}</p>
        </div>
        <div className="confirm-modal-footer">
          <button className="confirm-btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="confirm-btn-ok"     onClick={onOk}>OK</button>
        </div>
      </div>
    </div>
  )
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
// Room-Type column model — mirrors EstimateCompare.jsx: a provider can submit
// multiple Room-Type sets, so each row can expand into several data columns.
function buildColumns(rows) {
  const cols = []
  rows.forEach((row, providerIndex) => {
    const exps = row.expenses || []
    const seen = new Set()
    const roomTypesForRow = []
    exps.forEach(e => {
      const rt = e.roomType || ''
      if (!seen.has(rt)) { seen.add(rt); roomTypesForRow.push({ roomType: rt, roomTypeNm: e.roomTypeNm || '(No Room Type)' }) }
    })
    if (roomTypesForRow.length === 0) roomTypesForRow.push({ roomType: '', roomTypeNm: '' })
    roomTypesForRow.forEach(rt => cols.push({ row, providerIndex, roomType: rt.roomType, roomTypeNm: rt.roomTypeNm }))
  })
  return cols
}
function fmtRange(min, max) {
  const a = (parseFloat(min) || 0).toFixed(2)
  const b = (parseFloat(max) || 0).toFixed(2)
  return a === b ? a : `${a} - ${b}`
}
function cellForColumn(col, key) {
  return (col.row.expenses || []).find(e => (e.roomType || '') === col.roomType && `${e.treatmentCd}|${e.expenseCd}` === key)
}
function columnTotal(col) {
  return (col.row.expenses || [])
    .filter(e => (e.roomType || '') === col.roomType)
    .reduce((acc, e) => ({ min: acc.min + (parseFloat(e.minCost) || 0), max: acc.max + (parseFloat(e.maxCost) || 0) }), { min: 0, max: 0 })
}
function buildExpenseRows(rows) {
  const seen = new Set()
  const result = []
  rows.forEach(row => {
    ;(row.expenses || []).forEach(e => {
      const key = `${e.treatmentCd}|${e.expenseCd}`
      if (!seen.has(key)) { seen.add(key); result.push({ key, expenseNm: e.expenseNm || '—' }) }
    })
  })
  return result
}

export default function EstimateAcceptance() {
  const [searchParams] = useSearchParams()
  const navigate    = useNavigate()
  const token       = searchParams.get('token')    || ''
  const claimNo     = searchParams.get('claim_no') || ''
  const isLoggedIn  = authUtils.isLoggedIn()
  const currentUser = isLoggedIn ? authUtils.getUser() : null

  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [pageError,  setPageError]  = useState('')
  const [selected,       setSelected]       = useState('')  // one requestNo
  const [selectedRoomType, setSelectedRoomType] = useState('') // room type within that provider (when it has more than one)
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [modalMsgs,  setModalMsgs]  = useState([])
  const [confirmCfg, setConfirmCfg] = useState(null)

  useEffect(() => {
    if (!token || !claimNo) { setPageError('Invalid or missing link.'); setLoading(false); return }
    getEstimateAcceptance(token, claimNo)
      .then(result => {
        if (!result || !result.isTokenValid) {
          setPageError('This link is invalid. Please contact the case manager.')
        } else if (!isLoggedIn && result.isExpired) {
          setPageError('This link has expired. Please contact the case manager for a new link.')
        } else if (!isLoggedIn && result.isUsed) {
          setPageError('used')
        } else if (result.isEstAccepted) {
          // Already accepted — skip acceptance page, go straight to travel-info
          const travelParams = `token=${encodeURIComponent(token)}&claimNo=${encodeURIComponent(claimNo)}&memberId=${encodeURIComponent(result.memberId || '')}&requestNo=${encodeURIComponent(result.acceptedRequestNo || '')}&prvCd=${encodeURIComponent(result.acceptedPrvCd || '')}`
          if (isLoggedIn) {
            navigate(`/leads/travel-info?${travelParams}`, { replace: true })
          } else {
            window.location.href = `/travel-info?${travelParams}`
          }
        } else if (!result.sharedEstimates || result.sharedEstimates.length === 0) {
          setPageError('No shared estimates found. Please contact the case manager.')
        } else {
          setData(result)
        }
      })
      .catch(() => setPageError('Unable to load estimate details. Please try again later.'))
      .finally(() => setLoading(false))
  }, [token])

  function handleAcceptClick() {
    if (!selected) {
      setModalMsgs(['Please select one estimate to accept.'])
      return
    }
    const columns = buildColumns(data.sharedEstimates || [])
    const providerColumnCount = columns.filter(c => c.row.requestNo === selected).length
    if (providerColumnCount > 1 && !selectedRoomType) {
      setModalMsgs(['Please select a Room Type for the selected provider.'])
      return
    }
    setConfirmCfg({
      message: 'Do you want to proceed with accepting the selected estimate?',
      onOk: doAccept
    })
  }

  async function doAccept() {
    setConfirmCfg(null)
    setSubmitting(true)
    const row = data.sharedEstimates.find(r => r.requestNo === selected)
    try {
      await submitEstimateAccept({
        token,
        claimNo:       claimNo,
        memberId:      data.memberId,
        requestNo:     selected,
        prvCd:         row?.prvCd || '',
        roomType:      selectedRoomType,
        statusCd:      STATUS_ACCEPT,
        statusRemarks: isLoggedIn ? 'Estimate Accepted by Portal Executive' : 'Estimate Accepted by Member',
        updatedBy:     isLoggedIn ? (currentUser?.user_Id        || 0)  : 0,
        updatedByNm:   isLoggedIn ? (currentUser?.user_Full_Name || '') : '',
      })
      setSubmitted(true)
      const travelParams = `token=${encodeURIComponent(token)}&claimNo=${encodeURIComponent(claimNo)}&memberId=${encodeURIComponent(data.memberId || '')}&requestNo=${encodeURIComponent(selected)}&prvCd=${encodeURIComponent(row?.prvCd || '')}`
      setTimeout(() => {
        if (isLoggedIn) {
          navigate(`/leads/travel-info?${travelParams}`, { replace: true })
        } else {
          window.location.href = `/travel-info?${travelParams}`
        }
      }, 800)
    } catch {
      setModalMsgs(['Something went wrong. Please try again.'])
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="message-wrapper">
      <div className="message-container">
        <div className="thank-you-card">
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 40, color: '#632da7' }}></i>
          <p style={{ marginTop: 16, color: '#718096', fontSize: 18 }}>Loading estimate details...</p>
        </div>
      </div>
    </div>
  )

  if (pageError === 'used') return (
    <div className="message-wrapper"><div className="message-container">
      <div className="link-expired-card">
        <div className="link-expired-icon">
          <svg viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
        </div>
        <h1 className="link-expired-title">Link Already Used</h1>
        <p className="link-expired-message">This link has already been used and is no longer valid.</p>
        <p className="link-expired-submessage">Please contact the case manager if you need assistance.</p>
      </div>
    </div></div>
  )

  if (pageError) return (
    <div className="message-wrapper"><div className="message-container">
      <div className="link-expired-card">
        <div className="link-expired-icon">
          <svg viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </div>
        <h1 className="link-expired-title">Invalid Link</h1>
        <p className="link-expired-message">{pageError}</p>
      </div>
    </div></div>
  )

  if (submitted) return (
    <div className="message-wrapper"><div className="message-container">
      <div className="thank-you-card">
        <div className="thank-you-checkmark">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 className="thank-you-heading">Estimate Accepted!</h1>
        <p className="thank-you-text">Redirecting you to submit your travel details...</p>
      </div>
    </div></div>
  )

  const lead           = data?.lead
  const rows           = data?.sharedEstimates || []
  const columns        = buildColumns(rows)
  const expenseRows    = buildExpenseRows(rows)
  const providerSpan   = requestNo => columns.filter(c => c.row.requestNo === requestNo).length
  const fullName       = lead
    ? [lead.firstName, lead.middleName, lead.lastName].filter(Boolean).join(' ')
    : ''

  return (
    <div className="quotation-container">
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />
      {confirmCfg && (
        <ConfirmModal
          message={confirmCfg.message}
          onOk={confirmCfg.onOk}
          onCancel={() => setConfirmCfg(null)}
        />
      )}

      {/* ── Common header ─────────────────────────────────────────────────── */}
      <div className="common-header">
        <div className="common-header-content">
          <div className="common-header-title-wrapper">
            <h2 className="common-header-title">Accept Estimate</h2>
          </div>
        </div>
      </div>

      {/* ── Patient info card ─────────────────────────────────────────────── */}
      {lead && (
        <div className="patient-info-card">
          <h2 className="patient-info-header">
            <i className="fas fa-user-circle"></i> Patient Information
          </h2>
          <div className="patient-details-grid">
            <div className="patient-detail-item">
              <div className="patient-detail-label">Insurer / Entity</div>
              <div className="patient-detail-value">{lead.insurerNm || '—'}</div>
            </div>
            <div className="patient-detail-item">
              <div className="patient-detail-label">Full Name</div>
              <div className="patient-detail-value">{fullName || '—'}</div>
            </div>
            <div className="patient-detail-item">
              <div className="patient-detail-label">Email Address</div>
              <div className="patient-detail-value">{lead.emailId || '—'}</div>
            </div>
            <div className="patient-detail-item">
              <div className="patient-detail-label">DOB</div>
              <div className="patient-detail-value">{lead.dob || '—'}</div>
            </div>
            <div className="patient-detail-item">
              <div className="patient-detail-label">Current Location</div>
              <div className="patient-detail-value">{lead.patientLocationNm || '—'}</div>
            </div>
            <div className="patient-detail-item">
              <div className="patient-detail-label">Treatment Type</div>
              <div className="patient-detail-value">{lead.treatmentTypeNm || '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Instruction ───────────────────────────────────────────────────── */}
      <div className="ea-instruction">
        <i className="fas fa-info-circle"></i>&nbsp;
        Please review the estimates below and select <strong>one provider</strong> to accept.
      </div>

      {/* ── Comparison table ──────────────────────────────────────────────── */}
      <div className="treatment-plan-header">
        <i className="fas fa-balance-scale"></i>&nbsp; Shared Estimate Comparison
      </div>
      <div className="treatment-plan-table-wrapper">
        <table className="treatment-plan-table">
          <thead>
            <tr className="select-row">
              <th className="ec-label-col">Select</th>
              {rows.map((row, ci) => (
                <th key={row.requestNo} colSpan={providerSpan(row.requestNo)} className={`ec-provider-col ec-col-${(ci % 4) + 1}`}>
                  <div className="ec-checkbox-wrap">
                    <input
                      type="radio"
                      name="selectedProvider"
                      value={row.requestNo}
                      checked={selected === row.requestNo}
                      onChange={() => {
                        setSelected(row.requestNo)
                        const rowCols = columns.filter(c => c.row.requestNo === row.requestNo)
                        setSelectedRoomType(rowCols.length === 1 ? rowCols[0].roomType : '')
                      }}
                      style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#632da7' }}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Provider Name */}
            <tr>
              <th className="ec-label-col">Provider Name</th>
              {rows.map((row, ci) => (
                <td key={row.requestNo} colSpan={providerSpan(row.requestNo)} className={`ec-provider-col ec-col-${(ci % 4) + 1} ec-provider-name`}>
                  {row.prvNm || row.prvCd}
                </td>
              ))}
            </tr>

            {/* Attribute rows */}
            {ATTR_ROWS.map(attr => (
              <tr key={attr.key}>
                <th className="ec-label-col">{attr.label}</th>
                {rows.map((row, ci) => (
                  <td key={row.requestNo} colSpan={providerSpan(row.requestNo)} className={`ec-provider-col ec-col-${(ci % 4) + 1}`}>
                    {row[attr.key] || '—'}
                  </td>
                ))}
              </tr>
            ))}

            {/* Room Type sub-header — one actual column per Provider+Room-Type.
                When a provider has more than one Room-Type column, a radio lets
                the member pick which one to accept within that provider. */}
            <tr>
              <th className="ec-label-col">Room Type</th>
              {columns.map(col => {
                const multi = providerSpan(col.row.requestNo) > 1
                return (
                  <th key={`${col.row.requestNo}-${col.roomType}`} className={`ec-provider-col ec-col-${(col.providerIndex % 4) + 1}`} style={{ color: '#e53e3e', textAlign: 'left' }}>
                    {multi && (
                      <input
                        type="radio"
                        name={`roomType-${col.row.requestNo}`}
                        checked={selected === col.row.requestNo && selectedRoomType === col.roomType}
                        onChange={() => { setSelected(col.row.requestNo); setSelectedRoomType(col.roomType) }}
                        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#632da7', marginRight: 6, verticalAlign: 'middle' }}
                      />
                    )}
                    {col.roomTypeNm}
                  </th>
                )
              })}
            </tr>

            {/* Expense Head rows — one cell per Provider+Room-Type column */}
            {expenseRows.map(er => (
              <tr key={er.key}>
                <th className="ec-label-col">{er.expenseNm}</th>
                {columns.map(col => {
                  const cell = cellForColumn(col, er.key)
                  return (
                    <td key={`${col.row.requestNo}-${col.roomType}`} className={`ec-provider-col ec-col-${(col.providerIndex % 4) + 1} ec-amount`} style={{ textAlign: 'left' }}>
                      {cell ? fmtRange(cell.minCost, cell.maxCost) : '—'}
                    </td>
                  )
                })}
              </tr>
            ))}

            {/* Estimate Amount — one cell per Provider+Room-Type column, final row */}
            <tr>
              <th className="ec-label-col">Estimate Amount</th>
              {columns.map(col => {
                const t = columnTotal(col)
                return (
                  <td key={`${col.row.requestNo}-${col.roomType}`} className={`ec-provider-col ec-col-${(col.providerIndex % 4) + 1} ec-amount`} style={{ textAlign: 'left' }}>
                    <strong>{fmtRange(t.min, t.max)}</strong>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Accept button ─────────────────────────────────────────────────── */}
      <div className="generate-estimates-display-button-container">
        <button
          className="MedicaltourismProceedforEstimate__btn MedicaltourismProceedforEstimate__btn--submit"
          onClick={handleAcceptClick}
          disabled={submitting}
        >
          {submitting
            ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Processing…</>
            : <><i className="fas fa-check-circle"></i>&nbsp;Accept Estimate</>
          }
        </button>
      </div>
    </div>
  )
}
