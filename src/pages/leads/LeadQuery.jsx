import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLeadByClaimNo, fetchQueryItems, submitLeadQuery } from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'
import PatientInfoCard from '../../components/PatientInfoCard'

/* ═══════════════════════════════════════════════════════════════════════════
   LeadQuery — Request for Additional Information
═══════════════════════════════════════════════════════════════════════════ */
export default function LeadQuery() {
  const navigate        = useNavigate()
  const [params]        = useSearchParams()
  const claimNo         = params.get('claimNo') ?? ''

  const [lead,       setLead]       = useState(null)
  const [queryItems, setQueryItems] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')

  // Form state
  const [checked,       setChecked]       = useState({})   // { itemValue: bool }
  const [freeText,      setFreeText]      = useState({})   // { itemValue: string }
  const [remarks,       setRemarks]       = useState('')
  const [emails,        setEmails]        = useState([])   // [{ email, selected }]
  const [newEmail,      setNewEmail]      = useState('')
  const [newEmailError, setNewEmailError] = useState(false)
  const [whatsApp,      setWhatsApp]      = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [submitError,   setSubmitError]   = useState('')
  const [success,       setSuccess]       = useState(false)
  const [modalMsgs,     setModalMsgs]     = useState([])

  useEffect(() => {
    if (!claimNo) { setError('No Treatment ID provided.'); setLoading(false); return }

    Promise.all([getLeadByClaimNo(claimNo), fetchQueryItems()])
      .then(([leadData, items]) => {
        if (!leadData) { setError('Lead not found.'); return }
        setLead(leadData)
        setQueryItems(items)

        // Pre-populate emails from lead member + agent
        const initEmails = []
        const addEmail = (val) => {
          if (!val || !val.trim()) return
          val.split(',').forEach(x => {
            const t = x.trim()
            if (t && !initEmails.find(em => em.email.toLowerCase() === t.toLowerCase()))
              initEmails.push({ email: t, selected: false })
          })
        }
        addEmail(leadData.emailId)
        addEmail(leadData.agentEmailId)
        setEmails(initEmails)
      })
      .catch(() => setError('Failed to load page data.'))
      .finally(() => setLoading(false))
  }, [claimNo])

  function toggleCheck(value) {
    setChecked(prev => ({ ...prev, [value]: !prev[value] }))
  }

  function handleAddEmail() {
    const e = newEmail.trim()
    if (!e) { setNewEmailError(true); return }
    setNewEmailError(false)
    const emailRx = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
    if (!emailRx.test(e)) { setModalMsgs(['Please enter a valid email address.']); return }
    if (!emails.find(em => em.email.toLowerCase() === e.toLowerCase())) {
      setEmails(prev => [...prev, { email: e, selected: false }])
    }
    setNewEmail('')
  }

  function toggleEmailSelect(idx) {
    setEmails(prev => prev.map((em, i) => i === idx ? { ...em, selected: !em.selected } : em))
  }

  async function handleSubmit() {
    const selectedItems  = queryItems.filter(it => checked[it.value])
    const selectedEmails = emails.filter(em => em.selected).map(em => em.email)

    const errs = []
    if (selectedItems.length === 0)  errs.push('Please select at least one medical document.')
    if (selectedEmails.length === 0) errs.push('Please select at least one email address to send the notification.')
    if (errs.length > 0) { setModalMsgs(errs); return }

    const fullName = [lead.firstName, lead.middleName, lead.lastName].filter(Boolean).join(' ')

    const payload = {
      claimNo,
      memberId:      lead.memberId,
      fullName,
      items: selectedItems.map(it => ({
        queryCd:       it.value,
        queryText:     it.text,
        queryFreeText: freeText[it.value] ?? ''
      })),
      remarks,
      toEmails:     selectedEmails,
      whatsAppNo:   whatsApp,
      statusCd:     302,
      statusRemarks: 'Additional Information Requested'
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      await submitLeadQuery(payload)
      setSuccess(true)
      setTimeout(() => navigate('/leads/search'), 1500)
    } catch {
      setSubmitError('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Shared header ─────────────────────────────────────────────────────── */
  const header = (
    <div className="la-header-wrap">
      <div className="page-header-banner la-header">
        <h2>Request for Additional Information</h2>
        <button
          className="lead-action-back"
          onClick={() => navigate(`/leads/actions?claimNo=${claimNo}`)}
        >
          Back
        </button>
      </div>
    </div>
  )

  if (loading) return (
    <div className="lq-page">
      {header}
      <div className="lead-action-loading"><i className="fas fa-spinner fa-spin"></i> Loading...</div>
    </div>
  )

  if (error || !lead) return (
    <div className="lq-page">
      {header}
      <div className="lead-action-error">{error || 'Lead not found.'}</div>
    </div>
  )

  return (
    <div className="lq-page">
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />

      {header}

      <div className="la-content-wrap">

        {/* ── Patient Info Card ── */}
        <PatientInfoCard lead={lead} />

        {/* ── Document Checklist ── */}
        <div className="doc-upload-wrapper">
          <div className="doc-main-section">
            <div className="doc-header">
              <h2 className="hospital-form-title">
                <i className="fas fa-file-medical"></i> Medical Documents
              </h2>
            </div>
            <div className="doc-column">
              {queryItems.length === 0
                ? <p style={{ fontSize: '13px', color: '#999', padding: '12px 14px' }}>No document items found.</p>
                : queryItems.map(item => (
                  <div
                    key={item.value}
                    className="doc-list-item"
                    onClick={() => toggleCheck(item.value)}
                  >
                    <div className={`doc-checkbox-wrapper${checked[item.value] ? ' active' : ''}`}>
                      <i className="fas fa-check"></i>
                    </div>
                    <div className="doc-item-label">{item.text}</div>
                    <input
                      type="text"
                      className="doc-item-input"
                      placeholder="Additional info..."
                      value={freeText[item.value] ?? ''}
                      onChange={e => setFreeText(prev => ({ ...prev, [item.value]: e.target.value }))}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                ))
              }
            </div>
          </div>

          {/* Remarks */}
          <div className="doc-remarks-section">
            <label className="doc-remarks-label">
              <h3 className="hospital-form-title">
                <i className="fas fa-sticky-note"></i> Special Instructions
              </h3>
            </label>
            <textarea
              className="doc-remarks-input"
              placeholder="Enter any additional information or special instructions..."
              rows={3}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </div>
        </div>

        {/* ── Contacts ── */}
        <div className="main-wrapper-containeremail">
          <div className="contact-split-layout">

            {/* Email Section (70%) */}
            <div className="email-contact-container">
              <h2 className="email-section-header">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email Contacts
              </h2>

              <div className="email-static-selection-box">
                {emails.length === 0 && (
                  <p style={{ fontSize: '13px', color: '#aaa', padding: '10px 14px' }}>No emails loaded.</p>
                )}
                {emails.map((em, i) => (
                  <div key={i} className="email-radio-row">
                    <label className="email-radio-item" onClick={() => toggleEmailSelect(i)}>
                      <div
                        className={`doc-checkbox-wrapper${em.selected ? ' active' : ''}`}
                        style={{ flexShrink: 0 }}
                      >
                        <i className="fas fa-check"></i>
                      </div>
                      <span className="email-text">{em.email}</span>
                    </label>
                  </div>
                ))}
              </div>

              <div className="email-add-new-wrapper">
                <h3>Add Additional Emails</h3>
                <div className="email-input-add-group">
                  <input
                    type="email"
                    className={`email-input${newEmailError ? ' input-mandatory' : ''}`}
                    placeholder="Enter email address..."
                    value={newEmail}
                    onChange={e => { setNewEmail(e.target.value); if (newEmailError) setNewEmailError(false) }}
                    onKeyDown={e => e.key === 'Enter' && handleAddEmail()}
                  />
                  <button
                    type="button"
                    className="email-action-btn email-btn-add-new"
                    onClick={handleAddEmail}
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* WhatsApp Section (30%) */}
            <div className="whatsapp-contact-container">
              <h2 className="email-section-header">
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                WhatsApp
              </h2>
              <div className="whatsapp-inner-content">
                <input
                  type="tel"
                  className="whatsapp-number-input-field"
                  placeholder="Enter WhatsApp Number"
                  value={whatsApp}
                  onChange={e => setWhatsApp(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="doc-action-footer">
            {submitError && <span className="lq-error">{submitError}</span>}
            {success && <span className="lq-success">Detail Saved Successfully and Email Sent.</span>}
            <button
              type="button"
              className="doc-btn doc-btn-reset"
              onClick={() => navigate(`/leads/actions?claimNo=${claimNo}`)}
            >
              <i className="fas fa-redo"></i> Reset
            </button>
            <button
              type="button"
              className="doc-btn doc-btn-submit"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <><i className="fas fa-spinner fa-spin"></i> Submitting...</>
                : (
                  <>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Submit
                  </>
                )
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
