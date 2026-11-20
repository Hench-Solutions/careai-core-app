import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { caseStatusApi } from '../../utils/api'
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

const EMPTY_FORM = {
  statusCd:  '',
  statusNm:  '',
  statusGrp: '',
  actvInd:   true,
  remarks:   '',
}

export default function CaseStatusForm() {
  const navigate = useNavigate()
  const { id }    = useParams()   // status_Cd of the row being edited
  const isEdit    = Boolean(id)

  const [form,        setForm]        = useState(EMPTY_FORM)
  const [groupOptions, setGroupOptions] = useState([])   // [{value: statusCd, label: statusNm}]
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [modalMsgs,   setModalMsgs]   = useState([])
  const [successMsg,  setSuccessMsg]  = useState('')
  const [error,       setError]       = useState('')

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  useEffect(() => {
    caseStatusApi({ mode: 'R' })
      .then(res => {
        const rows = res?.statuses ?? []
        setGroupOptions(rows.map(r => ({ value: r.statusCd, label: r.statusNm })))

        if (isEdit) {
          const row = rows.find(r => String(r.statusCd) === String(id))
          if (!row) { setError('Case status not found.'); return }
          setForm({
            statusCd:  String(row.statusCd ?? ''),
            statusNm:  row.statusNm  ?? '',
            statusGrp: String(row.statusGrp ?? ''),
            actvInd:   Boolean(row.actvInd),
            remarks:   row.remarks   ?? '',
          })
        } else if (res?.nextCode != null) {
          set('statusCd', String(res.nextCode))
        }
      })
      .catch(() => setError(isEdit ? 'Failed to load case status details.' : 'Failed to load case status list.'))
      .finally(() => setLoading(false))
  }, [id, isEdit])  // eslint-disable-line react-hooks/exhaustive-deps

  function validate() {
    const errs = []
    if (!form.statusNm.trim())  errs.push('Status Name is required.')
    if (!form.statusGrp)        errs.push('Status Group is required.')
    return errs
  }

  async function handleSubmit() {
    const errs = validate()
    if (errs.length > 0) { setModalMsgs(errs); return }

    setSaving(true)
    try {
      await caseStatusApi({
        mode:      isEdit ? 'U' : 'I',
        statusCd:  Number(form.statusCd) || 0,
        statusNm:  form.statusNm,
        statusGrp: Number(form.statusGrp) || 0,
        actvInd:   form.actvInd,
        remarks:   form.remarks,
      })
      setSuccessMsg(isEdit ? 'Case status updated successfully!' : 'Case status added successfully!')
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to save case status. Please try again.'])
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
      <SuccessModal message={successMsg} onClose={() => navigate('/master/case-status')} />

      <div className="page-header-banner" style={{ justifyContent: 'space-between' }}>
        <h2>
          <i className="fas fa-list-check" style={{ marginRight: 10 }}></i>
          {isEdit ? `Edit Case Status — #${id}` : 'Add Case Status'}
        </h2>
        <button className="lead-action-back" onClick={() => navigate('/master/case-status')}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      {error && <div className="lsrch-error" style={{ margin: '12px 0' }}>{error}</div>}

      <CollapsibleCard icon="fas fa-list-check" title="Status Details">
        <div className="prv-form-grid">

          <F label="Status Code" required>
            <input className="prv-input" value={form.statusCd} readOnly
              style={{ background: '#f5f5f5', cursor: 'not-allowed' }} />
          </F>

          <F label="Status Name" required>
            <input className="prv-input" placeholder="e.g. Documents Under Review" value={form.statusNm}
              onChange={e => set('statusNm', e.target.value)} />
          </F>

          <F label="Status Group" required>
            <select className="prv-select" value={form.statusGrp} onChange={e => set('statusGrp', e.target.value)}>
              <option value="">-- Select --</option>
              {groupOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </F>

          <F label="Remarks" full>
            <textarea className="prv-input" rows={3} placeholder="Optional notes about when this status applies"
              value={form.remarks}
              onChange={e => set('remarks', e.target.value)}
              style={{ resize: 'vertical', minHeight: 72 }} />
          </F>

          <F label="Active">
            <label className="prv-check-item">
              <input type="checkbox" checked={form.actvInd} onChange={e => set('actvInd', e.target.checked)} />
              Enabled
            </label>
          </F>

        </div>
      </CollapsibleCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20, marginBottom: 32 }}>
        {!isEdit && (
          <button className="lead-action-back" onClick={() => navigate('/master/case-status')}>
            <i className="fas fa-times"></i> Cancel
          </button>
        )}
        <button className="PF-btn-next" onClick={handleSubmit} disabled={saving}>
          {saving
            ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Saving…</>
            : <><i className="fas fa-save"></i>&nbsp;{isEdit ? 'Update' : 'Save Status'}</>}
        </button>
      </div>

    </div>
  )
}
