import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAppointment, confirmAppointment, getLeadByClaimNo } from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'
import PatientInfoCard from '../../components/PatientInfoCard'

/**
 * AppointmentConfirm — mirrors appointmentconfirm.aspx from Med_Tour.
 * Loads the existing appointment request and lets the coordinator confirm it.
 * Status 320 + email event 118 on submit.
 */

export default function AppointmentConfirm() {
  const navigate     = useNavigate()
  const [params]     = useSearchParams()
  const claimNo      = params.get('claimNo') ?? ''
  const prvCd        = params.get('prvCd')   ?? ''

  const [appt,      setAppt]      = useState(null)
  const [lead,      setLead]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [modalMsgs, setModalMsgs] = useState([])
  const [confirmCfg,setConfirmCfg]= useState(null)
  const [done,      setDone]      = useState(false)

  const [form, setForm] = useState({
    appointmentDt       : '',
    appointmentTm       : '',
    confirmationRemarks : '',
  })

  useEffect(() => {
    if (!claimNo || !prvCd) {
      setError('Treatment ID and Provider Code are required.')
      setLoading(false)
      return
    }
    Promise.all([
      getAppointment(claimNo, prvCd),
      getLeadByClaimNo(claimNo).catch(() => null)
    ])
      .then(([apptData, leadData]) => {
        if (!apptData) { setError('No appointment request found.'); return }
        setAppt(apptData)
        setLead(leadData)
        setForm({
          appointmentDt       : apptData.appointmentDt       ?? '',
          appointmentTm       : apptData.appointmentTm       ?? '',
          confirmationRemarks : apptData.confirmationRemarks ?? '',
        })
      })
      .catch(() => setError('Failed to load appointment details.'))
      .finally(() => setLoading(false))
  }, [claimNo, prvCd])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleSubmitClick() {
    const errs = []
    if (!form.appointmentDt) errs.push('Appointment Date is required.')
    if (!form.appointmentTm) errs.push('Appointment Time is required.')
    if (errs.length) { setModalMsgs(errs); return }

    setConfirmCfg({
      message: 'Do you want to confirm this appointment?',
      onOk: doSubmit
    })
  }

  async function doSubmit() {
    setConfirmCfg(null)
    setSaving(true)
    try {
      await confirmAppointment({
        id                  : appt?.id ?? 0,
        claimNo,
        memberId            : appt?.memberId ?? '',
        // Use the appointment record's own provider, not the URL param — the lead's
        // "current" provider field can drift from whichever provider the appointment
        // was actually booked under (see AppointmentDAL.GetAsync for the same fix).
        prvCd               : appt?.prvCd || prvCd,
        appointmentDt       : form.appointmentDt,
        appointmentTm       : form.appointmentTm,
        confirmationRemarks : form.confirmationRemarks,
        statusCd            : 320,
        statusRemarks       : 'Appointment Confirmed',
      })
      setDone(true)
      setTimeout(() => navigate('/leads/search'), 3000)
    } catch {
      setModalMsgs(['Failed to confirm appointment. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  const header = (
    <div className="common-header">
      <div className="common-header-content">
        <div className="common-header-title-wrapper">
          <h2 className="common-header-title">Confirm Appointment</h2>
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

  if (error) return (
    <div className="quotation-container">
      {header}
      <div className="lead-action-error">{error}</div>
    </div>
  )

  if (done) return (
    <div className="message-wrapper">
      <div className="message-container">
        <div className="thank-you-card">
          <div className="thank-you-checkmark">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h1 className="thank-you-heading">CONFIRMED!</h1>
          <p className="thank-you-text">Appointment confirmed and notification sent to the provider.</p>
          <p className="thank-you-subtext">Redirecting to search…</p>
        </div>
      </div>
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

      {lead && <PatientInfoCard lead={lead} />}

      {/* ── Provider info ──────────────────────────────────────────────────── */}
      {appt?.prvNm && (
        <div className="appt-provider-banner">
          <i className="fas fa-hospital"></i>&nbsp;
          <strong>Provider:</strong>&nbsp;{appt.prvNm}
        </div>
      )}

      {/* ── Single editable appointment card ──────────────────────────────── */}
      <div className="appt-card">
        <div className="appt-card-header">
          <i className="fas fa-calendar-check"></i>&nbsp; Appointment Schedule
        </div>
        <div className="appt-form-grid">

          <div className="appt-field">
            <label className="appt-label">
              Appointment Date <span className="appt-required">*</span>
            </label>
            <input
              type="date"
              name="appointmentDt"
              className="appt-input"
              value={form.appointmentDt}
              onChange={handleChange}
            />
          </div>

          <div className="appt-field">
            <label className="appt-label">
              Appointment Time <span className="appt-required">*</span>
            </label>
            <input
              type="time"
              name="appointmentTm"
              className="appt-input"
              value={form.appointmentTm}
              onChange={handleChange}
            />
          </div>

          <div className="appt-field appt-field--full">
            <label className="appt-label">Confirmation Remarks</label>
            <textarea
              name="confirmationRemarks"
              className="appt-textarea"
              placeholder="Confirmation remarks..."
              value={form.confirmationRemarks}
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
            ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Confirming…</>
            : <><i className="fas fa-calendar-check"></i>&nbsp;Confirm Appointment</>
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
