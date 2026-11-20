import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getLeadByEstimateToken, submitLeadEstimateCu, uploadDocument, fetchMasterItems, fetchDocuments, openDocument, fetchEstimateExpenses, fetchEstimateRequests } from '../utils/api'
import { authUtils } from '../utils/auth'
import ValidationModal from './ValidationModal'
import CodeSearchModal from './CodeSearchModal'

const STATUS_ESTIMATE_SUBMITTED = 317
const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'INR']

/**
 * LeadEstimateCu — mirrors lead_estimate_cu.ascx from Med_Tour.
 * Provider fills estimate details after accepting the case.
 * Accessible without login via token from email link.
 */
export default function LeadEstimateCu() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const token          = searchParams.get('token') || ''
  const editMode       = searchParams.get('edit') === 'true'
  const isLoggedIn     = authUtils.isLoggedIn()
  const currentUser    = isLoggedIn ? authUtils.getUser() : null

  const [data,       setData]      = useState(null)
  const [estimateRequestId, setEstimateRequestId] = useState(null)
  const [documents,  setDocuments] = useState([])
  const [loading,    setLoading]   = useState(true)
  const [pageError,  setPageError] = useState('')
  const [submitting, setSubmitting]= useState(false)
  const [submitted,  setSubmitted] = useState(false)
  const [modalMsgs,  setModalMsgs] = useState([])

  const [form, setForm] = useState({
    lineOfTreatment : '',
    icdCode         : '',
    icdDesc         : '',
    cptCode         : '',
    cptDesc         : '',
    drgCode         : '',
    drgDesc         : '',
    noOfDays        : '',
    currency        : '',
    roomType        : '',
    roomTypeNm      : '',
    pnp             : '',
  })

  const [doctorFile,        setDoctorFile]        = useState(null)
  const [existingDoctorDoc, setExistingDoctorDoc] = useState(null)

  // Code search modal — { type: 'ICD'|'CPT'|'DRG', defaultSearch: string } | null
  const [codeSearchModal, setCodeSearchModal] = useState(null)

  const [treatmentLineOptions, setTreatmentLineOptions] = useState([])
  const [expenseHeadOptions,   setExpenseHeadOptions]   = useState([])
  const [roomTypeOptions,      setRoomTypeOptions]      = useState([])
  const [treatmentRow, setTreatmentRow] = useState({
    treatmentLineCd: '', treatmentLineNm: '',
    expenseHeadCd:   '', expenseHeadNm:   '',
    minCost: '', maxCost: '', remarks: ''
  })

  // One provider submission can carry multiple Room-Type tables (e.g. Ward,
  // Private AC) — but the entry form above stays a single shared row, just
  // like before. Clicking "Add" appends the line to whichever Room Type is
  // currently selected: if a table for it already exists it's appended there,
  // otherwise a brand-new table is created automatically.
  const [groups, setGroups] = useState([]) // [{ roomType, roomTypeNm, pnp, lines: [] }]

  useEffect(() => {
    if (!token) { setPageError('Invalid or missing link.'); setLoading(false); return }
    loadData()
    fetchMasterItems('RoomType').then(setRoomTypeOptions).catch(() => setRoomTypeOptions([]))
  }, [token])

  useEffect(() => {
    if (!form.pnp) { setTreatmentLineOptions([]); return }
    fetchMasterItems('TreatmentType', form.pnp).then(items => {
      setTreatmentLineOptions(items)
      setTreatmentRow(r => ({ ...r, treatmentLineCd: '', treatmentLineNm: '', expenseHeadCd: '', expenseHeadNm: '' }))
      setExpenseHeadOptions([])
    })
  }, [form.pnp])

  useEffect(() => {
    if (!treatmentRow.treatmentLineCd) { setExpenseHeadOptions([]); return }
    fetchMasterItems('ExpenseHead', treatmentRow.treatmentLineCd).then(items => {
      setExpenseHeadOptions(items)
      setTreatmentRow(r => ({ ...r, expenseHeadCd: '', expenseHeadNm: '' }))
    })
  }, [treatmentRow.treatmentLineCd])

  useEffect(() => {
    if (!submitted || !isLoggedIn) return
    const t = setTimeout(() => navigate('/leads/search', { replace: true }), 1500)
    return () => clearTimeout(t)
  }, [submitted])

  // Room Type is a single shared dropdown, like every other field on this
  // form — switching it to a Room Type that already has a table locks
  // Package/Non-Package to whatever that table was saved as (a room type's
  // lines can't be a mix of Package and Non-Package), matching how Currency
  // already locks once any line exists.
  const existingGroupForRoomType = groups.find(g => g.roomType === form.roomType)
  const isPnpLocked = !!existingGroupForRoomType

  function handleRoomTypeChange(e) {
    const value = e.target.value
    const opt = roomTypeOptions.find(o => o.value === value)
    const existing = groups.find(g => g.roomType === value)
    setForm(f => ({ ...f, roomType: value, roomTypeNm: opt?.text || '', pnp: existing ? existing.pnp : f.pnp }))
  }

  async function loadData() {
    try {
      const result = await getLeadByEstimateToken(token)
      if (!result || !result.isTokenValid) {
        setPageError('This link is invalid. Please contact the case manager.')
      } else if (result.isExpired) {
        setPageError('This link has expired. Please contact the case manager for a new link.')
      } else if (result.isUsed && !(editMode && isLoggedIn)) {
        setPageError('used')
      } else if (result.leadAcceptance === 2) {
        setPageError('This estimate request has been declined.')
      } else {
        setData(result)
        const claimNo = result.lead?.claimNo
        if (claimNo) {
          fetchDocuments('LEAD', claimNo).then(docs => setDocuments((docs || []).filter(d => d.docTypeCd === '316'))).catch(() => {})
          fetchDocuments('LEAD', claimNo).then(docs => {
            const doc = (docs || []).find(d => d.docTypeCd === '305' && d.requestNo === token)
            setExistingDoctorDoc(doc || null)
          }).catch(() => {})
        }
        if (editMode && isLoggedIn) {
          const claimNo = result.lead?.claimNo
          if (claimNo) {
            fetchEstimateRequests(claimNo, 'STATUS').then(rows => {
              const row = (rows || []).find(r => r.requestNo === token)
              if (row) {
                setEstimateRequestId(row.id ?? null)
                setForm(f => ({
                  ...f,
                  lineOfTreatment : row.lineOfTreatment || '',
                  icdCode         : row.icdCd           || '',
                  icdDesc         : row.icdDesc          || '',
                  cptCode         : row.cptCd            || '',
                  cptDesc         : row.cptDesc          || '',
                  drgCode         : row.drgCd            || '',
                  drgDesc         : row.drgDesc          || '',
                  noOfDays        : row.los != null ? String(row.los) : '',
                  currency        : row.currency         || '',
                }))
              }
            }).catch(() => {})
            fetchEstimateExpenses(token).then(exps => {
              if (exps && exps.length > 0) {
                // Group the flat expense-line list back into Room-Type tables for editing
                const byRoomType = new Map()
                exps.forEach(e => {
                  const key = e.roomType || ''
                  if (!byRoomType.has(key)) {
                    byRoomType.set(key, { roomType: e.roomType || '', roomTypeNm: e.roomTypeNm || '', pnp: e.packageType || '', lines: [] })
                  }
                  byRoomType.get(key).lines.push({
                    currency        : e.currency    || '',
                    treatmentLineCd : e.treatmentCd || '',
                    treatmentLineNm : e.treatmentNm || '',
                    expenseHeadCd   : e.expenseCd   || '',
                    expenseHeadNm   : e.expenseNm   || '',
                    minCost         : String(e.minCost ?? ''),
                    maxCost         : String(e.maxCost ?? ''),
                    remarks         : e.remarks      || ''
                  })
                })
                setGroups([...byRoomType.values()])
              }
            }).catch(() => {})
          }
        }
      }
    } catch {
      setPageError('Unable to load case details. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  function handleTreatmentRowChange(e) {
    const { name, value } = e.target
    if (name === 'treatmentLineCd') {
      const opt = treatmentLineOptions.find(o => o.value === value)
      setTreatmentRow(r => ({ ...r, treatmentLineCd: value, treatmentLineNm: opt?.text || '' }))
    } else if (name === 'expenseHeadCd') {
      const opt = expenseHeadOptions.find(o => o.value === value)
      setTreatmentRow(r => ({ ...r, expenseHeadCd: value, expenseHeadNm: opt?.text || '' }))
    } else {
      setTreatmentRow(r => ({ ...r, [name]: value }))
    }
  }

  function showAlert(messages) { setModalMsgs(messages) }

  function validateRow() {
    const msg = []
    if (!form.currency)                  msg.push('Currency')
    if (!form.roomType)                  msg.push('Room Type')
    if (!form.pnp)                       msg.push('Package / Non-Package')
    if (!treatmentRow.treatmentLineCd)   msg.push('Treatment Line')
    if (!treatmentRow.expenseHeadCd)     msg.push('Expense Head')
    if (!treatmentRow.minCost.trim())    msg.push('Min Amount')
    else if (!/^\d+(\.\d{1,2})?$/.test(treatmentRow.minCost.trim())) msg.push('Min Amount (enter valid decimal amount)')
    if (!treatmentRow.maxCost.trim())    msg.push('Max Amount')
    else if (!/^\d+(\.\d{1,2})?$/.test(treatmentRow.maxCost.trim())) msg.push('Max Amount (enter valid decimal amount)')
    if (treatmentRow.minCost.trim() && treatmentRow.maxCost.trim() && parseFloat(treatmentRow.maxCost) < parseFloat(treatmentRow.minCost))
      msg.push('Max Amount must be greater than or equal to Min Amount')
    if (form.pnp !== 'N' && !treatmentRow.remarks.trim()) msg.push('Remarks')

    // Same Treatment Line + Expense Head can't be added twice under the same
    // Room Type — pick a different Expense Head, or delete the existing row
    // first if it needs correcting.
    const currentGroup = groups.find(g => g.roomType === form.roomType)
    if (currentGroup?.lines.some(l =>
      l.treatmentLineCd === treatmentRow.treatmentLineCd && l.expenseHeadCd === treatmentRow.expenseHeadCd
    )) {
      msg.push(`${treatmentRow.treatmentLineNm} / ${treatmentRow.expenseHeadNm} has already been added for ${form.roomTypeNm} — delete the existing row first if it needs changing.`)
    }

    if (msg.length) { showAlert(msg); return false }
    return true
  }

  function handleAddTreatmentRow() {
    if (!validateRow()) return
    const newLine = {
      currency:        form.currency,
      treatmentLineCd: treatmentRow.treatmentLineCd,
      treatmentLineNm: treatmentRow.treatmentLineNm,
      expenseHeadCd:   treatmentRow.expenseHeadCd,
      expenseHeadNm:   treatmentRow.expenseHeadNm,
      minCost:         treatmentRow.minCost,
      maxCost:         treatmentRow.maxCost,
      remarks:         treatmentRow.remarks
    }
    setGroups(prev => {
      const idx = prev.findIndex(g => g.roomType === form.roomType)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], lines: [...updated[idx].lines, newLine] }
        return updated
      }
      return [...prev, { roomType: form.roomType, roomTypeNm: form.roomTypeNm, pnp: form.pnp, lines: [newLine] }]
    })
    setTreatmentRow(r => ({ ...r, treatmentLineCd: '', treatmentLineNm: '', expenseHeadCd: '', expenseHeadNm: '', minCost: '', maxCost: '', remarks: '' }))
    setExpenseHeadOptions([])
  }

  function handleDeleteRow(roomType, idx) {
    setGroups(prev => prev
      .map(g => g.roomType === roomType ? { ...g, lines: g.lines.filter((_, i) => i !== idx) } : g)
      .filter(g => g.lines.length > 0))
  }

  function groupTotals(group) {
    return group.lines.reduce((acc, r) => ({
      min: acc.min + (parseFloat(r.minCost) || 0),
      max: acc.max + (parseFloat(r.maxCost) || 0)
    }), { min: 0, max: 0 })
  }

  function validate() {
    const msg = []
    if (!form.lineOfTreatment.trim()) msg.push('Line of Treatment')
    if (!form.noOfDays)               msg.push('No. of Days')
    if (!form.currency)               msg.push('Currency')
    if (groups.length === 0)          msg.push('Treatment Line (at least one required)')
    if (msg.length) { showAlert(msg); return false }
    return true
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      await submitLeadEstimateCu({
        token,
        isEdit              : editMode,
        estimateRequestId   : editMode ? estimateRequestId : null,
        claimNo          : data.lead?.claimNo  || '',
        memberId         : data.lead?.memberId || '',
        prvCd            : data.prvCd          || '',
        caseManagerEmail : data.lead?.caseManagerEmail || '',
        lineOfTreatment  : form.lineOfTreatment,
        icdCode          : form.icdCode,
        icdDesc          : form.icdDesc,
        cptCode          : form.cptCode,
        cptDesc          : form.cptDesc,
        drgCode          : form.drgCode,
        drgDesc          : form.drgDesc,
        roomType         : '',   // legacy single field — Room Type is now per-set (see ExpenseLines)
        los              : form.noOfDays.trim(),
        currency         : form.currency,
        statusCd         : editMode ? (data.lead?.statusCd ?? 0) : STATUS_ESTIMATE_SUBMITTED,
        statusRemarks    : editMode ? 'Estimate Edited at later stage by Executive' : (isLoggedIn ? 'Estimate Entered by Portal Executive' : 'Estimate Received From Provider'),
        updatedBy        : isLoggedIn ? (currentUser?.user_Id   || 0)  : 0,
        updatedByNm      : isLoggedIn ? (currentUser?.user_Full_Name || '') : '',
        expenseLines     : groups.flatMap(g => g.lines.map(r => ({
          treatmentCd : r.treatmentLineCd,
          treatmentNm : r.treatmentLineNm,
          expenseCd   : r.expenseHeadCd,
          expenseNm   : r.expenseHeadNm,
          minCost     : parseFloat(r.minCost) || 0,
          maxCost     : parseFloat(r.maxCost) || 0,
          remarks     : r.remarks,
          currency    : r.currency,
          roomType    : g.roomType,
          roomTypeNm  : g.roomTypeNm,
          packageType : g.pnp
        })))
      })
      if (doctorFile) {
        try {
          await uploadDocument({ moduleCd: 'LEAD', referenceCd: data.lead?.claimNo || '', memberId: data.lead?.memberId || '', docTypeCd: '305', docTypeNm: 'Doctor Details', requestNo: token, file: doctorFile, auth: false })
        } catch { /* file upload failure must not block success screen */ }
      }
      setSubmitted(true)
    } catch {
      setModalMsgs(['Something went wrong. Please try again.'])
    } finally {
      setSubmitting(false)
    }
  }

  function getFileIcon(fileName) {
    const ext = (fileName || '').split('.').pop().toLowerCase()
    switch (ext) {
      case 'pdf':               return 'fas fa-file-pdf'
      case 'doc': case 'docx': return 'fas fa-file-word'
      case 'jpg': case 'jpeg':
      case 'png': case 'bmp':  return 'fas fa-file-image'
      default:                  return 'fas fa-file'
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="message-wrapper">
      <div className="message-container">
        <div className="thank-you-card">
          <i className="fas fa-spinner fa-spin" style={{ fontSize: 40, color: '#632da7' }}></i>
          <p style={{ marginTop: 16, color: '#718096', fontSize: 18 }}>Loading case details...</p>
        </div>
      </div>
    </div>
  )

  // ── Link already used ────────────────────────────────────────────────────
  if (pageError === 'used') return (
    <div className="message-wrapper">
      <div className="message-container">
        <div className="link-expired-card">
          <div className="link-expired-icon">
            <svg viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          </div>
          <h1 className="link-expired-title">Link Already Used</h1>
          <p className="link-expired-message">This link has already been used and is no longer valid.</p>
          <p className="link-expired-submessage">Please contact the case manager if you need assistance.</p>
        </div>
      </div>
    </div>
  )

  // ── Other errors ─────────────────────────────────────────────────────────
  if (pageError) return (
    <div className="message-wrapper">
      <div className="message-container">
        <div className="link-expired-card">
          <div className="link-expired-icon">
            <svg viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </div>
          <h1 className="link-expired-title">Invalid Link</h1>
          <p className="link-expired-message">{pageError}</p>
        </div>
      </div>
    </div>
  )

  // ── Thank you ────────────────────────────────────────────────────────────
  if (submitted) return (
    <div className="message-wrapper">
      <div className="message-container">
        <div className="thank-you-card">
          <div className="thank-you-checkmark">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 className="thank-you-heading">SUCCESS!</h1>
          {isLoggedIn ? (
            <>
              <p className="thank-you-text">Details submitted successfully.</p>
              <p className="thank-you-subtext">Redirecting to Lead Search...</p>
            </>
          ) : (
            <>
              <p className="thank-you-text">Thank you for your response. We will get back to you soon.</p>
              <p className="thank-you-subtext">You can close this window.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )

  const lead = data?.lead

  return (
    <div className="quotation-container">

      {/* ── Banner ──────────────────────────────────────────────────────── */}
      <div className="info-banner">
        <div className="circle circle-top"></div>
        <div className="circle circle-bottom"></div>
        <div className="icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M9 12L11 14L15 10M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              stroke="url(#lecugradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="lecugradient" x1="3" y1="2.944" x2="21" y2="20.622">
                <stop stopColor="#667eea" /><stop offset="1" stopColor="#764ba2" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="title">Case Estimation</div>
        <div className="subtitle">Please fill all the necessary information to share estimate</div>
      </div>

      {/* ── Patient Info ─────────────────────────────────────────────────── */}
      <div className="patient-info-card">
        <h2 className="patient-info-header">
          <i className="fas fa-user-circle"></i>&nbsp; Patient Information
        </h2>
        <div className="patient-details-grid">
          <div className="patient-detail-item">
            <div className="patient-detail-label">Insurer / Entity</div>
            <div className="patient-detail-value">{lead?.insurerNm || '—'}</div>
          </div>
          <div className="patient-detail-item">
            <div className="patient-detail-label">Full Name</div>
            <div className="patient-detail-value">
              {[lead?.firstName, lead?.middleName, lead?.lastName].filter(Boolean).join(' ') || '—'}
            </div>
          </div>
          <div className="patient-detail-item">
            <div className="patient-detail-label">Email Address</div>
            <div className="patient-detail-value">{lead?.emailId || '—'}</div>
          </div>
          <div className="patient-detail-item">
            <div className="patient-detail-label">DOB</div>
            <div className="patient-detail-value">{lead?.dob || '—'}</div>
          </div>
          <div className="patient-detail-item">
            <div className="patient-detail-label">Current Location</div>
            <div className="patient-detail-value">{lead?.patientLocationNm || '—'}</div>
          </div>
          <div className="patient-detail-item">
            <div className="patient-detail-label">Treatment Type</div>
            <div className="patient-detail-value">{lead?.treatmentTypeNm || '—'}</div>
          </div>
        </div>
      </div>

      {/* ── Main Container ───────────────────────────────────────────────── */}
      <div className="main-medical-container">

        {/* Medical Reports */}
        <div className="reports-medical-section">
          <div className="title-medical-section">
            <i className="fas fa-file-medical"></i> Medical Reports
          </div>
          <div className="uploaded-files">
            {documents.length > 0
              ? documents.map(doc => (
                  <div key={doc.id} className="file-box" style={{ cursor: 'pointer' }}
                       onClick={() => openDocument(doc.id)}
                       title={`Open ${doc.originalFileName || doc.fileName}`}>
                    <i className={getFileIcon(doc.originalFileName || doc.fileName)}></i>
                    <span>{doc.docTypeNm || doc.originalFileName || doc.fileName}</span>
                  </div>
                ))
              : <p style={{ color: '#999', fontSize: 13 }}>No documents uploaded.</p>
            }
          </div>
        </div>

        {/* ── Estimate Form ─────────────────────────────────────────────── */}
        <div className="container-accepted-options">
          <div className="title-options-accepted">
            <i className="fas fa-hospital"></i>
            Hospital Treatment Estimate
          </div>

          <form onSubmit={handleSubmit} className="form-opinion-estimate">

            {/* Line of Treatment */}
            <div className="group-form-medical">
              <label className="label-form-medical">Line of Treatment</label>
              <textarea
                name="lineOfTreatment"
                className="textarea-form-medical"
                placeholder="Describe the treatment plan..."
                value={form.lineOfTreatment}
                onChange={handleChange}
              />
            </div>

            {/* ICD Code + ICD Description — same row */}
            <div className="grid-form-two-cols">
              <div className="group-form-medical">
                <label className="label-form-medical">ICD Code</label>
                <div className="code-input-wrap">
                  <input name="icdCode" className="input-form-medical" placeholder="Enter ICD code" value={form.icdCode} onChange={handleChange} />
                  <button type="button" className="code-search-icon" title="Search ICD"
                    onClick={() => setCodeSearchModal({ type: 'ICD', defaultSearch: form.icdCode })}>
                    <i className="fas fa-search"></i>
                  </button>
                </div>
              </div>
              <div className="group-form-medical">
                <label className="label-form-medical">ICD Description</label>
                <input name="icdDesc" className="input-form-medical" placeholder="Auto-filled from search" value={form.icdDesc} onChange={handleChange} />
              </div>
            </div>

            {/* CPT Code + CPT Description — same row */}
            <div className="grid-form-two-cols">
              <div className="group-form-medical">
                <label className="label-form-medical">CPT Code</label>
                <div className="code-input-wrap">
                  <input name="cptCode" className="input-form-medical" placeholder="Enter CPT code" value={form.cptCode} onChange={handleChange} />
                  <button type="button" className="code-search-icon" title="Search CPT"
                    onClick={() => setCodeSearchModal({ type: 'CPT', defaultSearch: form.cptCode })}>
                    <i className="fas fa-search"></i>
                  </button>
                </div>
              </div>
              <div className="group-form-medical">
                <label className="label-form-medical">CPT Description</label>
                <input name="cptDesc" className="input-form-medical" placeholder="Auto-filled from search" value={form.cptDesc} onChange={handleChange} />
              </div>
            </div>

            {/* DRG Code + DRG Description — same row */}
            <div className="grid-form-two-cols">
              <div className="group-form-medical">
                <label className="label-form-medical">DRG Code</label>
                <div className="code-input-wrap">
                  <input name="drgCode" className="input-form-medical" placeholder="Enter DRG code" value={form.drgCode} onChange={handleChange} />
                  <button type="button" className="code-search-icon" title="Search DRG"
                    onClick={() => setCodeSearchModal({ type: 'DRG', defaultSearch: form.drgCode })}>
                    <i className="fas fa-search"></i>
                  </button>
                </div>
              </div>
              <div className="group-form-medical">
                <label className="label-form-medical">DRG Description</label>
                <input name="drgDesc" className="input-form-medical" placeholder="Auto-filled from search" value={form.drgDesc} onChange={handleChange} />
              </div>
            </div>

            {/* No. of Days — global for the whole submission */}
            <div className="grid-form-two-cols">
              <div className="group-form-medical">
                <label className="label-form-medical">No. of Days <span style={{ color: '#e53e3e' }}>*</span></label>
                <input
                  type="text"
                  name="noOfDays"
                  className="input-form-medical"
                  placeholder="e.g. 5-7 Days"
                  value={form.noOfDays}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Upload Doctor Details */}
            <div className="grid-form-two-cols">
              <div className="group-form-medical">
                <label className="label-form-medical">Upload Doctor Details</label>
                <input
                  type="file"
                  className="input-form-medical"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={e => setDoctorFile(e.target.files[0] || null)}
                />
                {existingDoctorDoc && !doctorFile && (
                  <div style={{ marginTop: 6, fontSize: 13, color: '#555' }}>
                    Existing:{' '}
                    <span
                      onClick={() => openDocument(existingDoctorDoc.id)}
                      style={{ color: '#1976d2', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      {existingDoctorDoc.docTypeNm || existingDoctorDoc.originalFileName || existingDoctorDoc.fileName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Cost Estimates ─────────────────────────────────────────── */}
            <div className="group-form-medical">
              <label className="label-form-medical">Cost Estimates</label>
              <div className="treatment-divider"></div>

              {/* Currency + Room Type + Package/Non-Package */}
              <div className="grid-form-two-cols" style={{ marginTop: 12 }}>
                <div className="group-form-medical">
                  <label className="label-form-medical">Currency</label>
                  <select name="currency" className="currency-input-dropdown" value={form.currency} onChange={handleChange}
                    disabled={groups.length > 0}
                    title={groups.length > 0 ? 'Currency cannot be changed after expense rows are added' : ''}>
                    <option value="">-- Select --</option>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="group-form-medical">
                  <label className="label-form-medical">Room Type</label>
                  <select className="input-form-medical" value={form.roomType} onChange={handleRoomTypeChange}>
                    <option value="">-- Select --</option>
                    {roomTypeOptions.filter(r => r.value).map(r => <option key={r.value} value={r.value}>{r.text}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid-form-two-cols" style={{ marginTop: 12 }}>
                <div className="group-form-medical">
                  <label className="label-form-medical">
                    Package / Cost Break up
                    {isPnpLocked && <span style={{ fontWeight: 400, color: '#888', fontSize: 12 }}> (fixed for this Room Type)</span>}
                  </label>
                  <div className="pnp-radio-group">
                    <label className="pnp-radio-label">
                      <input type="radio" name="pnp" value="P" checked={form.pnp === 'P'} disabled={isPnpLocked} onChange={handleChange} />
                      &nbsp;Package
                    </label>
                    <label className="pnp-radio-label">
                      <input type="radio" name="pnp" value="N" checked={form.pnp === 'N'} disabled={isPnpLocked} onChange={handleChange} />
                      &nbsp;Non-Package
                    </label>
                  </div>
                </div>
              </div>

              {/* Treatment Line / Expense Head / Min / Max / Remarks — all in one row */}
              <div className="grid-form-four-cols" style={{ marginTop: 12 }}>
                <div className="group-form-medical">
                  <label className="label-form-medical">Treatment Line</label>
                  <select name="treatmentLineCd" className="input-form-medical" value={treatmentRow.treatmentLineCd} onChange={handleTreatmentRowChange} disabled={!form.roomType || !form.pnp}>
                    <option value="">-- Select --</option>
                    {treatmentLineOptions.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
                  </select>
                </div>
                <div className="group-form-medical">
                  <label className="label-form-medical">Expense Head</label>
                  <select name="expenseHeadCd" className="input-form-medical" value={treatmentRow.expenseHeadCd} onChange={handleTreatmentRowChange} disabled={!treatmentRow.treatmentLineCd}>
                    <option value="">-- Select --</option>
                    {expenseHeadOptions.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
                  </select>
                </div>
                <div className="group-form-medical">
                  <label className="label-form-medical">Min Amount</label>
                  <input name="minCost" type="number" min="0" step="0.01" className="input-form-medical" placeholder="0.00" value={treatmentRow.minCost} onChange={handleTreatmentRowChange} />
                </div>
                <div className="group-form-medical">
                  <label className="label-form-medical">Max Amount</label>
                  <input name="maxCost" type="number" min="0" step="0.01" className="input-form-medical" placeholder="0.00" value={treatmentRow.maxCost} onChange={handleTreatmentRowChange} />
                </div>
              </div>
              <div className="grid-form-two-cols" style={{ marginTop: 12 }}>
                <div className="group-form-medical">
                  <label className="label-form-medical">Remarks</label>
                  <input name="remarks" className="input-form-medical" placeholder="Enter Remarks" value={treatmentRow.remarks} onChange={handleTreatmentRowChange} />
                </div>
              </div>

              <button type="button" className="btn-add-treatment" onClick={handleAddTreatmentRow}>
                <i className="fas fa-plus"></i> Add
              </button>

              {/* One table per Room Type — created automatically the first time a
                  line is added for that Room Type; further lines for the same
                  Room Type append to its existing table. */}
              {groups.map(group => {
                const totals = groupTotals(group)
                return (
                  <div key={group.roomType} style={{ marginTop: 24 }}>
                    <h4 style={{ color: '#e53e3e', margin: '0 0 8px' }}>{group.roomTypeNm}</h4>
                    <div className="treatment-details-table">
                      <table className="table-treatment-details">
                        <thead>
                          <tr>
                            <th>Treatment Line</th>
                            <th>Expense Head</th>
                            <th>Min Amount</th>
                            <th>Max Amount</th>
                            <th>Remarks</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.lines.map((row, i) => (
                            <tr key={i}>
                              <td>{row.treatmentLineNm}</td>
                              <td>{row.expenseHeadNm}</td>
                              <td>{row.currency} {parseFloat(row.minCost).toFixed(2)}</td>
                              <td>{row.currency} {parseFloat(row.maxCost).toFixed(2)}</td>
                              <td>{row.remarks}</td>
                              <td>
                                <button type="button" className="delete-treatment" onClick={() => handleDeleteRow(group.roomType, i)} title="Delete">✖</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan="2"><strong>Estimated Expense</strong></td>
                            <td colSpan="2"><strong>{group.lines[0]?.currency} {totals.min.toFixed(2)} - {totals.max.toFixed(2)}</strong></td>
                            <td colSpan="2"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )
              })}

            </div>

            <button type="submit" className="btn-submit-opinion" disabled={submitting}>
              <i className="fas fa-check"></i>
              {submitting ? ' Submitting...' : ' Submit'}
            </button>

          </form>
        </div>
      </div>

      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />

      {codeSearchModal && (
        <CodeSearchModal
          type={codeSearchModal.type}
          defaultSearch={codeSearchModal.defaultSearch}
          onSelect={(cd, nm) => {
            const t = codeSearchModal.type.toLowerCase()
            setForm(f => ({ ...f, [`${t}Code`]: cd, [`${t}Desc`]: nm }))
            setCodeSearchModal(null)
          }}
          onClose={() => setCodeSearchModal(null)}
        />
      )}
    </div>
  )
}
