import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchDropdown, fetchMasterItems, fetchInsurers, saveInsurer } from '../../utils/api'
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

function F({ label, required, children, full, span2 }) {
  const cls = full ? 'prv-field--full' : span2 ? 'agent-field--span2' : ''
  return (
    <div className={`prv-field ${cls}`}>
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

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/

const EMPTY_FORM = {
  insurerNm:          '',
  insurerPrefixCode:  '',
  currencyCd:         '',
  agreementSignedDt:  '',
  agreementEndDt:     '',
  insurerType:        '',
  isRateApply:        'N',
  agreementTermYear:  '',
  address:            '',
  pinCode:            '',
  country:            '',
  state:              '',
  city:               '',
  emailId:            '',
  mobileNo:           '',
  personName:         '',
  personMobileNo:     '',
  businessType:       '',
  faxNumber:          '',
  actvInd:            1,
}

export default function InsurerForm() {
  const navigate     = useNavigate()
  const { insurerCd } = useParams()
  const isEdit       = Boolean(insurerCd)

  const [form,       setForm]       = useState(EMPTY_FORM)
  const [loading,    setLoading]    = useState(isEdit)
  const [saving,     setSaving]     = useState(false)
  const [modalMsgs,  setModalMsgs]  = useState([])
  const [successMsg, setSuccessMsg] = useState('')
  const [error,      setError]      = useState('')

  // Dropdown states
  const [ddlCurrency,   setDdlCurrency]   = useState([{ value: '', text: '-- Select --' }])
  const [ddlInsurerType,setDdlInsurerType]= useState([{ value: '', text: '-- Select --' }])
  const [ddlCountry,    setDdlCountry]    = useState([{ value: '', text: '-- Select --' }])
  const [ddlState,      setDdlState]      = useState([{ value: '', text: '-- Select --' }])
  const [ddlCity,       setDdlCity]       = useState([{ value: '', text: '-- Select --' }])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  useEffect(() => {
    fetchDropdown('ddlcountry').then(items => setDdlCountry([{ value: '', text: '-- Select --' }, ...items])).catch(() => {})
    fetchMasterItems('InsurerType').then(items => setDdlInsurerType([{ value: '', text: '-- Select --' }, ...items.map(i => ({ value: i.value, text: i.text }))])).catch(() => {})
    fetchMasterItems('currency').then(items => setDdlCurrency([{ value: '', text: '-- Select --' }, ...items.map(i => ({ value: i.value, text: i.text }))])).catch(() => {})
  }, [])

  useEffect(() => {
    setDdlState([{ value: '', text: '-- Select --' }])
    setDdlCity([{ value: '', text: '-- Select --' }])
    if (!form.country) return
    fetchDropdown('ddlstate', form.country).then(items => setDdlState([{ value: '', text: '-- Select --' }, ...items])).catch(() => {})
  }, [form.country])

  useEffect(() => {
    setDdlCity([{ value: '', text: '-- Select --' }])
    if (!form.state) return
    fetchDropdown('ddldistrict', form.state).then(items => setDdlCity([{ value: '', text: '-- Select --' }, ...items])).catch(() => {})
  }, [form.state])

  // Load insurer data in edit mode
  useEffect(() => {
    if (!isEdit) return
    fetchInsurers({ insurerCd })
      .then(rows => {
        if (!rows || rows.length === 0) { setError('Insurer not found.'); return }
        const r = rows[0]
        setForm({
          insurerNm:         r.insurer_Nm          ?? '',
          insurerPrefixCode: r.ins_Prefix_Cd       ?? '',
          currencyCd:        r.currency_Cd         ?? '',
          insurerType:       r.insurer_Type        ?? '',
          agreementSignedDt: r.agreement_StartDt   ? r.agreement_StartDt.substring(0, 10) : '',
          agreementEndDt:    r.agreement_EndDt     ? r.agreement_EndDt.substring(0, 10)   : '',
          agreementTermYear: r.agreement_TermYr    != null ? String(r.agreement_TermYr)   : '',
          isRateApply:       r.is_Apply_Rt ? 'Y' : 'N',
          address:           r.address             ?? '',
          pinCode:           r.pin_Cd              ?? '',
          country:           r.country             ?? '',
          state:             r.state               ?? '',
          city:              r.city                ?? '',
          emailId:           r.email_Id            ?? '',
          mobileNo:          r.mobile_No           ?? '',
          personName:        r.contact_Person_Nm   ?? '',
          personMobileNo:    r.contact_Person_No   ?? '',
          businessType:      r.bussiness_Type      ?? '',
          faxNumber:         r.fax_No              ?? '',
          actvInd:           r.actv_Ind != null ? Number(r.actv_Ind) : 1,
        })
      })
      .catch(() => setError('Failed to load insurer details.'))
      .finally(() => setLoading(false))
  }, [insurerCd, isEdit])

  function validate() {
    const errs = []
    if (!form.insurerNm.trim())         errs.push('Insurer Name is required.')
    else if (form.insurerNm.trim().length < 3) errs.push('Insurer Name must be at least 3 characters.')
    if (!form.insurerPrefixCode.trim()) errs.push('Insurer Prefix Code is required.')
    if (!form.agreementTermYear.trim()) errs.push('Agreement Term Year is required.')
    if (!form.address.trim())           errs.push('Address is required.')
    if (!form.emailId.trim()) {
      errs.push('Email Id is required.')
    } else {
      const invalid = form.emailId.split(/[,;]/).map(e => e.trim()).filter(e => e && !EMAIL_RE.test(e))
      if (invalid.length > 0) errs.push(`Invalid email address(es): ${invalid.join(', ')}`)
    }
    if (form.mobileNo.trim() && !/^\d{7,15}$/.test(form.mobileNo.trim()))
      errs.push('Mobile No must be 7–15 digits.')
    if (form.personMobileNo.trim() && !/^\d{7,15}$/.test(form.personMobileNo.trim()))
      errs.push('Person Mobile Number must be 7–15 digits.')
    return errs
  }

  async function handleSubmit() {
    const errs = validate()
    if (errs.length > 0) { setModalMsgs(errs); return }

    setSaving(true)
    try {
      const payload = {
        mode:             isEdit ? 'U' : 'I',
        insurerCd:        insurerCd ?? '',
        insurerNm:        form.insurerNm,
        insPrefixCd:      form.insurerPrefixCode,
        currencyCd:       form.currencyCd,
        insurerType:      form.insurerType,
        agreementStartDt: form.agreementSignedDt || null,
        agreementEndDt:   form.agreementEndDt    || null,
        agreementTermYr:  parseFloat(form.agreementTermYear) || 0,
        exchangeRt:       0,
        isApplyRt:        form.isRateApply === 'Y',
        address:          form.address,
        pinCd:            form.pinCode,
        country:          form.country,
        state:            form.state,
        district:         '',
        city:             form.city,
        emailId:          form.emailId,
        contactPersonNm:  form.personName,
        contactPersonNo:  form.personMobileNo,
        bussinessType:    form.businessType,
        mobileNo:         form.mobileNo,
        faxNo:            form.faxNumber,
        ipdRefCost:       0,
        opdRefCost:       0,
        isTmmc:           0,
        isBlock:          0,
        treatmentPlan:    0,
        caseReport:       0,
        caseApproval:     0,
        invoice:          0,
        intClub:          0,
        cutOffDt:         null,
        actvInd:          form.actvInd,
      }
      await saveInsurer(payload)
      setSuccessMsg(isEdit ? 'Insurer updated successfully!' : 'Insurer registered successfully!')
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to save insurer. Please try again.'])
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
      <SuccessModal message={successMsg} onClose={() => navigate('/master/insurer')} />

      {/* Page header */}
      <div className="page-header-banner" style={{ justifyContent: 'space-between' }}>
        <h2>
          <i className="fas fa-shield-alt" style={{ marginRight: 10 }}></i>
          {isEdit ? `Edit Insurer — ${insurerCd}` : 'Add Insurer'}
        </h2>
        <button className="lead-action-back" onClick={() => navigate('/master/insurer')}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      {error && <div className="lsrch-error" style={{ margin: '12px 0' }}>{error}</div>}

      {/* ── Insurer Information ── */}
      <CollapsibleCard icon="fas fa-shield-alt" title="Insurer Information">
        <div className="prv-form-grid">

          <F label="Insurer Name" required>
            <input className="prv-input" placeholder="Enter insurer name" value={form.insurerNm}
              onChange={e => set('insurerNm', e.target.value)} />
          </F>
          <F label="Insurer Prefix Code" required>
            <input className="prv-input" placeholder="Enter prefix code" value={form.insurerPrefixCode}
              onChange={e => set('insurerPrefixCode', e.target.value.toUpperCase())} />
          </F>

          <F label="Currency Code">
            <select className="prv-select" value={form.currencyCd} onChange={e => set('currencyCd', e.target.value)}>
              {ddlCurrency.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
            </select>
          </F>
          <F label="Insurer Type">
            <select className="prv-select" value={form.insurerType} onChange={e => set('insurerType', e.target.value)}>
              {ddlInsurerType.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
            </select>
          </F>

          <F label="Agreement Signed Date">
            <input className="prv-input" type="date" value={form.agreementSignedDt}
              onChange={e => set('agreementSignedDt', e.target.value)} />
          </F>
          <F label="Agreement End Date">
            <input className="prv-input" type="date" value={form.agreementEndDt}
              onChange={e => set('agreementEndDt', e.target.value)} />
          </F>

          <F label="Agreement Term Year" required>
            <input className="prv-input" type="number" placeholder="e.g. 1" min="0" value={form.agreementTermYear}
              onChange={e => set('agreementTermYear', e.target.value)} />
          </F>
          <F label="Is Rate Apply">
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', height: 38 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="isRateApply" value="Y"
                  checked={form.isRateApply === 'Y'} onChange={() => set('isRateApply', 'Y')} />
                Yes
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="isRateApply" value="N"
                  checked={form.isRateApply === 'N'} onChange={() => set('isRateApply', 'N')} />
                No
              </label>
            </div>
          </F>

          <F label="Address" required full>
            <textarea className="prv-input" placeholder="Enter address" rows={3} value={form.address}
              onChange={e => set('address', e.target.value)}
              style={{ resize: 'vertical', minHeight: 72 }} />
          </F>

          <F label="Pin Code">
            <input className="prv-input" placeholder="Enter pin code" value={form.pinCode}
              inputMode="numeric" onChange={e => set('pinCode', e.target.value.replace(/[^0-9]/g, ''))} />
          </F>
          <F label="Country">
            <select className="prv-select" value={form.country}
              onChange={e => { set('country', e.target.value); set('state', ''); set('city', '') }}>
              {ddlCountry.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
            </select>
          </F>
          <F label="State">
            <select className="prv-select" value={form.state}
              onChange={e => { set('state', e.target.value); set('city', '') }}>
              {ddlState.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
            </select>
          </F>
          <F label="City">
            <select className="prv-select" value={form.city} onChange={e => set('city', e.target.value)}>
              {ddlCity.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
            </select>
          </F>

        </div>
      </CollapsibleCard>

      {/* ── Contact Information ── */}
      <CollapsibleCard icon="fas fa-address-card" title="Contact Information">
        <div className="prv-form-grid">

          <F label="Email Id" required>
            <input className="prv-input" type="email" placeholder="Enter email address" value={form.emailId}
              onChange={e => set('emailId', e.target.value)} />
          </F>
          <F label="Mobile No">
            <input className="prv-input" placeholder="Enter mobile number" value={form.mobileNo}
              inputMode="numeric" onChange={e => set('mobileNo', e.target.value.replace(/[^0-9]/g, ''))} />
          </F>
          <F label="FAX Number">
            <input className="prv-input" placeholder="Enter fax number" value={form.faxNumber}
              onChange={e => set('faxNumber', e.target.value)} />
          </F>
          <F label="Person Name">
            <input className="prv-input" placeholder="Enter contact person name" value={form.personName}
              onChange={e => set('personName', e.target.value)} />
          </F>
          <F label="Person Mobile Number">
            <input className="prv-input" placeholder="Enter person mobile number" value={form.personMobileNo}
              inputMode="numeric" onChange={e => set('personMobileNo', e.target.value.replace(/[^0-9]/g, ''))} />
          </F>
          <F label="Business Type">
            <input className="prv-input" placeholder="Enter business type" value={form.businessType}
              onChange={e => set('businessType', e.target.value)} />
          </F>

        </div>
      </CollapsibleCard>

      {/* ── Status ── */}
      <div className="PF-card-react">
        <div className="PF-card-head-react">
          <div className="PF-card-title-react">
            <span className="PF-card-icon-react"><i className="fas fa-toggle-on"></i></span>
            <span>Status</span>
          </div>
        </div>
        <div className="PF-card-body-react">
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: form.actvInd === 1 ? 600 : 400 }}>
              <input type="radio" name="actvInd" value={1}
                checked={form.actvInd === 1} onChange={() => set('actvInd', 1)} />
              Active
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: form.actvInd === 0 ? 600 : 400 }}>
              <input type="radio" name="actvInd" value={0}
                checked={form.actvInd === 0} onChange={() => set('actvInd', 0)} />
              De-Active
            </label>
          </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20, marginBottom: 32 }}>
        {!isEdit && (
          <button className="lead-action-back" onClick={() => navigate('/master/insurer')}>
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
