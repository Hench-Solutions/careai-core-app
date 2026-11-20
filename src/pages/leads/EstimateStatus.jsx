import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getLeadByClaimNo, fetchEstimateRequests, submitEstimateAction, fetchEstimateExpenses, submitEstimateRequest, fetchSectionRights } from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'

/**
 * EstimateStatus — mirrors estimate_status.aspx from Med_Tour.
 * Design follows Med_Tour exactly:
 *   common-header | patient-info-card | estimate-display-table | approve button (bottom)
 *
 * Status logic (MT_EstimateRequest.acceptance):
 *   null/0 → REQUESTED      → reminder icon | checkbox disabled
 *   1      → ACCEPTED        → reminder icon | checkbox disabled
 *   3      → ESTIMATE SHARED → view eye icon | checkbox enabled
 *   2      → DECLINED        → no icon       | checkbox disabled
 */

/* ── Status badge class map (mirrors rptEstimate_ItemDataBound) ───────────── */
const STATUS_BADGE = {
  'REQUESTED':       'estimate-display-status-requested',
  'ACCEPTED':        'estimate-display-status-additional',
  'ESTIMATE SHARED': 'estimate-display-status-approved',
  'DECLINED':        'estimate-display-status-declined',
}

function badgeCls(nm) {
  return STATUS_BADGE[(nm || '').toUpperCase()] ?? 'estimate-display-status-requested'
}

/* ── Inline confirm dialog (OK + Cancel) ─────────────────────────────────── */
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

