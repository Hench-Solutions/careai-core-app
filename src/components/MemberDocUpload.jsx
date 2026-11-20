import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getMemberDocPage, uploadDocument, submitMemberDocs } from '../utils/api'
import ValidationModal from './ValidationModal'

/**
 * MemberDocUpload — public member document upload page.
 * URL: /documents?claimNo=CLM...&token=xxx
 *
 * Flow:
 *  1. Load page → validate token → show query list
 *  2. Member picks a file per row (Browse only, no per-row Upload)
 *  3. Submit (always enabled) → validate all files selected → upload all → status 303 → email 112 → thank-you
 */

const ALLOWED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png']
const MAX_MB       = 5

/* ── Main component ───────────────────────────────────────────────────────── */
export default function MemberDocUpload() {
  const [searchParams] = useSearchParams()
  const claimNo = searchParams.get('claimNo') || ''
  const token   = searchParams.get('token')   || ''

  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [pageError,  setPageError]  = useState('')
  const [files,      setFiles]      = useState({})        // queryCd → File
  const [fileErrors, setFileErrors] = useState({})        // queryCd → error string
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [modalMsgs,  setModalMsgs]  = useState([])

  useEffect(() => {
    if (!claimNo || !token) {
      setPageError('Invalid or missing link. Please contact the case manager.')
      setLoading(false)
      return
    }
    getMemberDocPage(claimNo, token)
      .then(result => {
        if (!result || !result.isTokenValid) {
          setPageError('This link is invalid. Please contact the case manager.')
        } else if (result.isExpired) {
          setPageError('This link has expired. Please contact the case manager for a new link.')
        } else {
          setData(result)
        }
      })
      .catch(() => setPageError('Unable to load page. Please try again later.'))
      .finally(() => setLoading(false))
  }, [claimNo, token])

  function handleFileChange(queryCd, e) {
    const f = e.target.files[0]
    if (!f) return

    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXTS.includes(ext)) {
      setFileErrors(prev => ({ ...prev, [queryCd]: `Only ${ALLOWED_EXTS.join(', ')} files allowed.` }))
      e.target.value = ''
      return
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFileErrors(prev => ({ ...prev, [queryCd]: `File must not exceed ${MAX_MB} MB.` }))
      e.target.value = ''
      return
    }
    setFiles(prev => ({ ...prev, [queryCd]: f }))
    setFileErrors(prev => ({ ...prev, [queryCd]: '' }))
  }

  function clearFile(queryCd, inputRef) {
    setFiles(prev => { const next = { ...prev }; delete next[queryCd]; return next })
    setFileErrors(prev => ({ ...prev, [queryCd]: '' }))
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleSubmit() {
    const items = data?.queryItems || []
    if (!items.length) return

    // Validate all files selected
    const missing = items.filter(i => !files[i.queryCd])
    if (missing.length > 0) {
      setModalMsgs([
        'Please select files for all required documents:',
        ...missing.map(m => `• ${m.queryText}`)
      ])
      return
    }

    setSubmitting(true)
    try {
      // Upload all files sequentially
      for (const item of items) {
        const file = files[item.queryCd]
        await uploadDocument({ moduleCd: 'LEAD', referenceCd: claimNo, memberId: data.memberId || '', docTypeCd: item.queryCd, docTypeNm: item.queryText, file, auth: false })
      }
      // Submit → status 303 + email 112
      await submitMemberDocs({ token, claimNo, memberId: data.memberId || '' })
      setSubmitted(true)
    } catch (err) {
      setModalMsgs([err.message || 'Something went wrong. Please try again.'])
    } finally {
      setSubmitting(false)
    }
  }

  // ── Screens ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="message-wrapper"><div className="message-container">
      <div className="thank-you-card">
        <i className="fas fa-spinner fa-spin" style={{ fontSize: 40, color: '#632da7' }}></i>
        <p style={{ marginTop: 16, color: '#718096', fontSize: 18 }}>Loading document upload page...</p>
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
        <h1 className="thank-you-heading">Documents Submitted!</h1>
        <p className="thank-you-text">
          Thank you for uploading the required documents. Our team will review them shortly.
        </p>
      </div>
    </div></div>
  )

  const lead  = data?.lead
  const items = data?.queryItems || []
  const fullName = lead
    ? [lead.firstName, lead.middleName, lead.lastName].filter(Boolean).join(' ')
    : (data?.fullName || '')

  return (
    <div className="quotation-container">
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="common-header">
        <div className="common-header-content">
          <div className="common-header-title-wrapper">
            <h2 className="common-header-title">Document Upload</h2>
          </div>
        </div>
      </div>

      {/* ── Patient info card ─────────────────────────────────────────────── */}
      <div className="patient-info-card">
        <h2 className="patient-info-header">
          <i className="fas fa-user-circle"></i> Patient Information
        </h2>
        <div className="patient-details-grid">
          <div className="patient-detail-item">
            <div className="patient-detail-label">Insurer / Entity</div>
            <div className="patient-detail-value">{lead?.insurerNm || '—'}</div>
          </div>
          <div className="patient-detail-item">
            <div className="patient-detail-label">Full Name</div>
            <div className="patient-detail-value">{fullName || '—'}</div>
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
            <div className="patient-detail-label">Payment Mode</div>
            <div className="patient-detail-value">{lead?.paymentModeNm || '—'}</div>
          </div>
          <div className="patient-detail-item">
            <div className="patient-detail-label">Treatment Type</div>
            <div className="patient-detail-value">{lead?.treatmentTypeNm || '—'}</div>
          </div>
        </div>
      </div>

      {/* ── Instruction ───────────────────────────────────────────────────── */}
      <div className="ea-instruction">
        <i className="fas fa-info-circle"></i>&nbsp;
        Please select all required documents using the Browse button.
        Click <strong>Submit Documents</strong> to upload them all at once.&nbsp;
        Allowed formats: <strong>PDF, JPG, PNG</strong> &nbsp;|&nbsp; Max size: <strong>5 MB</strong> per file.
      </div>

      {/* ── Document rows ─────────────────────────────────────────────────── */}
      <div className="mdu-list">
        {items.length === 0 ? (
          <div className="ec-empty">
            <i className="fas fa-inbox" style={{ fontSize: 32, marginBottom: 8, display: 'block' }}></i>
            No document requests found. Please contact the case manager.
          </div>
        ) : (
          items.map((item, idx) => (
            <DocRow
              key={item.queryCd || idx}
              item={item}
              file={files[item.queryCd] || null}
              error={fileErrors[item.queryCd] || ''}
              onFileChange={e => handleFileChange(item.queryCd, e)}
              onClear={inputRef => clearFile(item.queryCd, inputRef)}
            />
          ))
        )}
      </div>

      {/* ── Submit button ─────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="generate-estimates-display-button-container">
          <button
            className="MedicaltourismProceedforEstimate__btn MedicaltourismProceedforEstimate__btn--submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Uploading &amp; Submitting…</>
              : <><i className="fas fa-paper-plane"></i>&nbsp;Submit Documents</>
            }
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Single document row ──────────────────────────────────────────────────── */
function DocRow({ item, file, error, onFileChange, onClear }) {
  const fileRef = useRef()

  return (
    <div className={`mdu-row ${file ? 'mdu-row--selected' : ''}`}>
      <div className="mdu-row-info">
        <div className="mdu-doc-name">
          <i className={`fas ${file ? 'fa-check-circle mdu-icon--done' : 'fa-file-alt mdu-icon--pending'}`}></i>
          &nbsp;{item.queryText}
        </div>
        {item.queryFreeText && (
          <div className="mdu-doc-remark">{item.queryFreeText}</div>
        )}
      </div>

      <div className="mdu-row-upload">
        <div className="ti-file-pick">
          <button
            type="button"
            className="ti-file-btn"
            onClick={() => fileRef.current.click()}
          >
            <i className="fas fa-paperclip"></i>&nbsp;
            {file ? file.name : 'Browse'}
          </button>
          {file && (
            <button
              type="button"
              className="ti-file-clear"
              onClick={() => onClear(fileRef)}
              title="Remove"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
        </div>
        {error && (
          <div className="mdu-row-error">
            <i className="fas fa-exclamation-circle"></i>&nbsp;{error}
          </div>
        )}
      </div>
    </div>
  )
}
