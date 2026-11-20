import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getEstimateAcceptance,
  addTraveller,
  deleteTraveller,
  fetchTravellers,
  uploadDocument,
  openDocument,
  submitTravelInfo,
  fetchMasterItems,
} from '../utils/api'
import { authUtils } from '../utils/auth'
import ValidationModal from './ValidationModal'

/**
 * TravelInfo — mirrors travel_cu.ascx from Med_Tour.
 * Public page (no auth) — member fills travel + VISA details after accepting estimate.
 *
 * Rules:
 * - Patient info (name/mobile/email/dob/nationality) auto-filled from lead when type=Patient
 * - Patient can be added only once
 * - Each Add saves to DB immediately
 * - GOP fields persist across Add clicks (shared for all travellers)
 * - GOP card visible only for insurance payment mode
 * - GOP fields + document mandatory when card is visible
 * - Submit → confirmation → status 318 → email 116 → IsUsed=1 → thank-you
 */

const STATUS_TRAVEL  = 318
const REMARKS_TRAVEL = 'Travel Data Submitted'

const EMPTY_TRAVELLER_ROW = {
  traveller  : 'P',
  fullNm     : '',
  passportNo : '',
  nationality: '',
  dob        : '',
  travelDt   : '',
  mobileNo   : '',
  emailId    : '',
  address    : '',
}

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

