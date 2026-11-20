import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLeadByClaimNo, submitAppointment } from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'
import PatientInfoCard from '../../components/PatientInfoCard'

/**
 * Appointments — mirrors appointment.aspx from Med_Tour.
 * Books a new appointment request for the accepted provider.
 * Status 319 + email event 117 on submit.
 */

export default function Appointments() {
  const navigate     = useNavigate()
  const [params]     = useSearchParams()
  const claimNo      = params.get('claimNo') ?? ''

  const [lead,      setLead]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [modalMsgs, setModalMsgs] = useState([])
  const [confirmCfg,setConfirmCfg]= useState(null)

  const [form, setForm] = useState({
    appFromDt      : '',
    appUptoDt      : '',
    appReqTime     : '',
    preferredDoctor: '',
    remarks        : '',
  })

  useEffect(() => {
    if (!claimNo) { setError('No Treatment ID provided.'); setLoading(false); return }
    getLeadByClaimNo(claimNo)
      .then(data => {
        if (!data) { setError('Lead not found.'); return }
        setLead(data)
      })
      .catch(() => setError('Failed to load lead details.'))
      .finally(() => setLoading(false))
  }, [claimNo])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleSubmitClick() {
    const errs = []
    if (!form.appFromDt)                errs.push('Appointment From Date is required.')
    if (!form.appUptoDt)                errs.push('Appointment To Date is required.')
    else if (form.appFromDt && form.appUptoDt < form.appFromDt)
                                        errs.push('Appointment To Date must be on or after From Date.')
    if (!form.appReqTime)               errs.push('Appointment Time is required.')
    if (errs.length) { setModalMsgs(errs); return }

    setConfirmCfg({
      message: 'Do you want to submit this appointment request?',
      onOk: doSubmit
    })
  }

  async function doSubmit() {
    setConfirmCfg(null)
    setSaving(true)
    try {
      await submitAppointment({
        claimNo,
        memberId       : lead?.memberId ?? '',
        prvCd          : lead?.acceptedPrvCd || lead?.providerCd || '',
        appFromDt      : form.appFromDt,
        appUptoDt      : form.appUptoDt,
        appReqTime     : form.appReqTime,
        preferredDoctor: form.preferredDoctor,
        remarks        : form.remarks,
        statusCd       : 319,
        statusRemarks  : 'Appointment Requested',
      })
      navigate('/leads/search')
    } catch {
      setModalMsgs(['Failed to submit appointment. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  const header = (
    <div className="common-header">
      <div className="common-header-content">
        <div className="common-header-title-wrapper">
          <h2 className="common-header-title">Book Appointment</h2>
        </div>
        <button className="lead-action-back" onClick={() => navigate(`/leads/actions?claimNo=${claimNo}`)}>
          Back
        </button>
      </div>
    </div>
  )

  if (loading) return (
    <div className="quotation-container">
      {header}
      <div className="lead-action-loading"><i className="fas fa-spinner fa-spin"></i> Loading...</div>
    </div>
  )

  if (error || !lead) return (
    <div className="quotation-container">
      {header}
      <div className="lead-action-error">{error || 'Lead not found.'}</div>
    </div>
  )

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

      {header}

      <PatientInfoCard lead={lead} />

      {/* ── Provider info ──────────────────────────────────────────────────── */}
      {(lead.acceptedPrvNm || lead.providerNm) && (
        <div className="appt-provider-banner">
          <i className="fas fa-hospital"></i>&nbsp;
          <strong>Provider:</strong>&nbsp;{lead.acceptedPrvNm || lead.providerNm}
        </div>
      )}

      {/* ── Appointment form ───────────────────────────────────────────────── */}
      <div className="appt-card">
        <div className="appt-card-header">
          <i className="fas fa-calendar-plus"></i>&nbsp; Appointment Schedule
        </div>
        <div className="appt-form-grid">

          <div className="appt-field">
            <label className="appt-label">
              Date From <span className="appt-required">*</span>
            </label>
            <input
              type="date"
              name="appFromDt"
              className="appt-input"
              value={form.appFromDt}
              onChange={handleChange}
            />
          </div>

          <div className="appt-field">
            <label className="appt-label">
              Date To <span className="appt-required">*</span>
            </label>
            <input
              type="date"
              name="appUptoDt"
              className="appt-input"
              value={form.appUptoDt}
              min={form.appFromDt || undefined}
              onChange={handleChange}
            />
          </div>

          <div className="appt-field">
            <label className="appt-label">
              Appointment Time <span className="appt-required">*</span>
            </label>
            <input
              type="time"
              name="appReqTime"
              className="appt-input"
              value={form.appReqTime}
              onChange={handleChange}
            />
          </div>

          <div className="appt-field">
            <label className="appt-label">
              Doctor Name
            </label>
            <input
              type="text"
              name="preferredDoctor"
              className="appt-input"
              placeholder="Preferred doctor name"
              value={form.preferredDoctor}
              onChange={handleChange}
              maxLength={50}
            />
          </div>

          <div className="appt-field appt-field--full">
            <label className="appt-label">Remarks</label>
            <textarea
              name="remarks"
              className="appt-textarea"
              placeholder="Additional remarks..."
              value={form.remarks}
              onChange={handleChange}
              maxLength={255}
              rows={3}
            />
          </div>

        </div>
      </div>

      {/* ── Submit button ──────────────────────────────────────────────────── */}
      <div className="generate-estimates-display-button-container">
        <button
          className="MedicaltourismProceedforEstimate__btn MedicaltourismProceedforEstimate__btn--submit"
          onClick={handleSubmitClick}
          disabled={saving}
        >
          {saving
            ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Submitting…</>
            : <><i className="fas fa-calendar-check"></i>&nbsp;Request Appointment</>
          }
        </button>
      </div>
    </div>
  )
}

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
          <button className="confirm-btn-ok" onClick={onOk}>OK</button>
        </div>
      </div>
    </div>
  )
}
