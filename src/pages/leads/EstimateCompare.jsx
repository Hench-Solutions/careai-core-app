import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  getLeadByClaimNo,
  fetchEstimateRequests,
  fetchEstimateExpenses,
  submitEstimateAction,
  fetchSectionRights,
  updateEstimateCodes,
  fetchTreatmentPlanPdf
} from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'
import CodeSearchModal from '../../components/CodeSearchModal'

/**
 * EstimateCompare — mirrors estimate_compare.aspx from Med_Tour.
 * Shows all approved provider estimates side-by-side in dynamic columns.
 * User selects ≥1 provider then clicks Generate Estimate → email to member.
 */

/* ── Inline confirm dialog (reused from EstimateStatus pattern) ────────────── */
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

/* ── Attribute rows (fixed, mirrors Med_Tour column order) ─────────────────── */
const ATTR_ROWS = [
  { key: 'lineOfTreatment', label: 'Line of Treatment' },
  { key: 'icdCd',           label: 'ICD Code',          editType: 'ICD' },
  { key: 'icdDesc',         label: 'ICD Description',   descOfType: 'ICD' },
  { key: 'cptCd',           label: 'CPT Code',          editType: 'CPT' },
  { key: 'cptDesc',         label: 'CPT Description',   descOfType: 'CPT' },
  { key: 'drgCd',           label: 'DRG Code',          editType: 'DRG' },
  { key: 'drgDesc',         label: 'DRG Description',   descOfType: 'DRG' },
  { key: 'los',             label: 'No. of Days'       },
  { key: 'currency',        label: 'Currency'          },
]

// Which form field each editable code type feeds — used to update both the
// code and its description in local state after a CodeSearchModal selection.
const CODE_FIELD_KEYS = {
  ICD: { cd: 'icdCd', desc: 'icdDesc' },
  CPT: { cd: 'cptCd', desc: 'cptDesc' },
  DRG: { cd: 'drgCd', desc: 'drgDesc' },
}