/* ── File pick ────────────────────────────────────────────────────────────── */
function FilePick({ label, file, onChange, accept = '.pdf,.jpg,.jpeg,.png', disabled }) {
  const ref = useRef()
  return (
    <div className="ti-file-pick">
      <button
        type="button"
        className="ti-file-btn"
        onClick={() => ref.current.click()}
        disabled={disabled}
      >
        <i className="fas fa-paperclip"></i>&nbsp;
        {file ? file.name : label}
      </button>
      {file && !disabled && (
        <button type="button" className="ti-file-clear" onClick={() => onChange(null)} title="Remove">
          <i className="fas fa-times"></i>
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={e => onChange(e.target.files[0] || null)}
      />
    </div>
  )
}

export default function TravelInfo() {
  const [searchParams] = useSearchParams()
  const token     = searchParams.get('token')     || ''
  const claimNo   = searchParams.get('claimNo')   || ''
  const memberId  = searchParams.get('memberId')  || ''
  const requestNo = searchParams.get('requestNo') || ''
  const prvCd     = searchParams.get('prvCd')     || ''

  const isLoggedIn  = authUtils.isLoggedIn()
  const currentUser = isLoggedIn ? authUtils.getUser() : null

  // ── Page state ─────────────────────────────────────────────────────────────
  const [lead,        setLead]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [pageError,   setPageError]   = useState('')
  const [isInsurance, setIsInsurance] = useState(false)

  // ── GOP card (shared, persists across Add clicks) ──────────────────────────
  const [gop,          setGop]          = useState({ policyEndDt: '', coPay: '', exclusion: '', treatmentCost: '', prvNm: '', currency: '', approvedAmount: '', approvedCurrency: '' })
  const [gopFile,      setGopFile]      = useState(null)
  const [currencyOptions, setCurrencyOptions] = useState([])

  // ── Traveller entry form ───────────────────────────────────────────────────
  const [row,          setRow]          = useState({ ...EMPTY_TRAVELLER_ROW })
  const [passportFile, setPassportFile] = useState(null)
  const [adding,       setAdding]       = useState(false)
  const [patientAdded, setPatientAdded] = useState(false)

  // ── Added list ─────────────────────────────────────────────────────────────
  const [travellers, setTravellers] = useState([])

  // ── Submit ─────────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [modalMsgs,  setModalMsgs]  = useState([])
  const [confirmCfg, setConfirmCfg] = useState(null)

  useEffect(() => {
    fetchMasterItems('Currency').then(setCurrencyOptions).catch(() => setCurrencyOptions([]))
  }, [])

  // ── Load page: token validation + lead data ────────────────────────────────
  useEffect(() => {
    if (!token || !claimNo || !memberId) {
      setPageError('Invalid or missing link. Please contact the case manager.')
      setLoading(false)
      return
    }
    getEstimateAcceptance(token, claimNo)
      .then(result => {
        if (!result || !result.isTokenValid) {
          setPageError('This link is invalid. Please contact the case manager.')
        } else if (result.isExpired) {
          setPageError('This link has expired. Please contact the case manager for a new link.')
        } else if (result.isUsed) {
          setPageError('used')
        } else {
          const ld = result.lead
          setLead(ld)
          const pmNm = ld?.paymentModeNm?.toLowerCase() || ''
          setIsInsurance(pmNm.includes('insur'))
          // Pre-fill treatment cost from the accepted estimate row
          const acceptedEst = (result.sharedEstimates || []).find(r => r.isEstAccepted === 1)
          if (acceptedEst) {
            setGop(g => ({
              ...g,
              prvNm        : acceptedEst.prvNm         || '',
              currency     : acceptedEst.currency       || '',
              treatmentCost: acceptedEst.treatmentCost ? String(acceptedEst.treatmentCost) : '',
            }))
          }
          // Pre-fill patient row from lead
          prefillPatient(ld)

          // Load any travellers already saved in a previous session
          fetchTravellers(claimNo, token).then(existing => {
            if (!Array.isArray(existing) || existing.length === 0) return
            setTravellers(existing.map(t => ({
              id             : t.id,
              traveller      : t.traveller,
              fullNm         : t.fullNm,
              passportNo     : t.passportNo,
              nationality    : t.nationality,
              dob            : t.dob,
              travelDt       : t.travelDt,
              mobileNo       : t.mobileNo,
              emailId        : t.emailId,
              address        : '',
              passportDocId  : t.passportDocId || 0,
            })))
            const hasPatient = existing.some(t => t.traveller === 'P')
            if (hasPatient) {
              setPatientAdded(true)
              setRow({ ...EMPTY_TRAVELLER_ROW, traveller: 'A' })
            }
          }).catch(() => {})
        }
      })
      .catch(() => setPageError('Unable to load details. Please try again later.'))
      .finally(() => setLoading(false))
  }, [token, claimNo, memberId])

  // Pre-fill traveller row from lead (Patient type)
  function prefillPatient(ld) {
    if (!ld) return
    const fullNm = [ld.firstName, ld.middleName, ld.lastName].filter(Boolean).join(' ')
    setRow(r => ({
      ...r,
      traveller  : 'P',
      fullNm     : fullNm,
      nationality: ld.nationalityNm || ld.nationality || '',
      dob        : ld.dob           || '',
      mobileNo   : ld.mobileNo      || '',
      emailId    : ld.emailId       || '',
      passportNo : (ld.documentType === 'DT0001' ? ld.documentNo : '') || '',
    }))
  }

  // When traveller type changes — auto-fill patient data or clear
  function handleTravellerTypeChange(type) {
    if (type === 'P') {
      prefillPatient(lead)
    } else {
      // Attendant — clear personal fields but keep travelDt/passportNo/address
      setRow(r => ({
        ...r,
        traveller  : 'A',
        fullNm     : '',
        nationality: '',
        dob        : '',
        mobileNo   : '',
        emailId    : '',
        passportNo : '',
        address    : '',
      }))
    }
  }

  function setGopField(f, v) { setGop(p => ({ ...p, [f]: v })) }
  function setField(f, v)    { setRow(p => ({ ...p, [f]: v })) }

  // ── GOP file pick — upload happens on Add / Submit ────────────────────────
  function handleGopFileChange(file) {
    setGopFile(file)
  }

  // ── Add Traveller ──────────────────────────────────────────────────────────
  async function handleAddTraveller() {
    const errs = []

    // Patient once only
    if (row.traveller === 'P' && patientAdded) {
      setModalMsgs(['Patient has already been added. Please select Attendant for additional travellers.'])
      return
    }

    // GOP mandatory before any Add (when visible)
    if (isInsurance) {
      if (!gop.policyEndDt) errs.push('Policy End Date is required (GOP).')
      else if (gop.policyEndDt <= new Date().toISOString().split('T')[0]) errs.push('Policy End Date must be a future date.')
      if (!gop.coPay.trim()) errs.push('Co-Pay is required (GOP).')
      if (!gop.exclusion.trim()) errs.push('Exclusions field is required (GOP).')
      if (!gopFile)         errs.push('GOP Document upload is required.')
      if (!gop.approvedCurrency) errs.push('Currency is required (GOP).')
      if (!gop.approvedAmount || parseFloat(gop.approvedAmount) <= 0) errs.push('Approved Amount is required (GOP).')
    }

    // Traveller fields
    if (!row.fullNm.trim())                         errs.push('Full Name is required.')
    if (!row.nationality.trim())                    errs.push('Nationality is required.')
    if (!row.dob)                                   errs.push('Date of Birth is required.')
    if (!row.travelDt)                              errs.push('Expected Travel Date is required.')
    if (!row.mobileNo.trim())                       errs.push('Mobile No is required.')
    else if (!/^\+?[\d\s\-()]{7,20}$/.test(row.mobileNo.trim())) errs.push('Mobile No must contain only digits (e.g. +971501234567).')
    if (row.emailId.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.emailId.trim())) errs.push('Email Address format is invalid.')

    if (errs.length) { setModalMsgs(errs); return }

    setAdding(true)
    try {
      const res   = await addTraveller({
        token, claimNo, requestNo, prvCd,
        traveller  : row.traveller,
        fullNm     : row.fullNm,
        passportNo : row.passportNo,
        nationality: row.nationality,
        dob        : row.dob,
        travelDt   : row.travelDt,
        mobileNo   : row.mobileNo,
        emailId    : row.emailId,
        address    : row.address,
        policyEndDt   : isInsurance ? gop.policyEndDt                      : '',
        coPay         : isInsurance ? gop.coPay                            : '',
        exclusion     : isInsurance ? gop.exclusion                        : '',
        treatmentCost : isInsurance ? (parseFloat(gop.approvedAmount) || 0) : null,
        currencyCd    : isInsurance ? gop.approvedCurrency : '',
      })

      // Surface API-level error if returned (Success errorCode = 0)
      const apiErr = res?.errorObj?.[0]
      if (apiErr && apiErr.errorCode !== 0) {
        setModalMsgs([`Save failed: ${apiErr.errorMessage || 'Unknown error'}`])
        return
      }
      const newId = res?.responseObj ?? 0

      // Upload passport immediately if file picked
      let passportDocId = 0
      if (passportFile && newId) {
        try {
          const pr = await uploadDocument({ moduleCd: 'LEAD', referenceCd: claimNo, memberId, docTypeCd: '322', docTypeNm: 'Passport Copy', file: passportFile, auth: false })
          passportDocId = pr?.docId || 0
        } catch { /* non-fatal */ }
      }

      const wasPatient = row.traveller === 'P'
      if (wasPatient) setPatientAdded(true)

      setTravellers(prev => [...prev, {
        id            : newId,
        traveller     : row.traveller,
        fullNm        : row.fullNm,
        passportNo    : row.passportNo,
        nationality   : row.nationality,
        dob           : row.dob,
        travelDt      : row.travelDt,
        mobileNo      : row.mobileNo,
        emailId       : row.emailId,
        address       : row.address,
        passportDocId,
      }])

      // Clear traveller row — reset to Attendant (patient is done)
      // GOP fields deliberately NOT cleared
      setRow({ ...EMPTY_TRAVELLER_ROW, traveller: 'A' })
      setPassportFile(null)

    } catch (err) {
      setModalMsgs([`Failed to save traveller: ${err?.message || 'Please try again.'}`])
    } finally {
      setAdding(false)
    }
  }

  // ── Delete Traveller ───────────────────────────────────────────────────────
  async function handleDeleteTraveller(idx) {
    setConfirmCfg(null)
    const t = travellers[idx]
    try {
      if (t.id) await deleteTraveller(t.id)
    } catch { /* non-fatal — still remove from UI */ }
    const wasPatient = t.traveller === 'P'
    setTravellers(prev => prev.filter((_, i) => i !== idx))
    if (wasPatient) {
      setPatientAdded(false)
      prefillPatient(lead)
      setRow(r => ({ ...r, traveller: 'P' }))
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmitClick() {
    const errs = []

    if (travellers.length === 0)
      errs.push('Please add at least one traveller before submitting.')

    if (isInsurance) {
      if (!gop.policyEndDt)    errs.push('Policy End Date is required (GOP).')
      else if (gop.policyEndDt <= new Date().toISOString().split('T')[0]) errs.push('Policy End Date must be a future date.')
      if (!gop.coPay.trim())   errs.push('Co-Pay is required (GOP).')
      if (!gop.exclusion.trim()) errs.push('Exclusions field is required (GOP).')
      if (!gopFile)            errs.push('GOP Document upload is required.')
      if (!gop.approvedCurrency) errs.push('Currency is required (GOP).')
      if (!gop.approvedAmount || parseFloat(gop.approvedAmount) <= 0) errs.push('Approved Amount is required (GOP).')
    }

    if (errs.length) { setModalMsgs(errs); return }

    setConfirmCfg({
      message: 'Do you want to submit your travel details? This action cannot be undone.',
      onOk: doSubmit
    })
  }

  async function doSubmit() {
    setConfirmCfg(null)
    setSubmitting(true)
    try {
      // Upload GOP to MT_CaseDocument (docCd=310)
      if (isInsurance && gopFile) {
        try { await uploadDocument({ moduleCd: 'LEAD', referenceCd: claimNo, memberId, docTypeCd: '310', docTypeNm: 'GOP From Insurance (Approval Letter Showing Amount)', file: gopFile, auth: false }) } catch { /* non-fatal */ }
      }

      await submitTravelInfo({
        token,
        claimNo,
        memberId,
        requestNo,
        prvCd,
        statusCd     : STATUS_TRAVEL,
        statusRemarks: REMARKS_TRAVEL,
        updatedBy    : isLoggedIn ? (currentUser?.user_Id        || 0)  : 0,
        updatedByNm  : isLoggedIn ? (currentUser?.user_Full_Name || '') : '',
        travellers   : [],
      })
      setSubmitted(true)
    } catch {
      setModalMsgs(['Something went wrong. Please try again.'])
    } finally {
      setSubmitting(false)
    }
  }

  // ── Screens ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="message-wrapper"><div className="message-container">
      <div className="thank-you-card">
        <i className="fas fa-spinner fa-spin" style={{ fontSize: 40, color: '#632da7' }}></i>
        <p style={{ marginTop: 16, color: '#718096', fontSize: 18 }}>Loading travel form...</p>
      </div>
    </div></div>
  )

  if (pageError === 'used') return (
    <div className="message-wrapper"><div className="message-container">
      <div className="link-expired-card">
        <div className="link-expired-icon">
          <svg viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
        </div>
        <h1 className="link-expired-title">Already Submitted</h1>
        <p className="link-expired-message">Travel details have already been submitted for this case.</p>
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
        <h1 className="thank-you-heading">Travel Details Submitted!</h1>
        <p className="thank-you-text">
          Thank you. Our team will reach out to confirm your travel arrangements.
        </p>
      </div>
    </div></div>
  )

  const fullName = lead
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

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="common-header">
        <div className="common-header-content">
          <div className="common-header-title-wrapper">
            <h2 className="common-header-title">Travel Information</h2>
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
              <div className="patient-detail-label">Payment Mode</div>
              <div className="patient-detail-value">{lead.paymentModeNm || '—'}</div>
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
        Add <strong>Patient</strong> and any <strong>Attendants</strong> travelling.
        Patient details are pre-filled from your profile. Each entry is saved immediately.
        Click <strong>Submit Travel Details</strong> when all travellers are added.
      </div>

      {/* ── GOP card (insurance only) ─────────────────────────────────────── */}
      {isInsurance && (
        <div className="ti-entry-card">
          <div className="ti-entry-header">
            <i className="fas fa-file-medical-alt"></i>&nbsp; Guarantee of Payment (GOP)
            <span className="ti-card-note">Required for all travellers</span>
          </div>
          <div className="lead-form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>

            <div className="lead-form-group">
              <label className="lead-form-label">Provider Accepted</label>
              <input
                type="text"
                className="lead-form-input"
                value={gop.prvNm}
                readOnly
              />
            </div>

            <div className="lead-form-group">
              <label className="lead-form-label">Provider Currency</label>
              <input
                type="text"
                className="lead-form-input"
                value={gop.currency}
                readOnly
              />
            </div>

            <div className="lead-form-group">
              <label className="lead-form-label">Provider's Estimated Amount</label>
              <input
                type="text"
                className="lead-form-input"
                value={gop.treatmentCost || ''}
                readOnly
              />
            </div>

            <div className="lead-form-group">
              <label className="lead-form-label">
                Policy End Date <span className="required-star">*</span>
              </label>
              <input
                type="date"
                className="lead-form-input"
                value={gop.policyEndDt}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setGopField('policyEndDt', e.target.value)}
              />
            </div>

            <div className="lead-form-group">
              <label className="lead-form-label">
                Co-Pay <span className="required-star">*</span>
              </label>
              <input
                type="text"
                className="lead-form-input"
                placeholder="e.g. 10% or 500 USD"
                value={gop.coPay}
                onChange={e => setGopField('coPay', e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="lead-form-group">
              <label className="lead-form-label">
                Exclusions <span className="required-star">*</span>
              </label>
              <textarea
                className="lead-form-textarea"
                placeholder="List any exclusions covered under this GOP..."
                value={gop.exclusion}
                onChange={e => setGopField('exclusion', e.target.value)}
                maxLength={500}
                rows={2}
              />
            </div>

            <div className="lead-form-group">
              <label className="lead-form-label">
                GOP Document <span className="required-star">*</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <FilePick
                  label="Upload GOP Document"
                  file={gopFile}
                  onChange={handleGopFileChange}
                />
                {gopFile && (
                  <span style={{ color: '#632da7', fontSize: 13 }}>
                    <i className="fas fa-check-circle"></i>&nbsp;{gopFile.name}
                  </span>
                )}
              </div>
            </div>

            <div className="lead-form-group">
              <label className="lead-form-label">Currency <span className="required-star">*</span></label>
              <select
                className="lead-form-input"
                value={gop.approvedCurrency}
                onChange={e => setGopField('approvedCurrency', e.target.value)}
              >
                <option value="">-- Select --</option>
                {currencyOptions.map(c => (
                  <option key={c.value} value={c.value}>{c.text}</option>
                ))}
              </select>
            </div>

            <div className="lead-form-group">
              <label className="lead-form-label">Approved Amount <span className="required-star">*</span></label>
              <input
                type="number"
                className="lead-form-input"
                placeholder="0.00"
                value={gop.approvedAmount}
                onChange={e => setGopField('approvedAmount', e.target.value)}
              />
            </div>

          </div>
        </div>
      )}

      {/* ── Travel Details & VISA Request card ────────────────────────────── */}
      <div className="ti-entry-card">
        <div className="ti-entry-header">
          <i className="fas fa-user-plus"></i>&nbsp; Travel Details &amp; VISA Request
          {patientAdded && (
            <span className="ti-card-note ti-card-note--info">
              <i className="fas fa-info-circle"></i>&nbsp;Patient added — adding attendant(s) now
            </span>
          )}
        </div>
        <div className="lead-form-grid">

          {/* Traveller Type */}
          <div className="lead-form-group">
            <label className="lead-form-label">
              Traveller Type <span className="required-star">*</span>
            </label>
            <select
              className={`lead-form-select ${patientAdded && row.traveller === 'P' ? 'input-error' : ''}`}
              value={row.traveller}
              onChange={e => handleTravellerTypeChange(e.target.value)}
            >
              <option value="P" disabled={patientAdded}>
                Patient{patientAdded ? ' (already added)' : ''}
              </option>
              <option value="A">Attendant</option>
            </select>
          </div>

          {/* Full Name */}
          <div className="lead-form-group">
            <label className="lead-form-label">
              Full Name (as on Passport) <span className="required-star">*</span>
            </label>
            <input
              type="text"
              className="lead-form-input"
              placeholder="Full name"
              value={row.fullNm}
              onChange={e => setField('fullNm', e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Passport No */}
          <div className="lead-form-group">
            <label className="lead-form-label">
              Passport No
            </label>
            <input
              type="text"
              className="lead-form-input"
              placeholder="Passport number"
              value={row.passportNo}
              onChange={e => setField('passportNo', e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Nationality */}
          <div className="lead-form-group">
            <label className="lead-form-label">
              Nationality <span className="required-star">*</span>
            </label>
            <input
              type="text"
              className="lead-form-input"
              placeholder="Nationality"
              value={row.nationality}
              onChange={e => setField('nationality', e.target.value)}
              maxLength={100}
            />
          </div>

          {/* DOB */}
          <div className="lead-form-group">
            <label className="lead-form-label">
              Date of Birth <span className="required-star">*</span>
            </label>
            <input
              type="date"
              className="lead-form-input"
              value={row.dob}
              onChange={e => setField('dob', e.target.value)}
            />
          </div>

          {/* Expected Travel Date */}
          <div className="lead-form-group">
            <label className="lead-form-label">
              Expected Travel Date <span className="required-star">*</span>
            </label>
            <input
              type="date"
              className="lead-form-input"
              value={row.travelDt}
              onChange={e => setField('travelDt', e.target.value)}
            />
          </div>

          {/* Mobile No */}
          <div className="lead-form-group">
            <label className="lead-form-label">
              Mobile No <span className="required-star">*</span>
            </label>
            <input
              type="tel"
              className="lead-form-input"
              placeholder="+971501234567"
              value={row.mobileNo}
              onChange={e => {
                // Allow digits, +, spaces, hyphens, parentheses only
                const val = e.target.value.replace(/[^\d\s\+\-()]/g, '')
                setField('mobileNo', val)
              }}
              maxLength={20}
            />
          </div>

          {/* Email */}
          <div className="lead-form-group">
            <label className="lead-form-label">Email Address</label>
            <input
              type="email"
              className="lead-form-input"
              placeholder="Email address"
              value={row.emailId}
              onChange={e => setField('emailId', e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Address */}
          <div className="lead-form-group lead-form-group--full">
            <label className="lead-form-label">Residential Address</label>
            <textarea
              className="lead-form-textarea"
              placeholder="Home address"
              value={row.address}
              onChange={e => setField('address', e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>

          {/* Passport Copy */}
          <div className="lead-form-group lead-form-group--full">
            <label className="lead-form-label">
              Passport Copy
            </label>
            <FilePick
              label="Upload Passport Copy"
              file={passportFile}
              onChange={setPassportFile}
            />
          </div>

        </div>

        {/* Add Traveller button */}
        <div className="ti-add-btn-wrapper">
          <button
            className="ti-add-btn"
            onClick={handleAddTraveller}
            disabled={adding}
          >
            {adding
              ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Saving…</>
              : <><i className="fas fa-plus-circle"></i>&nbsp;Add Traveller</>
            }
          </button>
        </div>

        {/* ── Added travellers list (inside card) ─────────────────────────── */}
        {travellers.length > 0 && (
          <div className="ti-list-section">
            <div className="ti-list-header">
              <i className="fas fa-users"></i>&nbsp; Added Travellers ({travellers.length})
            </div>
            <div className="treatment-plan-table-wrapper">
              <table className="treatment-plan-table ti-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Full Name</th>
                    <th>Passport No</th>
                    <th>Travel Date</th>
                    <th>Address</th>
                    <th>Passport Copy</th>
                    <th>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {travellers.map((t, idx) => (
                    <tr key={t.id || idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <span className={`ti-badge ti-badge--${t.traveller === 'P' ? 'patient' : 'attendant'}`}>
                          {t.traveller === 'P' ? 'Patient' : 'Attendant'}
                        </span>
                      </td>
                      <td>{t.fullNm}</td>
                      <td>{t.passportNo}</td>
                      <td>{t.travelDt}</td>
                      <td className="ti-address-cell">{t.address || '—'}</td>
                      <td>
                        {t.passportDocId
                          ? <span className="ti-upload-ok" style={{ cursor: 'pointer' }} onClick={() => openDocument(t.passportDocId)}>
                              <i className="fas fa-file-alt"></i>&nbsp;View
                            </span>
                          : <span style={{ color: '#aaa', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td>
                        <button
                          className="ti-remove-btn"
                          onClick={() => setConfirmCfg({ message: `Remove ${t.fullNm} from the traveller list?`, onOk: () => handleDeleteTraveller(idx) })}
                          title="Remove traveller"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Submit button ─────────────────────────────────────────────────── */}
      <div className="generate-estimates-display-button-container">
        <button
          className="MedicaltourismProceedforEstimate__btn MedicaltourismProceedforEstimate__btn--submit"
          onClick={handleSubmitClick}
          disabled={submitting}
        >
          {submitting
            ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Submitting…</>
            : <><i className="fas fa-paper-plane"></i>&nbsp;Submit Travel Details</>
          }
        </button>
      </div>
    </div>
  )
}
