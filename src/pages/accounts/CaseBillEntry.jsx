import { useState, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/* ── helpers ─────────────────────────────────────────────────────────────── */
const CURRENCIES   = ['AED', 'USD', 'EUR', 'GBP', 'INR', 'SAR', 'KWD', 'OMR', 'QAR', 'BHD']
const BILL_HEADERS = [
  { value: '',         label: '-- Select --' },
  { value: 'IPD',      label: 'IPD'          },
  { value: 'OPD',      label: 'OPD'          },
  { value: 'Pharmacy', label: 'Pharmacy'     },
  { value: 'Other',    label: 'Other'        },
]
function isDecimal(v) { return /^\d*\.?\d*$/.test(v) }
function emptyForm()  { return { billNo: '', billDate: '', billHeader: '', billAmt: '', currency: 'AED', billRemarks: '' } }
function fmt(n)       { return parseFloat(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) }

/* ── Collapsible panel wrapper ───────────────────────────────────────────── */
function Section({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="panel-card cbill-section-card">
      <div className="cbill-section-title cbill-section-collapsible" onClick={() => setOpen(o => !o)}>
        {icon && <i className={icon}></i>}&nbsp; {title}
        <i className={`fas fa-chevron-${open ? 'up' : 'down'} cbill-section-chevron`}></i>
      </div>
      {open && <div className="cbill-form-body">{children}</div>}
    </div>
  )
}

/* ── Inline add/delete grid (ICD / CPT / DRG) ───────────────────────────── */
function EntryGrid({ columns, rows, onAdd, onDelete, addLabel = 'Add' }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(columns.map(c => [c.key, ''])))
  const [errs,  setErrs]  = useState({})

  function handleAdd() {
    const e = {}
    columns.filter(c => c.required).forEach(c => { if (!draft[c.key].trim()) e[c.key] = `${c.label} is required.` })
    setErrs(e)
    if (Object.keys(e).length) return
    onAdd({ ...draft, id: Date.now() })
    setDraft(Object.fromEntries(columns.map(c => [c.key, ''])))
    setErrs({})
  }

  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table className="lsrch-table">
        <thead>
          <tr>
            <th>S.No.</th>
            {columns.map(c => <th key={c.key}>{c.label}</th>)}
            <th style={{ textAlign: 'center' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length + 2} style={{ textAlign: 'center', color: '#aaa', padding: '14px 12px' }}>No records added yet.</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td className="lsrch-td-sno">{i + 1}</td>
              {columns.map(c => <td key={c.key} className="lsrch-td-data">{r[c.key]}</td>)}
              <td style={{ textAlign: 'center' }}>
                <button className="cbill-icon-btn" title="Delete" onClick={() => onDelete(r.id)}>
                  <i className="fas fa-trash-alt" style={{ color: '#e74c3c' }}></i>
                </button>
              </td>
            </tr>
          ))}
          {/* Entry row */}
          <tr style={{ background: '#f9f5ff' }}>
            <td className="lsrch-td-sno">—</td>
            {columns.map(c => (
              <td key={c.key} style={{ padding: '6px 8px' }}>
                <input
                  type="text"
                  className={`cbill-form-input${errs[c.key] ? ' cbill-form-input--error' : ''}`}
                  style={{ fontSize: 12 }}
                  placeholder={c.label}
                  value={draft[c.key]}
                  onChange={e => { setDraft(p => ({ ...p, [c.key]: e.target.value })); setErrs(p => ({ ...p, [c.key]: '' })) }}
                />
                {errs[c.key] && <div className="cbill-field-error">{errs[c.key]}</div>}
              </td>
            ))}
            <td style={{ textAlign: 'center' }}>
              <button className="btn-gradient" style={{ padding: '5px 14px', fontSize: 12 }} onClick={handleAdd}>
                <i className="fas fa-plus"></i>&nbsp;{addLabel}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   PHASE 1 — Entry Form + Bill List
