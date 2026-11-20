import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { documentApi } from '../../utils/api'
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
  docCd:       '',
  docNm:       '',
  moduleCd:    '',
  docCategory: '',
  req:         0,
  actvInd:     1,
  remarks:     '',
}

export default function DocumentForm() {
  const navigate = useNavigate()
  const { id }    = useParams()   // MT_Document.Id of the row being edited
  const isEdit    = Boolean(id)

  const [form,       setForm]       = useState(EMPTY_FORM)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [modalMsgs,  setModalMsgs]  = useState([])
  const [successMsg, setSuccessMsg] = useState('')
  const [error,      setError]      = useState('')

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  useEffect(() => {
    documentApi({ mode: 'R' })
      .then(res => {
        const rows = res?.documents ?? []

        if (isEdit) {
          const row = rows.find(r => String(r.id) === String(id))
          if (!row) { setError('Document not found.'); return }
          setForm({
            docCd:       String(row.docCd ?? ''),
            docNm:       row.docNm ?? '',
            moduleCd:    row.moduleCd ?? '',
            docCategory: row.docCategory ?? '',
            req:         row.req ?? 0,
            actvInd:     row.actvInd ?? 1,
            remarks:     row.remarks ?? '',
          })
        }
      })
      .catch(() => setError(isEdit ? 'Failed to load document details.' : 'Failed to load document list.'))
      .finally(() => setLoading(false))
  }, [id, isEdit])  // eslint-disable-line react-hooks/exhaustive-deps

  function validate() {
    const errs = []
    if (!form.docCd.trim())    errs.push('Doc Code is required.')
    if (!form.docNm.trim())    errs.push('Document Name is required.')
    if (!form.moduleCd.trim()) errs.push('Module is required.')
    return errs
  }

  async function handleSubmit() {
    const errs = validate()
    if (errs.length > 0) { setModalMsgs(errs); return }

    setSaving(true)
    try {
      await documentApi({
        mode:        isEdit ? 'U' : 'I',
        id:          isEdit ? Number(id) : 0,
        docCd:       form.docCd.trim(),
        docNm:       form.docNm,
        moduleCd:    form.moduleCd,
        docCategory: form.docCategory,
        req:         form.req,
        actvInd:     form.actvInd,
        remarks:     form.remarks,
      })
      setSuccessMsg(isEdit ? 'Document updated successfully!' : 'Document added successfully!')
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to save document. Please try again.'])
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
      <SuccessModal message={successMsg} onClose={() => navigate('/master/document')} />

      <div className="page-header-banner" style={{ justifyContent: 'space-between' }}>
        <h2>
          <i className="fas fa-file-alt" style={{ marginRight: 10 }}></i>
          {isEdit ? `Edit Document — #${id}` : 'Add Document'}
        </h2>
        <button className="lead-action-back" onClick={() => navigate('/master/document')}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      {error && <div className="lsrch-error" style={{ margin: '12px 0' }}>{error}</div>}

      <CollapsibleCard icon="fas fa-file-alt" title="Document Details">
        <div className="prv-form-grid">

          <F label="Doc Code" required>
            <input className="prv-input" placeholder="e.g. DT0001" value={form.docCd}
              disabled={isEdit} onChange={e => set('docCd', e.target.value)}
              style={isEdit ? { background: '#f5f5f5', cursor: 'not-allowed' } : undefined} />
          </F>

          <F label="Document Name" required>
            <input className="prv-input" placeholder="e.g. Passport Copy" value={form.docNm}
              onChange={e => set('docNm', e.target.value)} />
          </F>

          <F label="Module" required>
            <input className="prv-input" placeholder="e.g. LEAD, PROVIDER, AGENT" value={form.moduleCd}
              onChange={e => set('moduleCd', e.target.value)} />
          </F>

          <F label="Category">
            <input className="prv-input" placeholder="Optional sub-category" value={form.docCategory}
              onChange={e => set('docCategory', e.target.value)} />
          </F>

          <F label="Required">
            <label className="prv-check-item">
              <input type="checkbox" checked={form.req === 1} onChange={e => set('req', e.target.checked ? 1 : 0)} />
              Mandatory document
            </label>
          </F>

          <F label="Active">
            <label className="prv-check-item">
              <input type="checkbox" checked={form.actvInd === 1} onChange={e => set('actvInd', e.target.checked ? 1 : 0)} />
              Enabled
            </label>
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
          <button className="lead-action-back" onClick={() => navigate('/master/document')}>
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
