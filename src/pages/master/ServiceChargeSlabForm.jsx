import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { serviceChargeSlabApi, fetchDropdown, fetchMasterItems } from '../../utils/api'
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

const CALC_TYPE_OPTIONS = [
  { value: 'FLAT',           text: 'Flat' },
  { value: 'PERCENT',        text: 'Percent' },
  { value: 'PERCENT_CAPPED', text: 'Percent (Capped)' },
]

const EMPTY_FORM = {
  insurerCd:       '',
  countryCd:       '',
  treatmentTypeCd: '',
  minAmt:          '',
  maxAmt:          '',
  calcType:        'FLAT',
  flatFee:         '',
  percentValue:    '',
  capAmt:          '',
  currencyCd:      '',
  actvInd:         1,
}

export default function ServiceChargeSlabForm() {
  const navigate = useNavigate()
  const { id }    = useParams()
  const isEdit    = Boolean(id)

  const [form,       setForm]       = useState(EMPTY_FORM)
  const [allSlabs,    setAllSlabs]   = useState([])   // every row — used for the bucket-overlap warning
  const [ddlInsurer,  setDdlInsurer] = useState([{ value: '', text: '-- Select --' }])
  const [ddlCountry,  setDdlCountry] = useState([{ value: '', text: '-- Select (default / any) --' }])
  const [ddlTreatment,setDdlTreatment] = useState([{ value: '', text: '-- Select --' }])
  const [ddlCurrency, setDdlCurrency] = useState([{ value: '', text: '-- Select --' }])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [modalMsgs,   setModalMsgs]   = useState([])
  const [successMsg,  setSuccessMsg]  = useState('')
  const [error,       setError]       = useState('')

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  useEffect(() => {
    fetchDropdown('ddlinsurer').then(setDdlInsurer).catch(() => {})
    fetchDropdown('ddlcountry').then(items => setDdlCountry([{ value: '', text: '-- Select (default / any) --' }, ...items])).catch(() => {})
    fetchMasterItems('TreatmentType').then(setDdlTreatment).catch(() => {})
    fetchMasterItems('currency').then(setDdlCurrency).catch(() => {})

    serviceChargeSlabApi({ mode: 'R' })
      .then(res => {
        const rows = res?.slabs ?? []
        setAllSlabs(rows)

        if (isEdit) {
          const row = rows.find(r => String(r.id) === String(id))
          if (!row) { setError('Service charge slab not found.'); return }
          setForm({
            insurerCd:       row.insurerCd ?? '',
            countryCd:       row.countryCd ?? '',
            treatmentTypeCd: row.treatmentTypeCd ?? '',
            minAmt:          row.minAmt != null ? String(row.minAmt) : '',
            maxAmt:          row.maxAmt != null ? String(row.maxAmt) : '',
            calcType:        row.calcType || 'FLAT',
            flatFee:         row.flatFee != null ? String(row.flatFee) : '',
            percentValue:    row.percentValue != null ? String(row.percentValue) : '',
            capAmt:          row.capAmt != null ? String(row.capAmt) : '',
            currencyCd:      row.currencyCd ?? '',
            actvInd:         row.actvInd ?? 1,
          })
        }
      })
      .catch(() => setError(isEdit ? 'Failed to load slab details.' : 'Failed to load existing slabs.'))
      .finally(() => setLoading(false))
  }, [id, isEdit])  // eslint-disable-line react-hooks/exhaustive-deps

  // Sibling rows in the same Insurer + Country + Treatment bucket (excluding the row being edited) —
  // used only for soft warnings, never to block save.
  const siblingSlabs = useMemo(() => {
    if (!form.insurerCd || !form.treatmentTypeCd) return []
    return allSlabs.filter(r =>
      String(r.id) !== String(id) &&
      r.insurerCd === form.insurerCd &&
      (r.countryCd || '') === (form.countryCd || '') &&
      r.treatmentTypeCd === form.treatmentTypeCd
    )
  }, [allSlabs, form.insurerCd, form.countryCd, form.treatmentTypeCd, id])

  function validate() {
    const errs = []
    if (!form.insurerCd)                errs.push('Insurer is required.')
    if (!form.treatmentTypeCd)          errs.push('Treatment Type is required.')
    if (!(parseFloat(form.minAmt) >= 0)) errs.push('Min Amt is required and must be 0 or greater.')
    if (form.maxAmt !== '' && parseFloat(form.maxAmt) <= parseFloat(form.minAmt))
      errs.push('Max Amt must be greater than Min Amt (or left blank for an open-ended top bracket).')
    if (!form.calcType)                 errs.push('Calc Type is required.')
    if (form.calcType === 'FLAT' && !(parseFloat(form.flatFee) > 0))
      errs.push('Flat Fee is required for Calc Type = Flat.')
    if ((form.calcType === 'PERCENT' || form.calcType === 'PERCENT_CAPPED') && !(parseFloat(form.percentValue) > 0))
      errs.push('Percent Value is required for Calc Type = Percent / Percent (Capped).')
    if (form.calcType === 'PERCENT_CAPPED' && !(parseFloat(form.capAmt) > 0))
      errs.push('Cap Amt is required for Calc Type = Percent (Capped).')
    if (!form.currencyCd)               errs.push('Currency is required.')
    return errs
  }

  // Soft warnings only — bracket overlap or a currency that differs from sibling
  // rows in the same bucket. Shown to the user but never blocks Save.
  function buildWarnings() {
    const warnings = []
    const min = parseFloat(form.minAmt)
    const max = form.maxAmt !== '' ? parseFloat(form.maxAmt) : null

    for (const s of siblingSlabs) {
      const sMin = Number(s.minAmt)
      const sMax = s.maxAmt != null ? Number(s.maxAmt) : null
      const overlaps = min <= (sMax ?? Infinity) && (max ?? Infinity) >= sMin
      if (overlaps) {
        warnings.push(`This bracket overlaps an existing slab (${sMin}–${sMax ?? 'no limit'}) for the same Insurer/Country/Treatment Type.`)
      }
      if (s.currencyCd && form.currencyCd && s.currencyCd !== form.currencyCd) {
        warnings.push(`Currency (${form.currencyCd}) differs from an existing slab in this bucket (${s.currencyCd}) — the fee calculation assumes one currency per bucket.`)
      }
    }
    return [...new Set(warnings)]
  }

  async function handleSubmit() {
    const errs = validate()
    if (errs.length > 0) { setModalMsgs(errs); return }

    const warnings = buildWarnings()
    if (warnings.length > 0 && !window.confirm(`${warnings.join('\n\n')}\n\nSave anyway?`)) return

    setSaving(true)
    try {
      await serviceChargeSlabApi({
        mode:            isEdit ? 'U' : 'I',
        id:              isEdit ? Number(id) : 0,
        insurerCd:       form.insurerCd,
        countryCd:       form.countryCd || null,
        treatmentTypeCd: form.treatmentTypeCd,
        minAmt:          Number(form.minAmt) || 0,
        maxAmt:          form.maxAmt !== '' ? Number(form.maxAmt) : null,
        calcType:        form.calcType,
        flatFee:         form.flatFee !== '' ? Number(form.flatFee) : null,
        percentValue:    form.percentValue !== '' ? Number(form.percentValue) : null,
        capAmt:          form.capAmt !== '' ? Number(form.capAmt) : null,
        currencyCd:      form.currencyCd,
        actvInd:         form.actvInd,
      })
      setSuccessMsg(isEdit ? 'Service charge slab updated successfully!' : 'Service charge slab added successfully!')
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to save service charge slab. Please try again.'])
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
      <SuccessModal message={successMsg} onClose={() => navigate('/master/service-charge-slab')} />

      <div className="page-header-banner" style={{ justifyContent: 'space-between' }}>
        <h2>
          <i className="fas fa-percent" style={{ marginRight: 10 }}></i>
          {isEdit ? 'Edit Service Fee Slab' : 'Add Service Fee Slab'}
        </h2>
        <button className="lead-action-back" onClick={() => navigate('/master/service-charge-slab')}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      {error && <div className="lsrch-error" style={{ margin: '12px 0' }}>{error}</div>}

      <CollapsibleCard icon="fas fa-percent" title="Slab Details">
        <div className="prv-form-grid">

          <F label="Insurer" required>
            <select className="prv-select" value={form.insurerCd} onChange={e => set('insurerCd', e.target.value)}>
              {ddlInsurer.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
            </select>
          </F>

          <F label="Country">
            <select className="prv-select" value={form.countryCd} onChange={e => set('countryCd', e.target.value)}>
              {ddlCountry.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
            </select>
          </F>

          <F label="Treatment Type" required>
            <select className="prv-select" value={form.treatmentTypeCd} onChange={e => set('treatmentTypeCd', e.target.value)}>
              {ddlTreatment.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
            </select>
          </F>

          <F label="Min Amt" required>
            <input className="prv-input" inputMode="decimal" placeholder="0.00" value={form.minAmt}
              onChange={e => set('minAmt', e.target.value)} />
          </F>

          <F label="Max Amt">
            <input className="prv-input" inputMode="decimal" placeholder="Leave blank for no upper limit" value={form.maxAmt}
              onChange={e => set('maxAmt', e.target.value)} />
          </F>

          <F label="Calc Type" required>
            <select className="prv-select" value={form.calcType} onChange={e => set('calcType', e.target.value)}>
              {CALC_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
            </select>
          </F>

          {form.calcType === 'FLAT' && (
            <F label="Flat Fee" required>
              <input className="prv-input" inputMode="decimal" placeholder="0.00" value={form.flatFee}
                onChange={e => set('flatFee', e.target.value)} />
            </F>
          )}

          {(form.calcType === 'PERCENT' || form.calcType === 'PERCENT_CAPPED') && (
            <F label="Percent Value (e.g. 0.05 = 5%)" required>
              <input className="prv-input" inputMode="decimal" placeholder="0.00" value={form.percentValue}
                onChange={e => set('percentValue', e.target.value)} />
            </F>
          )}

          {form.calcType === 'PERCENT_CAPPED' && (
            <F label="Cap Amt" required>
              <input className="prv-input" inputMode="decimal" placeholder="0.00" value={form.capAmt}
                onChange={e => set('capAmt', e.target.value)} />
            </F>
          )}

          <F label="Currency" required>
            <select className="prv-select" value={form.currencyCd} onChange={e => set('currencyCd', e.target.value)}>
              {ddlCurrency.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
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
                Inactive
              </label>
            </div>
          </F>

        </div>
      </CollapsibleCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20, marginBottom: 32 }}>
        {!isEdit && (
          <button className="lead-action-back" onClick={() => navigate('/master/service-charge-slab')}>
            <i className="fas fa-times"></i> Cancel
          </button>
        )}
        <button className="PF-btn-next" onClick={handleSubmit} disabled={saving}>
          {saving
            ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Saving…</>
            : <><i className="fas fa-save"></i>&nbsp;{isEdit ? 'Update' : 'Save Slab'}</>}
        </button>
      </div>

    </div>
  )
}
