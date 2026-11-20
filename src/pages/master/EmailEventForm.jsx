import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { emailEventApi } from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'

function CollapsibleCard({ icon, title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="PF-card-react">
      <div className="PF-card-head-react" onClick={() => setOpen(o => !o)}>
        <div className="PF-card-title-react">
          <span className="PF-card-icon-react"><i className={icon}></i></span>
          <span>{title}</span>
        </div>
        <i className={`fas fa-chevron-${open ? 'up' : 'down'} PF-chevron-react`}></i>
      </div>
      {open && <div className="PF-card-body-react">{children}</div>}
    </div>
  )
}

function F({ label, required, children, full }) {
  return (
    <div className={`prv-field${full ? ' prv-field--full' : ''}`}>
      <label className="prv-label">{label}{required && <span className="prv-required"> *</span>}</label>
      {children}
    </div>
  )
}

function SuccessModal({ message, onClose }) {
  if (!message) return null
  return (
    <div className="vmodal-overlay" onClick={onClose}>
      <div className="vmodal-box" onClick={e => e.stopPropagation()}>
        <div className="vmodal-header" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
          <i className="fas fa-check-circle"></i>
          <span>Success</span>
        </div>
        <div className="vmodal-body">
          <ul className="vmodal-list">
            <li><i className="fas fa-circle-dot" style={{ color: '#11998e' }}></i>{message}</li>
          </ul>
        </div>
        <div className="vmodal-footer">
          <button className="vmodal-ok" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }} onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  )
}

const TYPE_OPTIONS = ['', 'MT', 'Provider']

const EMPTY_FORM = {
  eventCode:         '',
  eventName:         '',
  type:              '',
  subject:           '',
  templateName:      '',
  receipient:        '',
  cc:                '',
  dynamicInformation:'',
  remarks:           '',
  actvInd:           1,
}