══════════════════════════════════════════════════════════════════════════ */
function BillEntrySection({ claimNo, memberId, form, setField, errors, isEditing, editId, bills,
  onAddOrUpdate, onEdit, onCancelEdit, onRemove, onAmtBlur, handleAmtChange, onSaveAndContinue }) {
  return (
    <>
      {/* Entry Form */}
      <div className={`panel-card${isEditing ? ' cbill-panel-editing' : ''}`} style={{ marginBottom: 16 }}>
        {isEditing && (
          <div className="cbill-edit-banner">
            <i className="fas fa-pencil-alt"></i>&nbsp; Editing —&nbsp;
            <strong>{bills.find(b => b.id === editId)?.billNo}</strong>
            <button className="cbill-edit-cancel-link" onClick={onCancelEdit}>
              <i className="fas fa-times-circle"></i> Cancel Edit
            </button>
          </div>
        )}
        <div className="cbill-form-body">
          <div className="cbill-form-row">
            <div className="cbill-form-field">
              <label className="cbill-form-label">Treatment ID</label>
              <input type="text" className="cbill-form-input" value={claimNo} readOnly />
            </div>
            <div className="cbill-form-field">
              <label className="cbill-form-label">Member ID</label>
              <input type="text" className="cbill-form-input" value={memberId} readOnly />
            </div>
          </div>
          <div className="cbill-form-row">
            <div className="cbill-form-field">
              <label className="cbill-form-label">Bill Number <span className="cbill-required">*</span></label>
              <input type="text" className={`cbill-form-input${errors.billNo ? ' cbill-form-input--error' : ''}`}
                placeholder="Bill Number" value={form.billNo} onChange={e => setField('billNo', e.target.value)} />
              {errors.billNo && <span className="cbill-field-error">{errors.billNo}</span>}
            </div>
            <div className="cbill-form-field">
              <label className="cbill-form-label">Bill Date <span className="cbill-required">*</span></label>
              <input type="date" className={`cbill-form-input${errors.billDate ? ' cbill-form-input--error' : ''}`}
                value={form.billDate} onChange={e => setField('billDate', e.target.value)} />
              {errors.billDate && <span className="cbill-field-error">{errors.billDate}</span>}
            </div>
          </div>
          <div className="cbill-form-row">
            <div className="cbill-form-field">
              <label className="cbill-form-label">Bill Header <span className="cbill-required">*</span></label>
              <select className={`cbill-form-input${errors.billHeader ? ' cbill-form-input--error' : ''}`}
                value={form.billHeader} onChange={e => setField('billHeader', e.target.value)}>
                {BILL_HEADERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {errors.billHeader && <span className="cbill-field-error">{errors.billHeader}</span>}
            </div>
            <div className="cbill-form-field">
              <label className="cbill-form-label">Bill Amount <span className="cbill-required">*</span></label>
              <div className="cbill-amount-row">
                <input type="text" className={`cbill-form-input cbill-amt-input${errors.billAmt ? ' cbill-form-input--error' : ''}`}
                  placeholder="0.00" value={form.billAmt} onChange={handleAmtChange} onBlur={onAmtBlur} />
                <select className="cbill-form-input cbill-curr-select" value={form.currency} onChange={e => setField('currency', e.target.value)}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {errors.billAmt && <span className="cbill-field-error">{errors.billAmt}</span>}
            </div>
          </div>
          <div className="cbill-form-row">
            <div className="cbill-form-field cbill-form-field--full">
              <label className="cbill-form-label">Bill Remarks</label>
              <textarea className="cbill-form-input cbill-textarea" placeholder="Bill Remarks"
                value={form.billRemarks} onChange={e => setField('billRemarks', e.target.value)} rows={3} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
            {isEditing && <button className="btn-outline" onClick={onCancelEdit}><i className="fas fa-times"></i>&nbsp; Cancel</button>}
            <button className="btn-gradient" onClick={onAddOrUpdate}>
              {isEditing ? <><i className="fas fa-check"></i>&nbsp; Update Bill</> : <><i className="fas fa-plus-circle"></i>&nbsp; Add Bill</>}
            </button>
          </div>
        </div>
      </div>

      {/* Bill List */}
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div className="cbill-section-title"><i className="fas fa-list-alt"></i>&nbsp; Case Bill List</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="lsrch-table">
            <thead>
              <tr>
                <th>S.No.</th><th>Treatment ID</th><th>Bill Number</th><th>Bill Date</th>
                <th>Bill Header</th><th>Currency</th><th style={{ textAlign: 'right' }}>Bill Amount</th>
                <th>Remarks</th><th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px 12px', color: '#aaa' }}>
                  No bills added yet. Fill the form above and click <strong>Add Bill</strong>.
                </td></tr>
              ) : bills.map((b, i) => (
                <tr key={b.id} className={editId === b.id ? 'cbill-row-editing' : ''}>
                  <td className="lsrch-td-sno">{i + 1}</td>
                  <td className="lsrch-td-data">{claimNo}</td>
                  <td className="lsrch-td-claim">{b.billNo}</td>
                  <td className="lsrch-td-data">{b.billDate}</td>
                  <td className="lsrch-td-data"><span className="cbill-header-badge">{b.billHeader}</span></td>
                  <td className="lsrch-td-data">{b.currency}</td>
                  <td className="lsrch-td-data cbill-amount" style={{ textAlign: 'right' }}>{fmt(b.billAmt)}</td>
                  <td className="lsrch-td-data">{b.billRemarks || '—'}</td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button className="cbill-icon-btn" title="Edit" onClick={() => onEdit(b)}
                      disabled={isEditing && editId !== b.id}>
                      <i className="fas fa-pencil-alt" style={{ color: '#0d6efd' }}></i>
                    </button>
                    <button className="cbill-icon-btn" title="Delete"
                      onClick={() => { if (window.confirm('Are you sure you want to delete this record?')) onRemove(b.id) }}
                      disabled={isEditing && editId !== b.id}>
                      <i className="fas fa-trash-alt" style={{ color: '#e74c3c' }}></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save & Continue */}
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div className="cbill-btn-panel">
          <button className="btn-gradient" onClick={onSaveAndContinue}
            disabled={bills.length === 0 || isEditing}
            title={isEditing ? 'Finish editing first' : bills.length === 0 ? 'Add at least one bill' : ''}>
            <i className="fas fa-arrow-circle-right"></i>&nbsp; Save &amp; Continue
          </button>
        </div>
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   PHASE 2 — Reconciliation only (no bill list)
══════════════════════════════════════════════════════════════════════════ */
function ReconciliationSection({ bills, claimNo, recon, setRecon, frozen }) {
  const totalDeductible = useMemo(
    () => bills.reduce((s, b) => s + (parseFloat(recon[b.id]?.deductible) || 0), 0),
    [bills, recon]
  )
  const totalApproval = useMemo(
    () => bills.reduce((s, b) => s + (parseFloat(recon[b.id]?.approval) || 0), 0),
    [bills, recon]
  )

  function handleDeductibleChange(id, val) {
    if (!isDecimal(val)) return
    setRecon(prev => {
      const billAmt  = parseFloat(bills.find(b => b.id === id)?.billAmt || 0)
      const deduct   = parseFloat(val) || 0
      const approval = deduct > billAmt ? billAmt : billAmt - deduct
      return { ...prev, [id]: { deductible: val, approval: approval.toFixed(2) } }
    })
  }

  return (
    <div className="panel-card cbill-recon-inline" style={{ marginBottom: 16 }}>
      <div className="cbill-section-title cbill-section-title--recon">
        <i className="fas fa-balance-scale"></i>&nbsp; Bill Reconciliation
        {frozen && <span className="cbill-frozen-badge"><i className="fas fa-lock"></i>&nbsp; Frozen</span>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="lsrch-table">
          <thead>
            <tr>
              <th>S.No.</th><th>Treatment ID</th><th>Bill Number</th><th>Bill Date</th>
              <th>Bill Header</th><th style={{ textAlign: 'right' }}>Bill Amount</th>
              <th>Remarks</th>
              <th style={{ textAlign: 'right' }}>Deductible Amt</th>
              <th style={{ textAlign: 'right' }}>Approval Amt</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b, i) => {
              const row = recon[b.id] || { deductible: '0.00', approval: fmt(b.billAmt) }
              return (
                <tr key={b.id}>
                  <td className="lsrch-td-sno">{i + 1}</td>
                  <td className="lsrch-td-data">{claimNo}</td>
                  <td className="lsrch-td-claim">{b.billNo}</td>
                  <td className="lsrch-td-data">{b.billDate}</td>
                  <td className="lsrch-td-data"><span className="cbill-header-badge">{b.billHeader}</span></td>
                  <td className="lsrch-td-data cbill-amount" style={{ textAlign: 'right' }}>{b.currency} {fmt(b.billAmt)}</td>
                  <td className="lsrch-td-data">{b.billRemarks || '—'}</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px' }}>
                    <input type="text" className="cbill-recon-input" value={row.deductible} readOnly={frozen}
                      onChange={e => handleDeductibleChange(b.id, e.target.value)}
                      onBlur={e => { if (!e.target.value || isNaN(parseFloat(e.target.value))) handleDeductibleChange(b.id, '0') }} />
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 8px' }}>
                    <input type="text" className="cbill-recon-input cbill-recon-input--approval" value={row.approval} readOnly />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <th colSpan={7} style={{ textAlign: 'right', paddingRight: 12 }}>Total</th>
              <th style={{ textAlign: 'right', paddingRight: 10, color: '#e74c3c' }}>
                {totalDeductible.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </th>
              <th style={{ textAlign: 'right', paddingRight: 10, color: '#11998e' }}>
                {totalApproval.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </th>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   PHASE 3 — Case Process Long Form (cu-CaseProcess.aspx equivalent)
══════════════════════════════════════════════════════════════════════════ */
function CaseProcessForm({ claimNo, memberId }) {
  const navigate = useNavigate()
  /* ── Member Details ── */
  const [title,       setTitle]       = useState('')
  const [firstName,   setFirstName]   = useState('')
  const [middleName,  setMiddleName]  = useState('')
  const [lastName,    setLastName]    = useState('')
  const [gender,      setGender]      = useState('')
  const [dob,         setDob]         = useState('')
  const [age,         setAge]         = useState('')
  const [address,     setAddress]     = useState('')
  const [pinCode,     setPinCode]     = useState('')
  const [country,     setCountry]     = useState('')
  const [state,       setState]       = useState('')
  const [district,    setDistrict]    = useState('')
  const [city,        setCity]        = useState('')
  const [calCode,     setCalCode]     = useState('+971')
  const [mobileNo,    setMobileNo]    = useState('')
  const [altMobile,   setAltMobile]   = useState('')
  const [landline,    setLandline]    = useState('')
  const [fax,         setFax]         = useState('')
  const [email,       setEmail]       = useState('')
  const [policyNo,    setPolicyNo]    = useState('')
  const [sumInsured,  setSumInsured]  = useState('')
  const [policyStart, setPolicyStart] = useState('')
  const [policyEnd,   setPolicyEnd]   = useState('')
  const [source,      setSource]      = useState('')
  const [insurerNm,   setInsurerNm]   = useState('')
  const [insurerEmail,setInsurerEmail]= useState('')
  const [caseManager, setCaseManager] = useState('')
  const [caseManager2,setCaseManager2]= useState('')

  /* ── General Case Details ── */
  const [submissionDt, setSubmissionDt] = useState('')

  /* ── Case Details ── */
  const [diagnosis,        setDiagnosis]        = useState('')
  const [treatment,        setTreatment]        = useState('')
  const [treatmentLoc,     setTreatmentLoc]     = useState('')
  const [department,       setDepartment]       = useState('')
  const [subStatus,        setSubStatus]        = useState([])
  const [prefHospital,     setPrefHospital]     = useState('')
  const [prefLocation,     setPrefLocation]     = useState('')
  const [treatmentType,    setTreatmentType]    = useState('')
  const [opdPer,           setOpdPer]           = useState('')
  const [coPay,            setCoPay]            = useState('0')
  const [coPayAmt,         setCoPayAmt]         = useState('')
  const [coPayType,        setCoPayType]        = useState('')
  const [nonCovered,       setNonCovered]       = useState('')
  const [finalRemarks,     setFinalRemarks]     = useState('')

  /* ── ICD / CPT / DRG lists ── */
  const [icdRows, setIcdRows] = useState([])
  const [cptRows, setCptRows] = useState([])
  const [drgRows, setDrgRows] = useState([])

  /* ── Form errors & submit ── */
  const [errors,    setErrors]    = useState({})
  const [submitted, setSubmitted] = useState(false)

  function toggleSubStatus(val) {
    setSubStatus(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }

  function handleSubmit() {
    const errs = {}
    if (!firstName.trim())   errs.firstName   = 'First Name is required.'
    if (!source)             errs.source      = 'Source is required.'
    if (!submissionDt)       errs.submissionDt= 'Treatment Submission Date is required.'
    if (!treatmentType)      errs.treatmentType = 'Treatment Type is required.'
    if (treatmentType === 'OPD' && !opdPer.trim()) errs.opdPer = 'OPD Percentage is required.'
    setErrors(errs)
    if (Object.keys(errs).length) { window.scrollTo({ top: document.getElementById('case-process-form')?.offsetTop || 0, behavior: 'smooth' }); return }
    setSubmitted(true)
  }

  if (submitted) return (
    <div className="message-wrapper"><div className="message-container">
      <div className="thank-you-card">
        <div className="thank-you-checkmark"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg></div>
        <h1 className="thank-you-heading">Case Process Saved!</h1>
        <p className="thank-you-text">All case details have been recorded successfully.</p>
      </div>
    </div></div>
  )

  return (
    <div id="case-process-form">

      {/* ── 1. Manage Member Details ── */}
      <Section title="Manage Member Details" icon="fas fa-user">
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Title</label>
            <select className="cbill-form-input" value={title} onChange={e => setTitle(e.target.value)}>
              <option value="">-- Select --</option>
              {['Mr.','Mrs.','Ms.','Dr.','Prof.'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">First Name <span className="cbill-required">*</span></label>
            <input type="text" className={`cbill-form-input${errors.firstName ? ' cbill-form-input--error' : ''}`}
              placeholder="First Name" value={firstName} onChange={e => { setFirstName(e.target.value); setErrors(p => ({ ...p, firstName: '' })) }} />
            {errors.firstName && <span className="cbill-field-error">{errors.firstName}</span>}
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Middle Name</label>
            <input type="text" className="cbill-form-input" placeholder="Middle Name" value={middleName} onChange={e => setMiddleName(e.target.value)} />
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">Last Name</label>
            <input type="text" className="cbill-form-input" placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Gender</label>
            <div className="cbill-radio-group">
              {[['M','Male'],['F','Female']].map(([v,l]) => (
                <label key={v} className="cbill-radio-label">
                  <input type="radio" name="gender" value={v} checked={gender === v} onChange={() => setGender(v)} />
                  &nbsp;{l}
                </label>
              ))}
            </div>
          </div>
          <div className="cbill-form-field"></div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Date of Birth</label>
            <input type="date" className="cbill-form-input" value={dob} onChange={e => setDob(e.target.value)} />
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">Member Age</label>
            <input type="text" className="cbill-form-input" placeholder="Age in Year" value={age}
              onChange={e => { if (/^\d*$/.test(e.target.value)) setAge(e.target.value) }} />
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Address</label>
            <textarea className="cbill-form-input cbill-textarea" placeholder="Address" rows={2} value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">Pin Code</label>
            <input type="text" className="cbill-form-input" placeholder="Pin Code" value={pinCode}
              onChange={e => { if (/^\d*$/.test(e.target.value)) setPinCode(e.target.value) }} />
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Country</label>
            <select className="cbill-form-input" value={country} onChange={e => setCountry(e.target.value)}>
              <option value="">-- Select --</option>
              {['UAE','Saudi Arabia','Kuwait','Oman','Qatar','Bahrain','Jordan','Egypt','India','Pakistan','Other'].map(c =>
                <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">State</label>
            <input type="text" className="cbill-form-input" placeholder="State" value={state} onChange={e => setState(e.target.value)} />
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">District</label>
            <input type="text" className="cbill-form-input" placeholder="District" value={district} onChange={e => setDistrict(e.target.value)} />
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">City</label>
            <input type="text" className="cbill-form-input" placeholder="City" value={city} onChange={e => setCity(e.target.value)} />
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Mobile No</label>
            <div className="cbill-amount-row">
              <input type="text" className="cbill-form-input" style={{ width: 70, flexShrink: 0 }} placeholder="+971" value={calCode}
                onChange={e => setCalCode(e.target.value)} />
              <input type="text" className="cbill-form-input" placeholder="Mobile Number" value={mobileNo}
                onChange={e => { if (/^\d*$/.test(e.target.value)) setMobileNo(e.target.value) }} />
            </div>
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">Alternate Mobile No</label>
            <textarea className="cbill-form-input cbill-textarea" placeholder="Alternate Mobile" rows={2} value={altMobile} onChange={e => setAltMobile(e.target.value)} />
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">LandLine No</label>
            <input type="text" className="cbill-form-input" placeholder="LandLine Number" value={landline} onChange={e => setLandline(e.target.value)} />
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">Fax No</label>
            <input type="text" className="cbill-form-input" placeholder="Fax Number" value={fax} onChange={e => setFax(e.target.value)} />
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Email</label>
            <input type="email" className="cbill-form-input" placeholder="Member Email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="cbill-form-field"></div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Policy No</label>
            <input type="text" className="cbill-form-input" placeholder="Policy Number" value={policyNo} onChange={e => setPolicyNo(e.target.value)} />
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">Sum Insured</label>
            <input type="text" className="cbill-form-input" placeholder="Sum Insured" value={sumInsured}
              onChange={e => { if (isDecimal(e.target.value)) setSumInsured(e.target.value) }} />
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Policy Start Date</label>
            <input type="date" className="cbill-form-input" value={policyStart} onChange={e => setPolicyStart(e.target.value)} />
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">Policy End Date</label>
            <input type="date" className="cbill-form-input" value={policyEnd} onChange={e => setPolicyEnd(e.target.value)} />
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Source <span className="cbill-required">*</span></label>
            <select className={`cbill-form-input${errors.source ? ' cbill-form-input--error' : ''}`}
              value={source} onChange={e => { setSource(e.target.value); setErrors(p => ({ ...p, source: '' })) }}>
              <option value="">-- Select --</option>
              {['Direct','Insurance','TPA','Broker','Partner'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.source && <span className="cbill-field-error">{errors.source}</span>}
          </div>
          <div className="cbill-form-field"></div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Insurer Name</label>
            <select className="cbill-form-input" value={insurerNm} onChange={e => setInsurerNm(e.target.value)}>
              <option value="">-- Select --</option>
              {['Gulf Health Insurance Co.','Daman National Health Insurance','Oman Insurance Company','Abu Dhabi National Insurance'].map(i =>
                <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">Insurer Email</label>
            <textarea className="cbill-form-input cbill-textarea" placeholder="Insurer Email" rows={2} value={insurerEmail} onChange={e => setInsurerEmail(e.target.value)} />
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Case Manager <span className="cbill-required">*</span></label>
            <select className="cbill-form-input" value={caseManager} onChange={e => setCaseManager(e.target.value)}>
              <option value="">-- Select --</option>
              {['Ali Hassan','Sara Ahmed','Mohammed Khalid','Fatima Al-Rashidi'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">Case Manager 2 <span className="cbill-required">*</span></label>
            <select className="cbill-form-input" value={caseManager2} onChange={e => setCaseManager2(e.target.value)}>
              <option value="">-- Select --</option>
              {['Ali Hassan','Sara Ahmed','Mohammed Khalid','Fatima Al-Rashidi'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </Section>

      {/* ── 2. General Case Details ── */}
      <Section title="General Case Details" icon="fas fa-file-medical">
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Member ID <span className="cbill-required">*</span></label>
            <input type="text" className="cbill-form-input" value={memberId} readOnly />
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">Treatment ID <span className="cbill-required">*</span></label>
            <input type="text" className="cbill-form-input" value={claimNo} readOnly />
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Treatment Submission Date <span className="cbill-required">*</span></label>
            <input type="date" className={`cbill-form-input${errors.submissionDt ? ' cbill-form-input--error' : ''}`}
              value={submissionDt} onChange={e => { setSubmissionDt(e.target.value); setErrors(p => ({ ...p, submissionDt: '' })) }} />
            {errors.submissionDt && <span className="cbill-field-error">{errors.submissionDt}</span>}
          </div>
          <div className="cbill-form-field"></div>
        </div>
      </Section>

      {/* ── 3. Case Details ── */}
      <Section title="Case Details" icon="fas fa-notes-medical">
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Diagnosis</label>
            <textarea className="cbill-form-input cbill-textarea" placeholder="Diagnosis" rows={3} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">Treatment</label>
            <textarea className="cbill-form-input cbill-textarea" placeholder="Treatment" rows={3} value={treatment} onChange={e => setTreatment(e.target.value)} />
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Treatment Location</label>
            <input type="text" className="cbill-form-input" placeholder="Treatment Location" value={treatmentLoc} onChange={e => setTreatmentLoc(e.target.value)} />
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">Department</label>
            <select className="cbill-form-input" value={department} onChange={e => setDepartment(e.target.value)}>
              <option value="">-- Select --</option>
              {['Cardiology','Neurology','Oncology','Orthopaedics','General Surgery','Paediatrics','Obstetrics','Dermatology','ENT','Ophthalmology'].map(d =>
                <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Treatment Sub Status</label>
            <div className="cbill-checkbox-group">
              {['Consultant','Investigation','Surgery','Physiotherapy'].map(v => (
                <label key={v} className="cbill-checkbox-label">
                  <input type="checkbox" checked={subStatus.includes(v)} onChange={() => toggleSubStatus(v)} />&nbsp;{v}
                </label>
              ))}
            </div>
          </div>
          <div className="cbill-form-field"></div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Preferred Hospital</label>
            <input type="text" className="cbill-form-input" placeholder="Preferred Hospital" value={prefHospital} onChange={e => setPrefHospital(e.target.value)} />
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">Preferred Location</label>
            <input type="text" className="cbill-form-input" placeholder="Preferred Location" value={prefLocation} onChange={e => setPrefLocation(e.target.value)} />
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Treatment Type <span className="cbill-required">*</span></label>
            <select className={`cbill-form-input${errors.treatmentType ? ' cbill-form-input--error' : ''}`}
              value={treatmentType} onChange={e => { setTreatmentType(e.target.value); setErrors(p => ({ ...p, treatmentType: '' })) }}>
              <option value="">-- Select --</option>
              <option value="IPD">IPD</option>
              <option value="OPD">OPD</option>
              <option value="DayCare">Day Care</option>
            </select>
            {errors.treatmentType && <span className="cbill-field-error">{errors.treatmentType}</span>}
          </div>
          {treatmentType === 'OPD' && (
            <div className="cbill-form-field">
              <label className="cbill-form-label">OPD Percentage (%) <span className="cbill-required">*</span></label>
              <input type="text" className={`cbill-form-input${errors.opdPer ? ' cbill-form-input--error' : ''}`}
                placeholder="OPD Percentage (%)" value={opdPer}
                onChange={e => { if (isDecimal(e.target.value)) { setOpdPer(e.target.value); setErrors(p => ({ ...p, opdPer: '' })) } }} />
              {errors.opdPer && <span className="cbill-field-error">{errors.opdPer}</span>}
            </div>
          )}
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field">
            <label className="cbill-form-label">Co-Payment <span className="cbill-required">*</span></label>
            <div className="cbill-radio-group">
              {[['0','No'],['1','Yes']].map(([v,l]) => (
                <label key={v} className="cbill-radio-label">
                  <input type="radio" name="copay" value={v} checked={coPay === v} onChange={() => setCoPay(v)} />&nbsp;{l}
                </label>
              ))}
            </div>
            {coPay === '1' && (
              <div className="cbill-amount-row" style={{ marginTop: 8 }}>
                <input type="text" className="cbill-form-input" placeholder="Co-Payment Amount" value={coPayAmt}
                  onChange={e => { if (isDecimal(e.target.value)) setCoPayAmt(e.target.value) }} />
                <select className="cbill-form-input" style={{ width: 110, flexShrink: 0 }} value={coPayType} onChange={e => setCoPayType(e.target.value)}>
                  <option value="">Select</option>
                  <option value="P">Percent</option>
                  <option value="F">Fixed</option>
                </select>
              </div>
            )}
          </div>
          <div className="cbill-form-field">
            <label className="cbill-form-label">Non-Covered / Non-Medical Expenses</label>
            <input type="text" className="cbill-form-input" placeholder="Non-Covered / Non-Medical Expenses" value={nonCovered}
              onChange={e => { if (isDecimal(e.target.value)) setNonCovered(e.target.value) }} />
          </div>
        </div>
        <div className="cbill-form-row">
          <div className="cbill-form-field cbill-form-field--full">
            <label className="cbill-form-label">Final Approval Remarks</label>
            <textarea className="cbill-form-input cbill-textarea" placeholder="Final Approval Remarks" rows={3}
              value={finalRemarks} onChange={e => setFinalRemarks(e.target.value)} />
          </div>
        </div>
      </Section>

      {/* ── 4. ICD Details ── */}
      <Section title="ICD Details" icon="fas fa-diagnoses" defaultOpen={false}>
        <EntryGrid
          columns={[
            { key: 'level1', label: 'First Level Description',  required: true  },
            { key: 'level2', label: 'Second Level Description', required: true  },
            { key: 'level3', label: 'Third Level Description',  required: false },
            { key: 'level4', label: 'Fourth Level Description', required: false },
          ]}
          rows={icdRows}
          onAdd={r  => setIcdRows(p => [...p, r])}
          onDelete={id => setIcdRows(p => p.filter(r => r.id !== id))}
          addLabel="Add ICD"
        />
      </Section>

      {/* ── 5. CPT Details ── */}
      <Section title="CPT Details" icon="fas fa-procedures" defaultOpen={false}>
        <EntryGrid
          columns={[
            { key: 'cptCode', label: 'CPT Code',        required: true },
            { key: 'cptDesc', label: 'CPT Description', required: true },
          ]}
          rows={cptRows}
          onAdd={r  => setCptRows(p => [...p, r])}
          onDelete={id => setCptRows(p => p.filter(r => r.id !== id))}
          addLabel="Add CPT"
        />
      </Section>

      {/* ── 6. DRG Details ── */}
      <Section title="DRG Details" icon="fas fa-hospital-alt" defaultOpen={false}>
        <EntryGrid
          columns={[
            { key: 'drgCode', label: 'DRG Code',        required: true  },
            { key: 'drgDesc', label: 'DRG Description', required: true  },
            { key: 'drgType', label: 'DRG Type',        required: false },
          ]}
          rows={drgRows}
          onAdd={r  => setDrgRows(p => [...p, r])}
          onDelete={id => setDrgRows(p => p.filter(r => r.id !== id))}
          addLabel="Add DRG"
        />
      </Section>

      {/* ── Action buttons ── */}
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div className="cbill-btn-panel">
          <button className="btn-gradient" onClick={handleSubmit}>
            <i className="fas fa-save"></i>&nbsp; Submit
          </button>
          <button className="btn-outline" onClick={() => window.alert('Final Authorization Letter — available in live version.')}>
            <i className="fas fa-file-signature"></i>&nbsp; Final Authorization Letter
          </button>
          <button className="btn-outline" onClick={() => navigate(`/accounts/invoice?claimNo=${encodeURIComponent(claimNo)}`)}>
            <i className="fas fa-file-invoice"></i>&nbsp; View Invoice
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   ROOT COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function CaseBillEntry() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const claimNo  = params.get('claimNo')  || ''
  const memberId = params.get('memberId') || ''

  const [phase,    setPhase]    = useState('entry')
  const [form,     setFormRaw]  = useState(emptyForm())
  const [errors,   setErrors]   = useState({})
  const [editId,   setEditId]   = useState(null)
  const [bills,    setBills]    = useState([])
  const [recon,    setRecon]    = useState({})
  const reconRef               = useRef(null)
  const processRef             = useRef(null)

  function setField(key, val) {
    setFormRaw(p => ({ ...p, [key]: val }))
    setErrors(p => ({ ...p, [key]: '' }))
  }
  function handleAmtChange(e) { if (isDecimal(e.target.value)) setField('billAmt', e.target.value) }
  function onAmtBlur() {
    if (form.billAmt && !isNaN(parseFloat(form.billAmt))) setField('billAmt', parseFloat(form.billAmt).toFixed(2))
  }

  function validate() {
    const errs = {}
    if (!form.billNo.trim())  errs.billNo     = 'Bill Number is required.'
    if (!form.billDate)       errs.billDate   = 'Bill Date is required.'
    if (!form.billHeader)     errs.billHeader = 'Bill Header is required.'
    if (!form.billAmt.trim()) errs.billAmt    = 'Bill Amount is required.'
    else if (isNaN(parseFloat(form.billAmt)) || parseFloat(form.billAmt) <= 0) errs.billAmt = 'Enter a valid amount.'
    return errs
  }

  function handleAddOrUpdate() {
    const errs = validate(); setErrors(errs)
    if (Object.keys(errs).length) return
    const amt   = parseFloat(form.billAmt).toFixed(2)
    const entry = { id: editId ?? Date.now(), billNo: form.billNo.trim(), billDate: form.billDate, billHeader: form.billHeader, billAmt: amt, currency: form.currency, billRemarks: form.billRemarks.trim() }
    if (editId !== null) { setBills(prev => prev.map(b => b.id === editId ? entry : b)); setEditId(null) }
    else                 { setBills(prev => [...prev, entry]) }
    setFormRaw(emptyForm()); setErrors({})
  }

  function handleEdit(bill) {
    setEditId(bill.id)
    setFormRaw({ billNo: bill.billNo, billDate: bill.billDate, billHeader: bill.billHeader, billAmt: bill.billAmt, currency: bill.currency, billRemarks: bill.billRemarks })
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelEdit() { setEditId(null); setFormRaw(emptyForm()); setErrors({}) }

  function handleRemove(id) {
    if (editId === id) handleCancelEdit()
    setBills(prev => prev.filter(b => b.id !== id))
  }

  function handleSaveAndContinue() {
    const initRecon = {}
    bills.forEach(b => { initRecon[b.id] = { deductible: '0.00', approval: parseFloat(b.billAmt).toFixed(2) } })
    setRecon(initRecon)
    setPhase('reconciliation')
    setTimeout(() => reconRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  function handleReconSave() { window.alert('Bill Reconciliation Saved Successfully!') }

  function handleFreeze() {
    if (!window.confirm('Once Data Is Frozen You Cannot Change Bill Reconciliation Data. Do You Want To Continue?')) return
    setPhase('frozen')
    setTimeout(() => processRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header-banner" style={{ marginBottom: 16 }}>
        <h2>Case Bill Entry</h2>
      </div>

      {/* Phase 1 — entry form + bill list */}
      {phase === 'entry' && (
        <BillEntrySection
          claimNo={claimNo} memberId={memberId}
          form={form} setField={setField} errors={errors}
          isEditing={editId !== null} editId={editId} bills={bills}
          onAddOrUpdate={handleAddOrUpdate} onEdit={handleEdit}
          onCancelEdit={handleCancelEdit} onRemove={handleRemove}
          onAmtBlur={onAmtBlur} handleAmtChange={handleAmtChange}
          onSaveAndContinue={handleSaveAndContinue}
        />
      )}

      {/* Phase 2 — reconciliation only */}
      {phase === 'reconciliation' && (
        <div ref={reconRef}>
          <ReconciliationSection bills={bills} claimNo={claimNo} recon={recon} setRecon={setRecon} frozen={false} />
          <div className="panel-card" style={{ marginBottom: 16 }}>
            <div className="cbill-btn-panel">
              <button className="btn-gradient" onClick={handleReconSave}>
                <i className="fas fa-save"></i>&nbsp; Save
              </button>
              <button className="btn-gradient" style={{ background: 'linear-gradient(135deg,#b91c1c,#ef4444)' }} onClick={handleFreeze}>
                <i className="fas fa-lock"></i>&nbsp; Freeze
              </button>
              <button className="btn-outline" onClick={() => navigate('/accounts/casebilldetails')}>
                <i className="fas fa-arrow-left"></i>&nbsp; Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 3 — frozen recon + case process form */}
      {phase === 'frozen' && (
        <>
          <ReconciliationSection bills={bills} claimNo={claimNo} recon={recon} setRecon={setRecon} frozen={true} />
          <div ref={processRef}>
            <CaseProcessForm claimNo={claimNo} memberId={memberId} />
          </div>
        </>
      )}
    </div>
  )
}
