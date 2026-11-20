import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getLeadByEstimateToken, submitProviderAction, fetchDocumentBlob } from '../utils/api'
import { authUtils } from '../utils/auth'
import ValidationModal from './ValidationModal'

// ── Status codes — app side owns these, never hardcoded in the API ──────────
const STATUS_PROVIDER_ACCEPTED = 317
const STATUS_PROVIDER_DECLINED = 317

// MT_Document codes for the "medical" document types (Doc_Category is NULL for
// both on this master, so the codes are listed explicitly) — confirmed with
// the client: only these should show on the provider's Case Estimation page,
// not every document uploaded for the lead (e.g. ID/passport).
const MEDICAL_DOC_CODES = ['309', '316']

/**
 * LeadEstimateReq — Reusable component (mirrors lead_estimate_req.ascx from Med_Tour).
 *
 * Can be rendered in 2 contexts:
 *  1. Public  — /estimate-req?token=xxx          (provider via email link, no login)
 *  2. Private — /leads/estimate-req?token=xxx    (executive acting on behalf)
 *
 * Single component, single point of change — same as user control pattern.
 * StatusCd is defined here (app side) and passed to the API — never hardcoded in the API layer.
 */
export default function LeadEstimateReq() {
  const [searchParams]  = useSearchParams()
  const navigate        = useNavigate()
  const token           = searchParams.get('token') || ''
  const isLoggedIn      = authUtils.isLoggedIn()
  const currentUser     = isLoggedIn ? authUtils.getUser() : null

  const [data,          setData]         = useState(null)
  const [loading,       setLoading]      = useState(true)
  const [pageError,     setPageError]    = useState('')

  // UI state
  const [showDecline,   setShowDecline]  = useState(false)
  const [declineReason, setDeclineReason]= useState('')
  const [submitting,    setSubmitting]   = useState(false)
  const [submitted,     setSubmitted]    = useState(false)
  const [submitMsg,     setSubmitMsg]    = useState('')
  const [submitOk,      setSubmitOk]     = useState(false)
  const [modalMsgs,     setModalMsgs]    = useState([])

  useEffect(() => {
    if (!token) {
      setPageError('Invalid or missing link. Please use the link provided in the email.')
      setLoading(false)
      return
    }
    loadData()
  }, [token])

  useEffect(() => {
    if (!submitted || !submitOk || !isLoggedIn) return
    const t = setTimeout(() => navigate('/leads/search', { replace: true }), 1500)
    return () => clearTimeout(t)
  }, [submitted, submitOk])

  async function loadData() {
    try {
      const result = await getLeadByEstimateToken(token)
      if (!result || !result.isTokenValid) {
        setPageError('This link is invalid. Please contact the case manager.')
      } else if (result.isExpired) {
        setPageError('This link has expired. Please contact the case manager for a new link.')
      } else if (result.isUsed) {
        setPageError('This link has already been used and is no longer valid.')
      } else if (result.leadAcceptance === 1) {
        // Already accepted — redirect straight to estimate form
        const cuPath = isLoggedIn ? `/leads/estimate-cu?token=${token}` : `/estimate-cu?token=${token}`
        navigate(cuPath, { replace: true })
      } else {
        setData(result)
      }
    } catch {
      setPageError('Unable to load case details. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(action) {
    if (action === 2 && !declineReason.trim()) {
      setModalMsgs(['Please enter a reason for declining.'])
      return
    }
    setSubmitting(true)
    try {
      await submitProviderAction({
        token,
        claimNo:          data.lead?.claimNo  || '',
        memberId:         data.lead?.memberId || '',
        prvCd:            data.prvCd          || '',
        action,
        declineReason:    action === 2 ? declineReason : '',
        statusCd:         action === 1 ? STATUS_PROVIDER_ACCEPTED : STATUS_PROVIDER_DECLINED,
        statusRemarks:    action === 1
          ? (isLoggedIn ? 'Case Accepted by Portal Executive' : 'Case Accepted by Provider')
          : (isLoggedIn ? 'Case Declined by Portal Executive' : 'Case Declined by Provider'),
        caseManagerEmail: data.lead?.caseManagerEmail || '',
        updatedBy:        isLoggedIn ? (currentUser?.user_Id        || 0)  : 0,
        updatedByNm:      isLoggedIn ? (currentUser?.user_Full_Name || '') : '',
      })
      if (action === 1) {
        // Accept — redirect to estimate form to fill details
        const cuPath = isLoggedIn ? `/leads/estimate-cu?token=${token}` : `/estimate-cu?token=${token}`
        navigate(cuPath, { replace: true })
        return
      }
      // Decline success
      setSubmitOk(true)
      setSubmitMsg(isLoggedIn ? 'Case declined successfully.' : 'Your response has been submitted successfully. Thank you!')
      setSubmitted(true)
    } catch {
      setSubmitMsg('Something went wrong. Please try again.')
      setSubmitOk(false)
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  async function openDocument(fileName) {
    try {
      const blob = await fetchDocumentBlob(data.lead.claimNo, fileName)
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch {
      setModalMsgs(['Unable to open document.'])
    }
  }

  function getFileIcon(fileName) {
    const ext = (fileName || '').split('.').pop().toLowerCase()
    switch (ext) {
      case 'pdf':              return 'fas fa-file-pdf'
      case 'doc': case 'docx': return 'fas fa-file-word'
      case 'jpg': case 'jpeg':
      case 'png': case 'bmp': return 'fas fa-file-image'
      default:                 return 'fas fa-file'
    }
  }

  // ── Already responded ────────────────────────────────────────────────────
  const alreadyResponded = data && data.leadAcceptance > 0 && !submitted

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="message-wrapper">
        <div className="message-container">
          <div className="thank-you-card">
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 40, color: '#632da7' }}></i>
            <p style={{ marginTop: 16, color: '#718096', fontSize: 18 }}>Loading case details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (pageError) {
    return (
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
  }

  const lead = data?.lead

  // ── Medical documents only — lead.documents carries every document type
  // uploaded for the lead (ID/passport, discharge docs, etc.); the provider
  // review page should only show the medical ones.
  const medicalDocs = (lead?.documents ?? []).filter(d => MEDICAL_DOC_CODES.includes(d.docCd))

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
              stroke="url(#lergradient)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="lergradient" x1="3" y1="2.944" x2="21" y2="20.622">
                <stop stopColor="#667eea" />
                <stop offset="1" stopColor="#764ba2" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="title">Case Estimation</div>
        <div className="subtitle">Please fill all the necessary information to share estimate</div>
      </div>

      {/* ── Patient Information ──────────────────────────────────────────── */}
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

      {/* ── Main container ──────────────────────────────────────────────── */}
      <div className="main-medical-container">

        {/* Medical Reports */}
        <div className="reports-medical-section">
          <div className="title-medical-section">
            <i className="fas fa-file-medical"></i> Medical Reports
          </div>
          <div className="uploaded-files">
            {medicalDocs.length > 0
              ? medicalDocs.map((doc, i) => (
                  <div
                    key={i}
                    className="file-box"
                    onClick={() => openDocument(doc.fileName)}
                    title={isLoggedIn ? 'Click to open' : 'Login required to download'}
                    style={{ cursor: isLoggedIn ? 'pointer' : 'default' }}
                  >
                    <i className={getFileIcon(doc.fileName)}></i>
                    <span>{doc.fileName}</span>
                    {!isLoggedIn && (
                      <i className="fas fa-lock" style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}></i>
                    )}
                  </div>
                ))
              : <p style={{ color: '#999', fontSize: 13 }}>No documents uploaded.</p>
            }
          </div>
        </div>

        {/* ── Already responded notice ──────────────────────────────────── */}
        {alreadyResponded && (
          <div className="container-action-buttons">
            <div
              style={{
                padding: '16px 20px',
                background: data.leadAcceptance === 1 ? '#f0fdf4' : '#fff5f5',
                border: `1px solid ${data.leadAcceptance === 1 ? '#bbf7d0' : '#fecaca'}`,
                borderRadius: 8,
                color: data.leadAcceptance === 1 ? '#166534' : '#991b1b',
                fontSize: 15,
                fontWeight: 500
              }}
            >
              <i className={`fas ${data.leadAcceptance === 1 ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
              &nbsp;
              {data.leadAcceptance === 1
                ? 'You have already accepted this case.'
                : `You have already declined this case. Reason: ${data.declineReason}`}
            </div>
          </div>
        )}

        {/* ── Thank you / error after submission ────────────────────────── */}
        {submitted && submitOk && (
          <div className="message-wrapper" style={{ minHeight: 'auto', padding: '20px 0' }}>
            <div className="message-container">
              <div className="thank-you-card">
                <div className="thank-you-checkmark">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h1 className="thank-you-heading">SUCCESS!</h1>
                <p className="thank-you-text">Thank you for your response. We will get back to you soon.</p>
                <p className="thank-you-subtext">You can close this window.</p>
              </div>
            </div>
          </div>
        )}
        {submitted && !submitOk && (
          <div className="container-action-buttons">
            <div style={{ padding: '16px 20px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 15, fontWeight: 500 }}>
              <i className="fas fa-exclamation-circle"></i>&nbsp;{submitMsg}
            </div>
          </div>
        )}

        {/* ── Decline reason form ───────────────────────────────────────── */}
        {showDecline && !submitted && !alreadyResponded && (
          <div className="container-decline-reason">
            <div className="title-decline-form">
              <i className="fas fa-exclamation-triangle"></i>
              Reason for Declining Case
            </div>
            <textarea
              className="textarea-reason-decline"
              placeholder="Please provide a detailed reason for declining this case..."
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
            />
            <div className="decline-btn-wrapper">
              <button
                className="btn-submit-decline"
                onClick={() => handleAction(2)}
                disabled={submitting}
              >
                <i className="fas fa-paper-plane"></i>
                {submitting ? ' Submitting...' : ' Submit Decline Reason'}
              </button>
              <button
                className="btn-submit-decline black-btn"
                onClick={() => { setShowDecline(false); setDeclineReason('') }}
                disabled={submitting}
              >
                <i className="fas fa-arrow-left"></i> Back
              </button>
            </div>
          </div>
        )}

        {/* ── Action buttons ────────────────────────────────────────────── */}
        {!showDecline && !submitted && !alreadyResponded && (
          <div className="container-action-buttons">
            <div className="buttons-action-medical">

              {/* Additional Info — shown only for logged-in executives */}
              {isLoggedIn && (
                <button
                  type="button"
                  className="btn-action-medical btn-info-medical"
                  onClick={() => navigate(`/leads/query?claimNo=${lead?.claimNo || ''}`)}
                >
                  <i className="fas fa-info-circle"></i>
                  Additional Information Required
                </button>
              )}

              <button
                type="button"
                className="btn-action-medical btn-accept-medical"
                onClick={() => handleAction(1)}
                disabled={submitting}
              >
                <i className="fas fa-check-circle"></i>
                {submitting ? 'Submitting...' : 'Accept Case'}
              </button>

              <button
                type="button"
                className="btn-action-medical btn-decline-medical"
                onClick={() => setShowDecline(true)}
                disabled={submitting}
              >
                <i className="fas fa-times-circle"></i>
                Decline Case
              </button>

            </div>
          </div>
        )}

      </div>

      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />
    </div>
  )
}