export default function EstimateCompare() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const claimNo        = searchParams.get('claimNo') || ''

  const [lead,       setLead]       = useState(null)
  const [rows,       setRows]       = useState([])        // approved EstimateRequestRow[]
  const [expenseMap, setExpenseMap] = useState({})        // { requestNo: EstimateExpenseItem[] }
  const [loading,    setLoading]    = useState(true)
  const [checked,    setChecked]    = useState([])
  const [saving,     setSaving]     = useState(false)
  const [modalMsgs,  setModalMsgs]  = useState([])
  const [confirmCfg, setConfirmCfg] = useState(null)
  const [doneMsg,    setDoneMsg]    = useState('')
  const [canGenerateEstimate, setCanGenerateEstimate] = useState(true) // fail-open until resolved

  // ICD/CPT/DRG are mandatory for now (validated in handleGenerateClick; may be
  // relaxed later) — this lets the team add/correct any one of them individually
  // for a specific provider right from the comparison screen before sharing,
  // without reopening the full estimate form.
  const [codeEditTarget, setCodeEditTarget] = useState(null) // { requestNo, type }
  const [codeSaving,     setCodeSaving]     = useState(false)
  // Selecting a code from the popup only stages it here — nothing is saved
  // until the user explicitly clicks the check/save button on that row, so
  // there's a clear moment to review or cancel before it commits.
  const [pendingCode, setPendingCode] = useState(null) // { requestNo, type, cd, nm }

  function handleCodeSelect(cd, nm) {
    const { requestNo, type } = codeEditTarget
    setPendingCode({ requestNo, type, cd, nm })
    setCodeEditTarget(null)
  }

  function cancelPendingCode() {
    setPendingCode(null)
  }

  function handleConfirmPendingCodeClick() {
    const { type, cd } = pendingCode
    setConfirmCfg({
      message: `Save ${type} code "${cd}" for this provider?`,
      onOk: doSavePendingCode
    })
  }

  async function doSavePendingCode() {
    setConfirmCfg(null)
    const { requestNo, type, cd, nm } = pendingCode
    const { cd: cdKey, desc: descKey } = CODE_FIELD_KEYS[type]

    setCodeSaving(true)
    try {
      await updateEstimateCodes({
        requestNo,
        mode: type,
        icdCode: type === 'ICD' ? cd : '', icdDesc: type === 'ICD' ? nm : '',
        cptCode: type === 'CPT' ? cd : '', cptDesc: type === 'CPT' ? nm : '',
        drgCode: type === 'DRG' ? cd : '', drgDesc: type === 'DRG' ? nm : '',
      })
      setRows(prev => prev.map(r =>
        r.requestNo === requestNo ? { ...r, [cdKey]: cd, [descKey]: nm } : r
      ))
      setPendingCode(null)
    } catch (err) {
      setModalMsgs([err?.message || `Failed to save ${type} code. Please try again.`])
    } finally {
      setCodeSaving(false)
    }
  }

  // ── Load lead + approved estimates + expenses ────────────────────────────
  useEffect(() => {
    if (!claimNo) { setLoading(false); return }
    Promise.all([
      getLeadByClaimNo(claimNo).catch(() => null),
      fetchEstimateRequests(claimNo, 'APPROVED').catch(() => []),
      fetchSectionRights('ESTIMATE_COMPARE_PAGE').catch(() => ({}))
    ]).then(async ([leadData, estRows, rights]) => {
      setLead(leadData)
      setTreatmentRemarks(leadData?.estRem || '')
      setCanGenerateEstimate(rights?.GENERATE_ESTIMATE_BTN !== false)
      const approvedRows = estRows || []
      setRows(approvedRows)

      // Fetch expense lines for all approved providers in parallel
      const expEntries = await Promise.all(
        approvedRows.map(r =>
          fetchEstimateExpenses(r.requestNo)
            .then(exps => [r.requestNo, exps || []])
            .catch(() => [r.requestNo, []])
        )
      )
      setExpenseMap(Object.fromEntries(expEntries))
      setLoading(false)
    })
  }, [claimNo])

  // ── Columns model: Provider → Room Type ───────────────────────────────────
  // A provider can now submit multiple Room-Type sets — so the table has two
  // header levels: Provider (spanning its Room-Type sub-columns, same as
  // before for Select/Provider Name/ICD-CPT-DRG/etc.) and Room Type (one
  // actual data column each), matching the "View Estimate" modal's layout
  // but repeated horizontally per provider instead of shown one at a time.
  function buildColumns() {
    const cols = []
    rows.forEach((row, providerIndex) => {
      const exps = expenseMap[row.requestNo] || []
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

  function providerSpan(requestNo) {
    return columns.filter(c => c.row.requestNo === requestNo).length
  }

  function buildExpenseRows() {
    const seen = new Set()
    const result = []
    rows.forEach(row => {
      ;(expenseMap[row.requestNo] || []).forEach(e => {
        const key = `${e.treatmentCd}|${e.expenseCd}`
        if (!seen.has(key)) { seen.add(key); result.push({ key, expenseNm: e.expenseNm || '—' }) }
      })
    })
    return result
  }

  function cellForColumn(col, key) {
    return (expenseMap[col.row.requestNo] || []).find(e => (e.roomType || '') === col.roomType && `${e.treatmentCd}|${e.expenseCd}` === key)
  }

  function fmtRange(min, max) {
    const a = (parseFloat(min) || 0).toFixed(2)
    const b = (parseFloat(max) || 0).toFixed(2)
    return a === b ? a : `${a} - ${b}`
  }

  // Set Total for one Provider+Room-Type column
  function columnTotal(col) {
    return (expenseMap[col.row.requestNo] || [])
      .filter(e => (e.roomType || '') === col.roomType)
      .reduce((acc, e) => ({ min: acc.min + (parseFloat(e.minCost) || 0), max: acc.max + (parseFloat(e.maxCost) || 0) }), { min: 0, max: 0 })
  }

  // ── Checkbox ─────────────────────────────────────────────────────────────
  function toggleCheck(requestNo) {
    setChecked(prev =>
      prev.includes(requestNo)
        ? prev.filter(r => r !== requestNo)
        : [...prev, requestNo]
    )
  }

  // ── Generate Estimate ────────────────────────────────────────────────────
  function handleGenerateClick() {
    if (!canGenerateEstimate) {
      setModalMsgs(['You are not authorized to generate estimates.'])
      return
    }
    if (checked.length === 0) {
      setModalMsgs(['Please select at least one provider to generate the estimate.'])
      return
    }
    // ICD/CPT/DRG are mandatory for now (may be relaxed later) — block Generate
    // Estimate until every selected provider has all three codes filled in.
    const missing = []
    checked.forEach(requestNo => {
      const row = rows.find(r => r.requestNo === requestNo)
      if (!row) return
      const gaps = []
      if (!row.icdCd) gaps.push('ICD')
      if (!row.cptCd) gaps.push('CPT')
      if (!row.drgCd) gaps.push('DRG')
      if (gaps.length) missing.push(`${row.prvNm || row.prvCd || requestNo}: ${gaps.join(', ')} code missing`)
    })
    if (missing.length) {
      setModalMsgs(['Please provide ICD, CPT and DRG codes before generating the estimate.', ...missing])
      return
    }
    setConfirmCfg({
      message: 'Do you want to proceed with generating and sharing the estimate with the client?',
      onOk: doGenerate
    })
  }

  async function doGenerate() {
    setConfirmCfg(null)
    setSaving(true)
    try {
      await submitEstimateAction({
        mode:          'SHARE',
        claimNo,
        memberId:      lead?.memberId ?? '',
        requestNos:    checked,
        statusCd:      311,
        statusRemarks: 'Estimate Submitted to Client',
        remarks:       treatmentRemarks
      })
      setDoneMsg('success')
      setTimeout(() => navigate('/leads/search'), 3000)
    } catch {
      setModalMsgs(['Failed to generate estimate. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  // ── Download Treatment Plan PDF — approved+shared providers only, download-only
  // (no email sent, no status change). Available once the estimate has been
  // generated/shared at least once for this claim.
  const [treatmentRemarks, setTreatmentRemarks] = useState('')
  const [downloadingPdf,   setDownloadingPdf]   = useState(false)

  async function handleDownloadTreatmentPlan() {
    setDownloadingPdf(true)
    try {
      const base64 = await fetchTreatmentPlanPdf({
        claimNo,
        memberId: lead?.memberId ?? '',
        remarks:  treatmentRemarks
      })
      const byteChars = atob(base64)
      const byteNumbers = new Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `TreatmentPlan_${claimNo}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to download the treatment plan. Please try again.'])
    } finally {
      setDownloadingPdf(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="la-loading">
      <i className="fas fa-spinner fa-spin"></i> Loading estimate comparison…
    </div>
  )

  if (!claimNo) return (
    <p className="csm-hint" style={{ padding: 24 }}>No claim number provided.</p>
  )

  // ── Themed success screen ─────────────────────────────────────────────────
  if (doneMsg === 'success') return (
    <div className="message-wrapper">
      <div className="message-container">
        <div className="thank-you-card">
          <div className="thank-you-checkmark">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h1 className="thank-you-heading">SUCCESS!</h1>
          <p className="thank-you-text">Estimate shared with the client successfully.</p>
          <p className="thank-you-subtext">Redirecting to search…</p>
        </div>
      </div>
    </div>
  )

  const alreadyShared  = rows.some(r => r.isShared === 1)
  const fullName       = lead
    ? [lead.firstName, lead.middleName, lead.lastName].filter(Boolean).join(' ')
    : ''
  const columns     = buildColumns()
  const expenseRows = buildExpenseRows()

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
      {codeEditTarget && (
        <CodeSearchModal
          type={codeEditTarget.type}
          defaultSearch={rows.find(r => r.requestNo === codeEditTarget.requestNo)?.[CODE_FIELD_KEYS[codeEditTarget.type].cd] || ''}
          onSelect={handleCodeSelect}
          onClose={() => setCodeEditTarget(null)}
        />
      )}

      {/* ── Common header ─────────────────────────────────────────────────── */}
      <div className="common-header">
        <div className="common-header-content">
          <div className="common-header-title-wrapper">
            <h2 className="common-header-title">Estimate Compare</h2>
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

      {/* ── Success toast ─────────────────────────────────────────────────── */}
      {doneMsg && (
        <div className="la-success" style={{ marginBottom: 16 }}>
          <i className="fas fa-check-circle"></i> {doneMsg}
        </div>
      )}

      {/* ── Comparison table ──────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="ec-empty">
          <i className="fas fa-info-circle"></i>&nbsp; No approved estimates found for this claim.
        </div>
      ) : (
        <>
          <div className="treatment-plan-header">
            <i className="fas fa-balance-scale"></i>&nbsp; Provider Estimate Comparison
          </div>
          <div className="treatment-plan-table-wrapper">
            <table className="treatment-plan-table">
              <thead>
                {/* Checkbox row — one checkbox per provider, spanning its Room-Type sub-columns */}
                <tr className="select-row">
                  <th className="ec-label-col">Select</th>
                  {rows.map((row, ci) => (
                    <th key={row.requestNo} colSpan={providerSpan(row.requestNo)} className={`ec-provider-col ec-col-${(ci % 4) + 1}`}>
                      <div className="ec-checkbox-wrap">
                        <input
                          type="checkbox"
                          checked={checked.includes(row.requestNo)}
                          onChange={() => toggleCheck(row.requestNo)}
                        />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>

                {/* Provider Name row */}
                <tr>
                  <th className="ec-label-col">Provider Name</th>
                  {rows.map((row, ci) => (
                    <td key={row.requestNo} colSpan={providerSpan(row.requestNo)} className={`ec-provider-col ec-col-${(ci % 4) + 1} ec-provider-name`}>
                      {row.prvNm || row.prvCd}
                    </td>
                  ))}
                </tr>

                {/* Fixed attribute rows */}
                {ATTR_ROWS.map(attr => (
                  <tr key={attr.key}>
                    <th className="ec-label-col">{attr.label}</th>
                    {rows.map((row, ci) => {
                      const isPendingHere = attr.editType && pendingCode?.requestNo === row.requestNo && pendingCode?.type === attr.editType
                      const isPendingDesc = attr.descOfType && pendingCode?.requestNo === row.requestNo && pendingCode?.type === attr.descOfType
                      if (isPendingDesc) {
                        return (
                          <td key={row.requestNo} colSpan={providerSpan(row.requestNo)} className={`ec-provider-col ec-col-${(ci % 4) + 1}`} style={{ color: '#8b5cf6', fontStyle: 'italic' }}>
                            {pendingCode.nm || '—'}
                          </td>
                        )
                      }
                      return (
                        <td key={row.requestNo} colSpan={providerSpan(row.requestNo)} className={`ec-provider-col ec-col-${(ci % 4) + 1}`}>
                          {isPendingHere ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{pendingCode.cd}</span>
                              <button
                                className="ec-code-confirm-btn"
                                title="Save this code"
                                disabled={codeSaving}
                                onClick={handleConfirmPendingCodeClick}
                                style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', fontSize: 14 }}
                              >
                                {codeSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check"></i>}
                              </button>
                              <button
                                className="ec-code-cancel-btn"
                                title="Cancel"
                                disabled={codeSaving}
                                onClick={cancelPendingCode}
                                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 }}
                              >
                                <i className="fas fa-times"></i>
                              </button>
                            </span>
                          ) : (
                            <>
                              {row[attr.key] || '—'}
                              {attr.editType && (
                                <button
                                  className="ec-code-edit-btn"
                                  title={`Add/Edit ${attr.editType} code`}
                                  onClick={() => setCodeEditTarget({ requestNo: row.requestNo, type: attr.editType })}
                                  style={{ marginLeft: 8, background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', fontSize: 13 }}
                                >
                                  <i className="fas fa-pen"></i>
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}

                {/* Room Type sub-header — one actual column per Provider+Room-Type,
                    so a provider offering several room-type sets shows them
                    side by side under its own spanning header above. */}
                <tr>
                  <th className="ec-label-col"></th>
                  {columns.map(col => (
                    <th key={`${col.row.requestNo}-${col.roomType}`} className={`ec-provider-col ec-col-${(col.providerIndex % 4) + 1}`} style={{ color: '#e53e3e', textAlign: 'left' }}>
                      {col.roomTypeNm}
                    </th>
                  ))}
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

                {/* Estimate Amount — one cell per Provider+Room-Type column, final row.
                    Keeps each column's normal provider color, not a separate grey band. */}
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
        </>
      )}

      {/* ── Treatment Plan — common remarks box always visible; Download button only
          once at least one provider has actually been shared (data to print exists) ── */}
      <div style={{ margin: '16px 0', padding: 14, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
          Free Text Remarks to be captured (printed on the Treatment Plan PDF, common to all providers)
        </label>
        <textarea
          className="leadform-field-textarea"
          rows={2}
          style={{ width: '100%', fontSize: 13, resize: 'vertical', marginBottom: 10 }}
          value={treatmentRemarks}
          onChange={e => setTreatmentRemarks(e.target.value)}
          placeholder="Enter remarks to print on the Treatment Plan…"
        />
        {alreadyShared && (
          <button
            className="MedicaltourismProceedforEstimate__btn"
            onClick={handleDownloadTreatmentPlan}
            disabled={downloadingPdf}
          >
            {downloadingPdf
              ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Preparing PDF…</>
              : <><i className="fas fa-file-pdf"></i>&nbsp;Download Treatment Plan</>
            }
          </button>
        )}
      </div>

      {/* ── Generate Estimate button ──────────────────────────────────────── */}
      <div className="generate-estimates-display-button-container">
        <button
          className="MedicaltourismProceedforEstimate__btn MedicaltourismProceedforEstimate__btn--submit"
          onClick={handleGenerateClick}
          disabled={saving || alreadyShared}
        >
          {saving
            ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Generating…</>
            : <><i className="fas fa-paper-plane"></i>&nbsp;Generate Estimate</>
          }
        </button>
      </div>

    </div>
  )
}
