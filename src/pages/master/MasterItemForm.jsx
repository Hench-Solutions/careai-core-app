import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { masterItemApi } from '../../utils/api'
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
  itemType:     '',
  itemCd:       '',
  parentItemCd: '',
  itemNm:       '',
  itemCatg:     '',
  itemUsrCd:    '',
  itemRemarks:  '',
  actvInd:      1,
}

export default function MasterItemForm() {
  const navigate = useNavigate()
  const { id }    = useParams()   // MT_MasterItem.id of the row being edited
  const [params]  = useSearchParams()
  const isEdit    = Boolean(id)

  const [form,       setForm]       = useState(EMPTY_FORM)
  const [itemTypes,  setItemTypes]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [modalMsgs,  setModalMsgs]  = useState([])
  const [successMsg, setSuccessMsg] = useState('')
  const [error,      setError]      = useState('')

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  useEffect(() => {
    if (isEdit) {
      masterItemApi({ mode: 'R' })
        .then(res => {
          setItemTypes(res?.itemTypes ?? [])
          const row = (res?.items ?? []).find(r => String(r.id) === String(id))
          if (!row) { setError('Master item not found.'); return }
          setForm({
            itemType:     row.itemType ?? '',
            itemCd:       row.itemCd ?? '',
            parentItemCd: row.parentItemCd ?? '',
            itemNm:       row.itemNm ?? '',
            itemCatg:     row.itemCatg ?? '',
            itemUsrCd:    row.itemUsrCd ?? '',
            itemRemarks:  row.itemRemarks ?? '',
            actvInd:      row.actvInd ?? 1,
          })
        })
        .catch(() => setError('Failed to load master item details.'))
        .finally(() => setLoading(false))
    } else {
      const itemType     = params.get('itemType') ?? ''
      const parentItemCd = params.get('parentItemCd') ?? ''
      set('itemType', itemType)
      set('parentItemCd', parentItemCd)
      masterItemApi({ mode: 'R', itemType })
        .then(res => {
          setItemTypes(res?.itemTypes ?? [])
          if (itemType && res?.nextItemCd) set('itemCd', res.nextItemCd)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [id, isEdit])  // eslint-disable-line react-hooks/exhaustive-deps

  // Re-suggest the next Item Code whenever the type changes (Add mode only).
  function handleItemTypeChange(newType) {
    set('itemType', newType)
    set('itemCd', '')
    if (!newType) return
    masterItemApi({ mode: 'R', itemType: newType })
      .then(res => set('itemCd', res?.nextItemCd || ''))
      .catch(() => {})
  }

  function validate() {
    const errs = []
    if (!isEdit) {
      if (!form.itemType.trim()) errs.push('Item Type is required.')
      if (!form.itemCd.trim())   errs.push('Item Code is required.')
    }
    if (!form.itemNm.trim())    errs.push('Item Name is required.')
    return errs
  }

  async function handleSubmit() {
    const errs = validate()
    if (errs.length > 0) { setModalMsgs(errs); return }

    setSaving(true)
    try {
      await masterItemApi({
        mode:         isEdit ? 'U' : 'I',
        id:           isEdit ? Number(id) : 0,
        itemType:     form.itemType,
        itemCd:       form.itemCd,
        parentItemCd: form.parentItemCd,
        itemNm:       form.itemNm,
        itemCatg:     form.itemCatg,
        itemUsrCd:    form.itemUsrCd,
        itemRemarks:  form.itemRemarks,
        actvInd:      form.actvInd,
      })
      setSuccessMsg(isEdit ? 'Master item updated successfully!' : 'Master item added successfully!')
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to save master item. Please try again.'])
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
      <SuccessModal message={successMsg} onClose={() => navigate('/master/master-item')} />

      <div className="page-header-banner" style={{ justifyContent: 'space-between' }}>
        <h2>
          <i className="fas fa-sitemap" style={{ marginRight: 10 }}></i>
          {isEdit ? 'Edit Master Item' : form.parentItemCd ? 'Add Child Item' : 'Add Master Item'}
        </h2>
        <button className="lead-action-back" onClick={() => navigate('/master/master-item')}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      {error && <div className="lsrch-error" style={{ margin: '12px 0' }}>{error}</div>}

      <CollapsibleCard icon="fas fa-sitemap" title="Master Item Details">
        <div className="prv-form-grid">

          <F label="Item Type" required>
            <select className="prv-select" value={form.itemType}
              disabled={isEdit || Boolean(form.parentItemCd)}
              onChange={e => handleItemTypeChange(e.target.value)}
              style={(isEdit || form.parentItemCd) ? { background: '#f5f5f5', cursor: 'not-allowed' } : undefined}>
              <option value="">-- Select --</option>
              {itemTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </F>

          <F label="Item Code">
            <input className="prv-input" placeholder="Auto-generated" value={form.itemCd} readOnly
              style={{ background: '#f5f5f5', cursor: 'not-allowed' }} />
          </F>

          <F label="Item Name" required>
            <input className="prv-input" placeholder="Enter item name" value={form.itemNm}
              onChange={e => set('itemNm', e.target.value)} />
          </F>

          <F label="Category">
            <input className="prv-input" placeholder="Optional category" value={form.itemCatg}
              onChange={e => set('itemCatg', e.target.value)} />
          </F>

          <F label="User Code">
            <input className="prv-input" placeholder="Optional user-facing code" value={form.itemUsrCd}
              onChange={e => set('itemUsrCd', e.target.value)} />
          </F>

          <F label="Active">
            <label className="prv-check-item">
              <input type="checkbox" checked={form.actvInd === 1} onChange={e => set('actvInd', e.target.checked ? 1 : 0)} />
              Enabled
            </label>
          </F>

          <F label="Remarks" full>
            <textarea className="prv-input" rows={3} placeholder="Any remarks"
              value={form.itemRemarks}
              onChange={e => set('itemRemarks', e.target.value)}
              style={{ resize: 'vertical', minHeight: 72 }} />
          </F>

        </div>
      </CollapsibleCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20, marginBottom: 32 }}>
        {!isEdit && (
          <button className="lead-action-back" onClick={() => navigate('/master/master-item')}>
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
