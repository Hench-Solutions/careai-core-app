import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchAgents, saveAgent, fetchDropdown, uploadDocument, fetchDocuments, openDocument, deleteDocument } from '../../utils/api'
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sanitizeName(v)   { return v.replace(/[^a-zA-Z .]/g, '') }
function sanitizeDigits(v) { return v.replace(/[^0-9]/g, '') }

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
  companyName: '', registrationNo: '', registrationCountry: '',
  address1: '', address2: '', city: '', state: '', country: '', pincode: '',
  postalAddress: '', website: '', contactPerson: '', contactNo: '', altContactNo: '',
  email: '', directorId: '',
  commissionType: '', commissionPct: '', otherCommitmentsComm: '',
  beneficiaryName: '', accountNo: '', bankCd: '', swiftCode: '', bankCommitments: '',
  selectedDocType: '',
  actvInd: 1,
}

export default function AgentCompanyForm() {
  const navigate    = useNavigate()
  const { agentCd } = useParams()
  const isEdit      = Boolean(agentCd)

  const [form,      setForm]      = useState(EMPTY_FORM)
  const [loading,   setLoading]   = useState(isEdit)
  const [saving,    setSaving]    = useState(false)
  const [modalMsgs, setModalMsgs] = useState([])
  const [successMsg,setSuccessMsg]= useState('')
  const [error,     setError]     = useState('')
  const [ddlDocType,      setDdlDocType]      = useState([{ value: '', text: '-- Select --' }])
  const [ddlCountry,      setDdlCountry]      = useState([{ value: '', text: '-- Select --' }])
  const [ddlState,        setDdlState]        = useState([{ value: '', text: '-- Select --' }])
  const [ddlCity,         setDdlCity]         = useState([{ value: '', text: '-- Select --' }])
  const [documents,       setDocuments]       = useState([])
  const [pendingDocs,     setPendingDocs]     = useState([])
  const [docTypeCd,       setDocTypeCd]       = useState('')
  const [docFile,         setDocFile]         = useState(null)
  const [docUploading,    setDocUploading]    = useState(false)
  const docFileRef = useRef(null)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  useEffect(() => {
    fetchDropdown('ddlDocumentType', 'AGENT').then(setDdlDocType).catch(() => {})
    fetchDropdown('ddlcountry').then(items => setDdlCountry([{ value: '', text: '-- Select --' }, ...items])).catch(() => {})
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

  // Load data in edit mode
  useEffect(() => {
    if (!isEdit) return
    fetchAgents({ agentCd })
      .then(rows => {
        if (!rows || rows.length === 0) { setError('Agent not found.'); return }
        const r = rows[0]
        setForm({
          companyName:          r.company_Name              ?? '',
          registrationNo:       r.registration_No           ?? '',
          registrationCountry:  r.registration_Country_Cd   ?? '',
          address1:             r.address_Line1              ?? '',
          address2:             r.address_Line2              ?? '',
          city:                 r.city_Cd                   ?? '',
          state:                r.state_Cd                  ?? '',
          country:              r.country_Cd                ?? '',
          pincode:              r.pincode                   ?? '',
          postalAddress:        r.postal_Address            ?? '',
          website:              r.website                   ?? '',
          contactPerson:        r.contact_Person            ?? '',
          contactNo:            r.mobile_No                 ?? '',
          altContactNo:         r.alternate_Mobile_No       ?? '',
          email:                r.email_Id                  ?? '',
          directorId:           r.director_Id_No            ?? '',
          commissionType:       r.commission_Type_Cd        ?? '',
          commissionPct:        r.commission_Pct            ?? '',
          otherCommitmentsComm: r.commission_Commitments    ?? '',
          beneficiaryName:      r.beneficiary_Name          ?? '',
          accountNo:            r.account_No                ?? '',
          bankCd:               r.bank_Cd                   ?? '',
          swiftCode:            r.swift_Code                ?? '',
          bankCommitments:      r.bank_Commitments          ?? '',
          selectedDocType:      '',
          actvInd:              r.actv_Ind != null ? Number(r.actv_Ind) : 1,
        })
      })
      .catch(() => setError('Failed to load agent details.'))
      .finally(() => setLoading(false))
    fetchDocuments('AGENT', agentCd).then(setDocuments).catch(() => {})
  }, [agentCd, isEdit])

  async function handleDocUpload() {
    if (!docTypeCd) { setModalMsgs(['Please select a document type.']); return }
    if (!docFile)   { setModalMsgs(['Please choose a file to upload.']); return }
    const docTypeNm = ddlDocType.find(o => o.value === docTypeCd)?.text ?? docTypeCd

    if (!agentCd) {
      setPendingDocs(prev => [...prev, { tempId: Date.now(), docTypeCd, docTypeNm, file: docFile, fileName: docFile.name }])
      setDocTypeCd('')
      setDocFile(null)
      if (docFileRef.current) docFileRef.current.value = ''
      return
    }

    setDocUploading(true)
    try {
      await uploadDocument({ moduleCd: 'AGENT', referenceCd: agentCd, docTypeCd, docTypeNm, file: docFile, auth: true })
      const updated = await fetchDocuments('AGENT', agentCd)
      setDocuments(updated)
      setDocTypeCd('')
      setDocFile(null)
      if (docFileRef.current) docFileRef.current.value = ''
    } catch {
      setModalMsgs(['Failed to upload document. Please try again.'])
    } finally {
      setDocUploading(false)
    }
  }

  async function handleDocDelete(id) {
    try {
      await deleteDocument(id)
      setDocuments(prev => prev.filter(d => d.id !== id))
    } catch {
      setModalMsgs(['Failed to delete document.'])
    }
  }

  async function handleSubmit() {
    const errs = []
    if (!form.companyName.trim()) errs.push('Company Name is required.')
    if (!form.email.trim())       errs.push('Email is required.')
    else if (!EMAIL_RE.test(form.email.trim())) errs.push('Please enter a valid email address.')
    if (!form.contactNo.trim())   errs.push('Contact Number is required.')
    if (form.commissionPct !== '') {
      const pct = parseFloat(form.commissionPct)
      if (isNaN(pct) || pct < 1 || pct > 50) errs.push('Commission % must be between 1 and 50.')
    }
    if (errs.length > 0) { setModalMsgs(errs); return }

    setSaving(true)
    try {
      const payload = {
        mode:                 isEdit ? 'U' : 'I',
        agentType:            'C',
        agentCd:              agentCd ?? '',
        agentNm:              form.companyName,
        email:                form.email,
        mobile:               form.contactNo,
        altMobile:            form.altContactNo,
        address1:             form.address1,
        address2:             form.address2,
        city:                 form.city,
        state:                form.state,
        country:              form.country,
        pincode:              form.pincode,
        languages:            '',
        companyName:          form.companyName,
        registrationNo:       form.registrationNo,
        registrationCountry:  form.registrationCountry,
        website:              form.website,
        contactPerson:        form.contactPerson,
        directorId:           form.directorId,
        postalAddress:        form.postalAddress,
        commissionType:       form.commissionType,
        commissionPct:        form.commissionPct,
        otherCommitments:     form.otherCommitmentsComm,
        beneficiaryName:      form.beneficiaryName,
        bankCd:               form.bankCd,
        accountNo:            form.accountNo,
        swiftCode:            form.swiftCode,
        bankCommitments:      form.bankCommitments,
        actvInd:              form.actvInd,
        documents:            []
      }
      const result = await saveAgent(payload)
      const savedAgentCd = result?.agentCd ?? agentCd
      if (!isEdit && pendingDocs.length > 0 && savedAgentCd) {
        for (const pd of pendingDocs) {
          try {
            await uploadDocument({ moduleCd: 'AGENT', referenceCd: savedAgentCd, docTypeCd: pd.docTypeCd, docTypeNm: pd.docTypeNm, file: pd.file, auth: true })
          } catch { /* continue uploading remaining */ }
        }
        setPendingDocs([])
      }
      setSuccessMsg(isEdit ? 'Agent updated successfully!' : 'Agent registered successfully!')
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to save agent. Please try again.'])
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
      <SuccessModal message={successMsg} onClose={() => navigate('/agent/search')} />

      {/* Page header */}
      <div className="page-header-banner" style={{ justifyContent: 'space-between' }}>
        <h2><i className="fas fa-building" style={{ marginRight: 10 }}></i>
          {isEdit ? `Edit Company Agent — ${agentCd}` : 'Add Company Agent'}
        </h2>
        <button className="lead-action-back" onClick={() => navigate('/agent/search')}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      {error && <div className="lsrch-error" style={{ margin: '12px 0' }}>{error}</div>}

      {/* ── Section 1: Company Information ── */}
      <CollapsibleCard icon="fas fa-building" title="Company Information">
        <div className="prv-form-grid">
          <F label="Company Name" required full>
            <input className="prv-input" placeholder="Enter company name" value={form.companyName}
              onChange={e => set('companyName', sanitizeName(e.target.value))} />
          </F>

          <F label="Trade License / Registration Number">
            <input className="prv-input" placeholder="Enter license or registration number" value={form.registrationNo}
              onChange={e => set('registrationNo', e.target.value)} />
          </F>
          <F label="Country of Registration">
            <input className="prv-input" placeholder="Enter registration country" value={form.registrationCountry}
              onChange={e => set('registrationCountry', e.target.value)} />
          </F>
          <F label="Address Line 1">
            <input className="prv-input" placeholder="Enter street address" value={form.address1}
              onChange={e => set('address1', e.target.value)} />
          </F>

          <F label="Address Line 2">
            <input className="prv-input" placeholder="Apt / Suite / Floor" value={form.address2}
              onChange={e => set('address2', e.target.value)} />
          </F>
          <F label="Country">
            <select className="prv-select" value={form.country} onChange={e => { set('country', e.target.value); set('state', ''); set('city', '') }}>
              {ddlCountry.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
            </select>
          </F>
          <F label="State">
            <select className="prv-select" value={form.state} onChange={e => { set('state', e.target.value); set('city', '') }}>
              {ddlState.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
            </select>
          </F>
          <F label="City">
            <select className="prv-select" value={form.city} onChange={e => set('city', e.target.value)}>
              {ddlCity.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
            </select>
          </F>
          <F label="Pincode">
            <input className="prv-input" placeholder="Enter postal code" value={form.pincode}
              inputMode="numeric" onChange={e => set('pincode', sanitizeDigits(e.target.value))} />
          </F>
          <F label="Website">
            <input className="prv-input" type="url" placeholder="https://example.com" value={form.website}
              onChange={e => set('website', e.target.value)} />
          </F>
          <F label="Name of the Contact Person">
            <input className="prv-input" placeholder="Enter contact person's name" value={form.contactPerson}
              onChange={e => set('contactPerson', sanitizeName(e.target.value))} />
          </F>
          <F label="Contact Number">
            <input className="prv-input" placeholder="Enter phone number" value={form.contactNo}
              inputMode="numeric" onChange={e => set('contactNo', sanitizeDigits(e.target.value))} />
          </F>

          <F label="Alternate Contact Number">
            <input className="prv-input" placeholder="Enter alternate phone number" value={form.altContactNo}
              inputMode="numeric" onChange={e => set('altContactNo', sanitizeDigits(e.target.value))} />
          </F>
          <F label="Email">
            <input className="prv-input" type="email" placeholder="name@company.com" value={form.email}
              onChange={e => set('email', e.target.value)} />
          </F>
          <F label="Passport / National ID of Director or Owner">
            <input className="prv-input" placeholder="Enter ID or passport number" value={form.directorId}
              onChange={e => set('directorId', e.target.value)} />
          </F>
        </div>
      </CollapsibleCard>

      {/* ── Section 2: Commission & Referral ── */}
      <CollapsibleCard icon="fas fa-file-invoice-dollar" title="Commission &amp; Referral Information">
        <div className="prv-form-grid">
          <F label="Commission Type">
            <input className="prv-input" placeholder="e.g., Standard, Tiered" value={form.commissionType}
              onChange={e => set('commissionType', e.target.value)} />
          </F>
          <F label="Commission %age">
            <input className="prv-input" placeholder="e.g., 10" value={form.commissionPct}
              onChange={e => { const v = e.target.value; if (/^(\d{0,2}(\.\d*)?|50(\.0*)?)$/.test(v)) set('commissionPct', v) }} />
          </F>
          <F label="Any other Commitments - Commercials">
            <input className="prv-input" placeholder="Enter additional details" value={form.otherCommitmentsComm}
              onChange={e => set('otherCommitmentsComm', e.target.value)} />
          </F>
        </div>
      </CollapsibleCard>

      {/* ── Section 3: Bank Details ── */}
      <CollapsibleCard icon="fas fa-university" title="Bank Details">
        <div className="prv-form-grid">
          <F label="Beneficiary Name">
            <input className="prv-input" placeholder="Enter official account name" value={form.beneficiaryName}
              onChange={e => set('beneficiaryName', e.target.value)} />
          </F>
          <F label="IBAN / Account Number">
            <input className="prv-input" placeholder="Enter account or IBAN number" value={form.accountNo}
              onChange={e => set('accountNo', e.target.value)} />
          </F>
          <F label="Bank Name / Code">
            <input className="prv-input" placeholder="Enter bank name or code" value={form.bankCd}
              onChange={e => set('bankCd', e.target.value)} />
          </F>

          <F label="Any other Commitments - Commercials">
            <input className="prv-input" placeholder="Enter commercial notes" value={form.bankCommitments}
              onChange={e => set('bankCommitments', e.target.value)} />
          </F>
          <F label="SWIFT Code (Optional)">
            <input className="prv-input" placeholder="Enter bank SWIFT code" value={form.swiftCode}
              onChange={e => set('swiftCode', e.target.value)} />
          </F>
          <F label="Bank Proof">
            <span className="agent-file-note">Upload bank proof via the Documents section below.</span>
          </F>
        </div>
      </CollapsibleCard>

      {/* ── Section 4: Documents Upload ── */}
      <CollapsibleCard icon="fas fa-upload" title="Documents - Upload">
        {!isEdit && (
          <div style={{ color: '#888', fontSize: 13, padding: '4px 0 12px' }}>
            <i className="fas fa-info-circle" style={{ marginRight: 6 }}></i>
            Save the agent first to enable document uploads.
          </div>
        )}
        <div className="prv-form-grid" style={{ marginBottom: 12 }}>
          <F label="Document Type" required>
            <select className="prv-select" value={docTypeCd} onChange={e => setDocTypeCd(e.target.value)}>
              {ddlDocType.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
            </select>
          </F>
          <F label="Choose File" span2>
            <input ref={docFileRef} className="prv-input" type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={e => setDocFile(e.target.files[0] || null)} />
          </F>
        </div>
        <div style={{ textAlign: 'right', marginBottom: 16 }}>
          <button className="PF-btn-next" onClick={handleDocUpload} disabled={docUploading}>
            {docUploading
              ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Uploading…</>
              : <><i className="fas fa-upload"></i>&nbsp;Upload</>}
          </button>
        </div>
        {(documents.length > 0 || pendingDocs.length > 0) && (
          <div className="prv-doc-table-wrapper">
            <table className="prv-doc-table">
              <thead>
                <tr><th>#</th><th>Document Type</th><th>File</th><th>Uploaded</th><th></th></tr>
              </thead>
              <tbody>
                {documents.map((d, i) => (
                  <tr key={d.id}>
                    <td>{i + 1}</td>
                    <td>{d.docTypeNm}</td>
                    <td>
                      <button className="prv-doc-link" onClick={() => openDocument(d.id)}>
                        <i className="fas fa-file"></i>&nbsp;{d.originalFileName || d.fileName}
                      </button>
                    </td>
                    <td>{d.uploadedDt}</td>
                    <td>
                      <button className="prv-btn prv-btn-danger" onClick={() => handleDocDelete(d.id)}>
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
                {pendingDocs.map((pd, i) => (
                  <tr key={pd.tempId}>
                    <td>{documents.length + i + 1}</td>
                    <td>{pd.docTypeNm}</td>
                    <td><i className="fas fa-file"></i>&nbsp;{pd.fileName} <span style={{ color: '#e67e22', fontSize: 11 }}>(pending)</span></td>
                    <td>—</td>
                    <td>
                      <button className="prv-btn prv-btn-danger" onClick={() => setPendingDocs(prev => prev.filter(p => p.tempId !== pd.tempId))}>
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {documents.length === 0 && pendingDocs.length === 0 && isEdit && (
          <div style={{ color: '#999', fontSize: 13 }}>No documents uploaded yet.</div>
        )}
      </CollapsibleCard>

      {/* Active / De-Active */}
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
                checked={form.actvInd === 1}
                onChange={() => set('actvInd', 1)} />
              Active
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: form.actvInd === 0 ? 600 : 400 }}>
              <input type="radio" name="actvInd" value={0}
                checked={form.actvInd === 0}
                onChange={() => set('actvInd', 0)} />
              De-Active
            </label>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="PF-form-footer">
        <div className="PF-btns" style={{ justifyContent: 'flex-end' }}>
        <button className="PF-btn-next" onClick={handleSubmit} disabled={saving}>
          {saving
            ? <><i className="fas fa-spinner fa-spin"></i> Saving…</>
            : <><i className="fas fa-save"></i> {isEdit ? 'Update' : 'Submit'}</>}
        </button>
        </div>
      </div>

    </div>
  )
}