export default function EmailEventForm() {
  const navigate    = useNavigate()
  const { id }      = useParams()
  const isEdit      = Boolean(id)

  const [form,       setForm]       = useState(EMPTY_FORM)
  const [loading,    setLoading]    = useState(isEdit)
  const [saving,     setSaving]     = useState(false)
  const [modalMsgs,  setModalMsgs]  = useState([])
  const [successMsg, setSuccessMsg] = useState('')
  const [error,      setError]      = useState('')

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  useEffect(() => {
    if (isEdit) {
      // load all events then find by id
      emailEventApi({ mode: 'R' })
        .then(res => {
          const row = (res?.events ?? []).find(e => String(e.id) === String(id))
          if (!row) { setError('Email event not found.'); return }
          setForm({
            eventCode:          String(row.eventCode ?? ''),
            eventName:          row.eventName          ?? '',
            type:               row.type               ?? '',
            subject:            row.subject            ?? '',
            templateName:       row.templateName       ?? '',
            receipient:         row.receipient         ?? '',
            cc:                 row.cc                 ?? '',
            dynamicInformation: row.dynamicInformation ?? '',
            remarks:            row.remarks            ?? '',
            actvInd:            row.actvInd ?? 1,
          })
        })
        .catch(() => setError('Failed to load email event details.'))
        .finally(() => setLoading(false))
    } else {
      // pre-fill next event code
      emailEventApi({ mode: 'R' })
        .then(res => { if (res?.nextCode != null) set('eventCode', String(res.nextCode)) })
        .catch(() => {})
    }
  }, [id, isEdit])  // eslint-disable-line react-hooks/exhaustive-deps

  function validate() {
    const errs = []
    if (!form.eventName.trim())    errs.push('Event Name is required.')
    if (!form.subject.trim())      errs.push('Subject is required.')
    if (!form.templateName.trim()) errs.push('Template Name is required.')
    return errs
  }

  async function handleSubmit() {
    const errs = validate()
    if (errs.length > 0) { setModalMsgs(errs); return }

    setSaving(true)
    try {
      await emailEventApi({
        mode:              isEdit ? 'U' : 'I',
        id:                isEdit ? Number(id) : 0,
        eventCode:         parseFloat(form.eventCode) || 0,
        eventName:         form.eventName,
        type:              form.type,
        subject:           form.subject,
        templateName:      form.templateName,
        receipient:        form.receipient,
        cc:                form.cc,
        dynamicInformation:form.dynamicInformation,
        remarks:           form.remarks,
        actvInd:           form.actvInd,
      })
      setSuccessMsg(isEdit ? 'Email event updated successfully!' : 'Email event added successfully!')
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to save email event. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="quotation-container">
      <div className="lead-action-loading"><i className="fas fa-spinner fa-spin"></i> Loading…</div>
    </div>
  )

  return (
    <div className="quotation-container">

      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />
      <SuccessModal message={successMsg} onClose={() => navigate('/master/email-event')} />

      <div className="page-header-banner" style={{ justifyContent: 'space-between' }}>
        <h2>
          <i className="fas fa-envelope" style={{ marginRight: 10 }}></i>
          {isEdit ? `Edit Email Event — #${id}` : 'Add Email Event'}
        </h2>
        <button className="lead-action-back" onClick={() => navigate('/master/email-event')}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      {error && <div className="lsrch-error" style={{ margin: '12px 0' }}>{error}</div>}

      <CollapsibleCard icon="fas fa-envelope" title="Email Event Details">
        <div className="prv-form-grid">

          <F label="Event Code">
            <input className="prv-input" value={form.eventCode} readOnly
              style={{ background: '#f5f5f5', cursor: 'not-allowed' }} />
          </F>

          <F label="Event Name" required>
            <input className="prv-input" placeholder="Enter event name" value={form.eventName}
              onChange={e => set('eventName', e.target.value)} />
          </F>

          <F label="Type">
            <select className="prv-select" value={form.type} onChange={e => set('type', e.target.value)}>
              {TYPE_OPTIONS.map(o => <option key={o} value={o}>{o || '-- Select --'}</option>)}
            </select>
          </F>

          <F label="Status">
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="radio" name="actvInd" checked={form.actvInd === 1} onChange={() => set('actvInd', 1)} />
                Active
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="radio" name="actvInd" checked={form.actvInd === 0} onChange={() => set('actvInd', 0)} />
                Inactive (email disabled)
              </label>
            </div>
          </F>

          <F label="Subject" required>
            <input className="prv-input" placeholder="Enter email subject" value={form.subject}
              onChange={e => set('subject', e.target.value)} />
          </F>

          <F label="Template Name" required>
            <input className="prv-input" placeholder="Enter template name" value={form.templateName}
              onChange={e => set('templateName', e.target.value)} />
          </F>

          <F label="Recipient">
            <input className="prv-input" placeholder="e.g. patient@example.com" value={form.receipient}
              onChange={e => set('receipient', e.target.value)} />
          </F>

          <F label="CC">
            <input className="prv-input" placeholder="e.g. cc@example.com" value={form.cc}
              onChange={e => set('cc', e.target.value)} />
          </F>

          <F label="Dynamic Information" full>
            <textarea className="prv-input" rows={3} placeholder="Comma-separated dynamic field names"
              value={form.dynamicInformation}
              onChange={e => set('dynamicInformation', e.target.value)}
              style={{ resize: 'vertical', minHeight: 72 }} />
          </F>

          <F label="Remarks" full>
            <textarea className="prv-input" rows={3} placeholder="Any remarks"
              value={form.remarks}
              onChange={e => set('remarks', e.target.value)}
              style={{ resize: 'vertical', minHeight: 72 }} />
          </F>

        </div>
      </CollapsibleCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20, marginBottom: 32 }}>
        {!isEdit && (
          <button className="lead-action-back" onClick={() => navigate('/master/email-event')}>
            <i className="fas fa-times"></i> Cancel
          </button>
        )}
        <button className="PF-btn-next" onClick={handleSubmit} disabled={saving}>
          {saving
            ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Saving…</>
            : <><i className="fas fa-save"></i>&nbsp;{isEdit ? 'Update' : 'Submit'}</>}
        </button>
      </div>

    </div>
  )
}