export default function EstimateStatus() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const claimNo        = searchParams.get('claimNo') || ''

  const [lead,        setLead]        = useState(null)
  const [rows,        setRows]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [checked,     setChecked]     = useState([])
  const [viewRow,     setViewRow]     = useState(null)
  const [expenses,    setExpenses]    = useState([])
  const [expLoading,  setExpLoading]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [modalMsgs,   setModalMsgs]   = useState([])
  const [doneMsg,     setDoneMsg]     = useState('')
  const [confirmCfg,  setConfirmCfg]  = useState(null)   // { message, onOk }
  const [canApproveEstimate, setCanApproveEstimate] = useState(true) // fail-open until resolved

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!claimNo) { setLoading(false); return }
    Promise.all([
      getLeadByClaimNo(claimNo).catch(() => null),
      fetchEstimateRequests(claimNo, 'STATUS').catch(() => []),
      fetchSectionRights('ESTIMATE_STATUS_PAGE').catch(() => ({}))
    ]).then(([leadData, estRows, rights]) => {
      setLead(leadData)
      setRows(estRows || [])
      setCanApproveEstimate(rights?.APPROVE_ESTIMATE_BTN !== false)
      setLoading(false)
    })
  }, [claimNo])

  // ── Checkbox ──────────────────────────────────────────────────────────────
  function toggleCheck(requestNo) {
    setChecked(prev =>
      prev.includes(requestNo)
        ? prev.filter(r => r !== requestNo)
        : [...prev, requestNo]
    )
  }

  // ── Approve ───────────────────────────────────────────────────────────────
  function handleApproveClick() {
    if (!canApproveEstimate) {
      setModalMsgs(['You are not authorized to approve estimates.'])
      return
    }
    if (checked.length === 0) {
      setModalMsgs(['Please select at least one estimate to approve.'])
      return
    }
    setConfirmCfg({
      message: 'Do you want to proceed with approving the selected estimates?',
      onOk: doApprove
    })
  }

  async function doApprove() {
    setConfirmCfg(null)
    setSaving(true)
    try {
      await submitEstimateAction({
        mode:          'APPROVE',
        claimNo,
        memberId:      lead?.memberId ?? '',
        requestNos:    checked,
        statusCd:      331,
        statusRemarks: 'Estimate Approved'
      })
      const updated = await fetchEstimateRequests(claimNo, 'STATUS').catch(() => rows)
      setRows(updated)
      setChecked([])
      setDoneMsg('Selected estimates approved successfully.')
      setTimeout(() => navigate(`/leads/estimate-compare?claimNo=${claimNo}`), 2000)
    } catch {
      setModalMsgs(['Approval failed. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  // ── Reminder — inserts new MT_EstimateRequest row + sends email, no status change ──
  function handleReminder(row) {
    setConfirmCfg({
      message: `Send reminder to ${row.prvNm || row.prvCd}?`,
      onOk: () => doReminder(row)
    })
  }

  async function doReminder(row) {
    setConfirmCfg(null)
    setSaving(true)
    try {
      await submitEstimateRequest({
        claimNo,
        memberId:      lead?.memberId ?? '',
        fullName:      lead ? [lead.firstName, lead.middleName, lead.lastName].filter(Boolean).join(' ') : '',
        statusCd:      0,
        statusRemarks: '',
        rows: [{
          country_Cd: row.countryCd || '',
          country_Nm: '',
          city_Cd:    row.cityCd    || '',
          city_Nm:    '',
          hospitals: [{
            prv_Cd:    row.prvCd,
            prv_Nm:    row.prvNm || row.prvCd,
            prv_Email: row.prvEmail || ''
          }]
        }]
      })
      setDoneMsg(`Reminder sent to ${row.prvNm || row.prvCd}.`)
      setTimeout(() => setDoneMsg(''), 4000)
    } catch {
      setModalMsgs(['Failed to send reminder. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  // ── View estimate modal ───────────────────────────────────────────────────
  function ViewEstimateModal({ row, onClose }) {
    const fields = [
      { label: 'Provider',          value: row.prvNm || row.prvCd },
      { label: 'Line of Treatment', value: row.lineOfTreatment },
      { label: 'ICD Code',          value: row.icdCd },
      { label: 'ICD Description',   value: row.icdDesc },
      { label: 'CPT Code',          value: row.cptCd },
      { label: 'CPT Description',   value: row.cptDesc },
      { label: 'DRG Code',          value: row.drgCd },
      { label: 'DRG Description',   value: row.drgDesc },
      { label: 'No. of Days',       value: row.los != null ? String(row.los) : '' },
      { label: 'Currency',          value: row.currency },
    ]
    const hasData = fields.some(f => f.value)

    // Cross-tab: Room Type as columns, Expense Head as rows — mirrors the
    // Estimate Compare layout. roomType is per-line now (a provider can offer
    // several room-type options), so it's no longer a single top-level field.
    const roomTypes = []
    const seenRoomTypes = new Set()
    expenses.forEach(e => {
      const key = e.roomType || ''
      if (!seenRoomTypes.has(key)) { seenRoomTypes.add(key); roomTypes.push({ roomType: key, roomTypeNm: e.roomTypeNm || '(No Room Type)' }) }
    })

    const expenseRows = []
    const seenExpense = new Set()
    expenses.forEach(e => {
      const key = `${e.treatmentCd}|${e.expenseCd}`
      if (!seenExpense.has(key)) { seenExpense.add(key); expenseRows.push({ key, expenseNm: e.expenseNm || '—' }) }
    })

    function cellFor(roomType, key) {
      return expenses.find(e => (e.roomType || '') === roomType && `${e.treatmentCd}|${e.expenseCd}` === key)
    }

    function fmtRange(min, max) {
      const a = (parseFloat(min) || 0).toFixed(2)
      const b = (parseFloat(max) || 0).toFixed(2)
      return a === b ? a : `${a} - ${b}`
    }

    function totalsFor(roomType) {
      return expenses
        .filter(e => (e.roomType || '') === roomType)
        .reduce((acc, e) => ({ min: acc.min + (parseFloat(e.minCost) || 0), max: acc.max + (parseFloat(e.maxCost) || 0) }), { min: 0, max: 0 })
    }

    return (
      <div className="csm-overlay" onClick={onClose}>
        <div className="csm-box es-view-modal" onClick={e => e.stopPropagation()}>
          <div className="csm-header">
            <span><i className="fas fa-file-medical"></i>&nbsp; View Estimate — {row.prvNm || row.prvCd}</span>
            <button className="csm-close" onClick={onClose}><i className="fas fa-times"></i></button>
          </div>
          <div className="es-view-body">
            {hasData ? (
              <table className="es-view-table">
                <tbody>
                  {fields.map(f => f.value
                    ? <tr key={f.label}><th>{f.label}</th><td>{f.value}</td></tr>
                    : null
                  )}
                </tbody>
              </table>
            ) : (
              <p className="csm-hint">No estimate details submitted yet.</p>
            )}

            {/* ── Cost Breakdown ── */}
            <div className="es-expense-section">
              <h4 className="es-expense-heading">
                <i className="fas fa-list-alt"></i>&nbsp; Cost Breakdown
              </h4>
              {expLoading ? (
                <p className="csm-hint"><i className="fas fa-spinner fa-spin"></i> Loading…</p>
              ) : expenses.length === 0 ? (
                <p className="csm-hint">No expense data available.</p>
              ) : (
                <table className="es-expense-table">
                  <thead>
                    <tr>
                      <th></th>
                      {roomTypes.map(rt => <th key={rt.roomType} style={{ textAlign: 'left' }}>{rt.roomTypeNm}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {expenseRows.map(er => (
                      <tr key={er.key}>
                        <th style={{ textAlign: 'left' }}>{er.expenseNm}</th>
                        {roomTypes.map(rt => {
                          const cell = cellFor(rt.roomType, er.key)
                          return (
                            <td key={rt.roomType} className="es-expense-cost" style={{ textAlign: 'left' }}>
                              {cell ? fmtRange(cell.minCost, cell.maxCost) : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="es-expense-total-row">
                      <th style={{ textAlign: 'left' }}>Total</th>
                      {roomTypes.map(rt => {
                        const t = totalsFor(rt.roomType)
                        return (
                          <td key={rt.roomType} className="es-expense-cost" style={{ textAlign: 'left' }}>
                            <strong>{fmtRange(t.min, t.max)}</strong>
                          </td>
                        )
                      })}
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Disable approve button if no ESTIMATE SHARED rows remain unapproved
  const allApproved = rows.length > 0 &&
    rows.filter(r => (r.statusNm || '').toUpperCase() === 'ESTIMATE SHARED')
        .every(r => r.isApproved === 1)

  // ── Approve button (reused at top and bottom) ────────────────────────────
  function ApproveBtn({ style }) {
    return (
      <button
        className="MedicaltourismProceedforEstimate__btn MedicaltourismProceedforEstimate__btn--submit"
        onClick={handleApproveClick}
        disabled={saving || allApproved}
        style={style}
      >
        {saving
          ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Approving…</>
          : <><i className="fas fa-check-circle"></i>&nbsp;Approve Estimate</>
        }
      </button>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="la-loading">
        <i className="fas fa-spinner fa-spin"></i> Loading estimate status…
      </div>
    )
  }

  if (!claimNo) {
    return <p className="csm-hint" style={{ padding: 24 }}>No claim number provided.</p>
  }

  const fullName = lead
    ? [lead.firstName, lead.middleName, lead.lastName].filter(Boolean).join(' ')
    : ''

  return (
    <div className="quotation-container">
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />
      {viewRow    && <ViewEstimateModal row={viewRow} onClose={() => setViewRow(null)} />}
      {confirmCfg && (
        <ConfirmModal
          message={confirmCfg.message}
          onOk={confirmCfg.onOk}
          onCancel={() => setConfirmCfg(null)}
        />
      )}

      {/* ── Common header (gradient, mirrors Med_Tour) ──────────────────── */}
      <div className="common-header">
        <div className="common-header-content">
          <div className="common-header-title-wrapper">
            <h2 className="common-header-title">Estimate Requested Status</h2>
          </div>
        </div>
      </div>

      {/* ── Patient info card ───────────────────────────────────────────── */}
      {lead && (
        <div className="patient-info-card">
          <h2 className="patient-info-header">
            <i className="fas fa-user-circle"></i>
            Patient Information
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

      {/* ── Success toast ───────────────────────────────────────────────── */}
      {doneMsg && (
        <div className="la-success" style={{ marginBottom: 16 }}>
          <i className="fas fa-check-circle"></i> {doneMsg}
        </div>
      )}

      {/* ── Estimate request table ──────────────────────────────────────── */}
      <div className="estimate-display-container">
        <div className="estimate-display-table-wrapper">
          <table className="estimate-display-table">
            <thead>
              <tr>
                <th>Sl.No</th>
                <th>Hospital</th>
                <th>Status</th>
                <th>View</th>
                <th>Select</th>
                <th style={{ textAlign: 'center' }}>Action</th>
                <th style={{ textAlign: 'center' }}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                    No estimate requests found for this claim.
                  </td>
                </tr>
              ) : rows.map((row, i) => {
                const statusUp   = (row.statusNm || '').toUpperCase()
                const canApprove = statusUp === 'ESTIMATE SHARED'
                const showView   = statusUp === 'ESTIMATE SHARED'
                const showRemind = statusUp === 'REQUESTED' || statusUp === 'ACCEPTED'
                const isChecked  = checked.includes(row.requestNo)
                const actionEnabled = statusUp === 'REQUESTED' || statusUp === 'ACCEPTED'

                return (
                  <tr key={row.requestNo}>
                    <td data-label="Sl.No">
                      <span className="estimate-display-slno">{i + 1}</span>
                    </td>
                    <td data-label="Hospital">
                      <span className="estimate-display-hospital-name">
                        {row.prvNm || row.prvCd}
                      </span>
                      {row.isApproved === 1 && (
                        <span className="es-approved-tag">
                          <i className="fas fa-check"></i> Approved
                        </span>
                      )}
                    </td>
                    <td data-label="Status">
                      <span className={`estimate-display-status-badge ${badgeCls(row.statusNm)}`}>
                        {row.statusNm}
                      </span>
                      {row.declineReason && (
                        <div className="es-decline-reason">{row.declineReason}</div>
                      )}
                    </td>
                    <td data-label="View">
                      {showView && (
                        <button
                          className="es-plain-icon-btn"
                          title="View Estimate"
                          onClick={() => {
                            setViewRow(row)
                            setExpenses([])
                            setExpLoading(true)
                            fetchEstimateExpenses(row.requestNo)
                              .then(data => setExpenses(data || []))
                              .catch(() => setExpenses([]))
                              .finally(() => setExpLoading(false))
                          }}
                        >
                          <i className="fas fa-eye view-estimate-icon"></i>
                        </button>
                      )}
                      {row.acceptance === 2 && (
                        <button
                          className="es-plain-icon-btn"
                          title="View Decline Reason"
                          onClick={() => setModalMsgs([row.declineReason || 'No decline reason provided.'])}
                        >
                          <i className="fas fa-eye decline-reason-icon"></i>
                        </button>
                      )}
                      {showRemind && (
                        <button
                          className="es-plain-icon-btn"
                          title="Send Reminder"
                          onClick={() => handleReminder(row)}
                        >
                          <i className="fas fa-paper-plane" style={{ color: '#e67e22', fontSize: 18, cursor: 'pointer' }}></i>
                        </button>
                      )}
                    </td>
                    <td data-label="Select">
                      <div className="generate-estimates-display-checkbox-container">
                        <input
                          type="checkbox"
                          className="generate-estimates-display-checkbox"
                          disabled={!canApprove}
                          checked={isChecked}
                          onChange={() => toggleCheck(row.requestNo)}
                        />
                      </div>
                    </td>
                    <td data-label="Action" style={{ textAlign: 'center' }}>
                      <button
                        className="es-plain-icon-btn"
                        title={actionEnabled ? 'Fill Estimate' : 'Action not available'}
                        disabled={!actionEnabled}
                        style={{ opacity: actionEnabled ? 1 : 0.35, cursor: actionEnabled ? 'pointer' : 'not-allowed' }}
                        onClick={() => actionEnabled && navigate(`/leads/estimate-req?token=${row.requestNo}`)}
                      >
                        <i className="fas fa-edit" style={{ color: actionEnabled ? '#632da7' : '#999', fontSize: 18 }}></i>
                      </button>
                    </td>
                    <td data-label="Edit" style={{ textAlign: 'center' }}>
                      {statusUp === 'ESTIMATE SHARED' && (
                        <button
                          className="es-plain-icon-btn"
                          title="Edit Estimate"
                          onClick={() => navigate(`/leads/estimate-cu?token=${row.requestNo}&edit=true`)}
                        >
                          <i className="fas fa-pen" style={{ color: '#1a7f5a', fontSize: 17 }}></i>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Approve button — bottom (mirrors Med_Tour) ──────────────────── */}
      <div className="generate-estimates-display-button-container">
        <ApproveBtn />
      </div>
    </div>
  )
}
