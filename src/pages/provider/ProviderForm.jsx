import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  fetchDropdown, fetchMasterItems,
  getProvider, saveProvider,
  uploadDocument, fetchDocuments, deleteDocument, openDocument,
} from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'

const STEPS = [
  { id: 0, label: 'Hospital Info' },
  { id: 1, label: 'Additional Info' },
  { id: 2, label: 'Bank & Referral' },
  { id: 3, label: 'MOU & Documents' },
]

const BLANK   = [{ value: '', text: '--Select--' }]
const LOADING = [{ value: '', text: 'Loading…' }]

const INIT_FORM = {
  prvNm: '', prvAddr: '', pinCd: '', country: '', state: '', district: '',
  location: '', primaryPersonNm: '', primaryMobileNo: '',
  secondaryPersonNm: '', secondaryMobileNo: '',
  landlineNo: '', email: '',
  medPrvRegNo: '', medPrvServTaxRegnNo: '', medYearEstablished: '', medPrvGrade: '',
  panNo: '', providerType: '', noOfBeds: '', domesticPatientsAvg: '', internationalPatientsAvg: '',
  webSiteUrl: '', aboutPrv: '',
  accreditations: [], paymentMode: '', medPrvSpltyDesc: [],
  bankAccTyp: '', curBankAccNm: '', curBankAccNumber: '', curBankBrnCd: '', curBankIfsc: '',
  micrCd: '', ipdDiscount: '', opdDiscount: '', investigationDiscount: '', pharmacyDiscount: '',
  gstinNo: '', gstinPrc: '', referralPrc: '',
}

export default function ProviderForm() {
  const navigate = useNavigate()
  const { prvCd: routePrvCd } = useParams()
  const isEdit = Boolean(routePrvCd)

  const [step,       setStep]       = useState(0)
  const [form,       setForm]       = useState(INIT_FORM)
  const [prvCd,      setPrvCd]      = useState(routePrvCd || '')
  const [saving,              setSaving]              = useState(false)
  const [loading,             setLoading]             = useState(isEdit)
  const [successMsg,          setSuccessMsg]          = useState(null)
  const [pendingNext,         setPendingNext]         = useState(null)
  const [navigateAfterSuccess,setNavigateAfterSuccess]= useState(false)
  const [modalMsgs,           setModalMsgs]          = useState([])
  const [isDirty,             setIsDirty]            = useState(false)
  const [confirmNext,         setConfirmNext]        = useState(null)
  const [confirmFinish,       setConfirmFinish]      = useState(false)

  // Dropdowns
  const [ddlCountry,  setDdlCountry]  = useState(BLANK)
  const [ddlState,    setDdlState]    = useState(BLANK)
  const [ddlDistrict, setDdlDistrict] = useState(BLANK)
  const [ddlGrade,    setDdlGrade]    = useState(BLANK)
  const [ddlProvType, setDdlProvType] = useState(BLANK)
  const [ddlBankType, setDdlBankType] = useState(BLANK)
  const [ddlBank,     setDdlBank]     = useState(BLANK)
  const [ddlDocType,  setDdlDocType]  = useState(BLANK)
  const [chkSpecialty, setChkSpecialty] = useState([])
  const [chkAccredit,  setChkAccredit]  = useState([])
  const [chkPayMode,   setChkPayMode]   = useState([])

  const yearOptions = (() => {
    const yr = new Date().getFullYear()
    const opts = [{ value: '', text: '-- Select --' }]
    for (let y = yr; y >= 1900; y--) opts.push({ value: String(y), text: String(y) })
    return opts
  })()

  // Documents
  const [documents,    setDocuments]    = useState([])
  const [docForm,      setDocForm]      = useState({ docTypeId: '', validFrom: '', validUpto: '' })
  const [docFile,      setDocFile]      = useState(null)
  const [docUploading, setDocUploading] = useState(false)
  const fileRef = useRef(null)

  // ── Static dropdowns ───────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetchDropdown('ddlcountry').then(setDdlCountry),
      fetchMasterItems('ProviderGrade').then(setDdlGrade).catch(() => {}),
      fetchMasterItems('ProviderType').then(setDdlProvType).catch(() => {}),
      fetchMasterItems('BankAccountType').then(setDdlBankType).catch(() => {}),
      fetchMasterItems('Bank').then(setDdlBank).catch(() => {}),
      fetchDropdown('ddlDocumentType', 'PROVIDER').then(setDdlDocType).catch(() => {}),
      fetchMasterItems('ProviderSpecialty').then(d => setChkSpecialty(d.filter(x => x.value))).catch(() => {}),
      fetchMasterItems('Accreditation').then(d => setChkAccredit(d.filter(x => x.value))).catch(() => {}),
      fetchMasterItems('PaymentType').then(d => setChkPayMode(d.filter(x => x.value))).catch(() => {}),
    ])
  }, [])

  // ── Cascade Country → State ────────────────────────────────────────────────
  useEffect(() => {
    if (!form.country) { setDdlState(BLANK); setDdlDistrict(BLANK); return }
    setDdlState(LOADING)
    fetchDropdown('ddlstate', form.country).then(setDdlState).catch(() => setDdlState(BLANK))
  }, [form.country])

  // ── Cascade State → District ───────────────────────────────────────────────
  useEffect(() => {
    if (!form.state) { setDdlDistrict(BLANK); return }
    setDdlDistrict(LOADING)
    fetchDropdown('ddldistrict', form.state).then(setDdlDistrict).catch(() => setDdlDistrict(BLANK))
  }, [form.state])

  // ── Load provider for edit ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return
    getProvider(routePrvCd)
      .then(data => {
        if (!data) return
        setForm({
          prvNm: data.prvNm || '', prvAddr: data.prvAddr || '', pinCd: data.pinCd || '',
          country: data.country || '', state: data.state || '', district: data.district || '',
          location: data.location || '',
          primaryPersonNm: data.primaryPersonNm || '', primaryMobileNo: data.primaryMobileNo || '',
          secondaryPersonNm: data.secondaryPersonNm || '', secondaryMobileNo: data.secondaryMobileNo || '',
          landlineNo: data.landlineNo || '', email: data.email || '',
          medPrvRegNo: data.medPrvRegNo || '', medPrvServTaxRegnNo: data.medPrvServTaxRegnNo || '',
          medYearEstablished: data.medYearEstablished || '', medPrvGrade: data.medPrvGrade || '',
          panNo: data.panNo || '', providerType: data.providerType || '',
          noOfBeds: data.noOfBeds ? String(data.noOfBeds) : '',
          domesticPatientsAvg: data.domesticPatientsAvg ? String(data.domesticPatientsAvg) : '',
          internationalPatientsAvg: data.internationalPatientsAvg ? String(data.internationalPatientsAvg) : '',
          webSiteUrl: data.webSiteUrl || '', aboutPrv: data.aboutPrv || '',
          accreditations: data.accreditations ? data.accreditations.split(',').filter(Boolean) : [],
          paymentMode:    data.paymentMode || '',
          medPrvSpltyDesc: data.medPrvSpltyDesc ? data.medPrvSpltyDesc.split(',').filter(Boolean) : [],
          bankAccTyp: data.bankAccTyp || '', curBankAccNm: data.curBankAccNm || '',
          curBankAccNumber: data.curBankAccNumber || '', curBankBrnCd: data.curBankBrnCd || '',
          curBankIfsc: data.curBankIfsc || '', micrCd: data.micrCd || '',
          ipdDiscount: data.ipdDiscount ? String(data.ipdDiscount) : '',
          opdDiscount: data.opdDiscount ? String(data.opdDiscount) : '',
          investigationDiscount: data.investigationDiscount ? String(data.investigationDiscount) : '',
          pharmacyDiscount: data.pharmacyDiscount ? String(data.pharmacyDiscount) : '',
          gstinNo: data.gstinNo || '', gstinPrc: data.gstinPrc ? String(data.gstinPrc) : '',
          referralPrc: data.referralPrc ? String(data.referralPrc) : '',
        })
        fetchDocuments('PROVIDER', routePrvCd).then(d => setDocuments(d || [])).catch(() => {})
      })
      .catch(() => setModalMsgs(['Failed to load provider details.']))
      .finally(() => setLoading(false))
  }, [isEdit, routePrvCd])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const set = (f, v) => { setForm(prev => ({ ...prev, [f]: v })); setIsDirty(true) }
  const toggleCheck = (f, v) => {
    setForm(prev => {
      const arr = prev[f]
      return { ...prev, [f]: arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v] }
    })
    setIsDirty(true)
  }

  // Per-section validation matching Med_Tour ValidationGroups
  function validateSection(sectionId) {
    const errs = []
    if (sectionId === 0) {
      if (!form.prvNm.trim())             errs.push('Provider Name is required.')
      if (!form.country)                  errs.push('Country is required.')
      if (!form.state)                    errs.push('State is required.')
      if (!form.primaryPersonNm.trim())   errs.push('Primary Person Name is required.')
      if (!form.primaryMobileNo.trim()) {
        errs.push('Primary Mobile No is required.')
      } else if (!/^\d{1,10}$/.test(form.primaryMobileNo.trim())) {
        errs.push('Primary Mobile No must be numeric and up to 10 digits.')
      }
      if (form.secondaryMobileNo.trim() && !/^\d{1,10}$/.test(form.secondaryMobileNo.trim())) {
        errs.push('Secondary Mobile No must be numeric and up to 10 digits.')
      }
      if (!form.email.trim()) {
        errs.push('Email is required.')
      } else {
        const invalidEmails = form.email.split(/[,;]/).map(e => e.trim()).filter(e => e && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(e))
        if (invalidEmails.length > 0) errs.push(`Invalid email address(es): ${invalidEmails.join(', ')}`)
      }
    } else if (sectionId === 1) {
      if (!form.medPrvRegNo.trim())       errs.push('Registration Number is required.')
      if (!form.medYearEstablished)       errs.push('Established Year is required.')
      if (!form.medPrvGrade)              errs.push('Hospital Grade is required.')
      if (!form.panNo.trim())             errs.push('TAN No is required.')
      if (!form.noOfBeds)                 errs.push('No. of Beds is required.')
      if (!form.providerType)             errs.push('Provider Type is required.')
    } else if (sectionId === 2) {
      if (!form.bankAccTyp)               errs.push('Account Type is required.')
      if (!form.curBankAccNumber.trim())  errs.push('Account Number is required.')
      if (!form.curBankAccNm.trim())      errs.push('Account Name is required.')
      if (!form.curBankBrnCd)             errs.push('Bank Name is required.')
      if (!form.curBankIfsc.trim())       errs.push('IFSC / SWIFT is required.')
    }
    return errs
  }

  function buildPayload(sectionId) {
    return {
      id: 0, prvCd: prvCd || '', mode: prvCd ? 'U' : 'I', sectionId,
      prvNm: form.prvNm, prvAddr: form.prvAddr, pinCd: form.pinCd,
      country: form.country, state: form.state, district: form.district, location: form.location,
      primaryPersonNm: form.primaryPersonNm, primaryMobileNo: form.primaryMobileNo,
      secondaryPersonNm: form.secondaryPersonNm, secondaryMobileNo: form.secondaryMobileNo,
      landlineNo: form.landlineNo, email: form.email, statusCd: 0,
      medPrvRegNo: form.medPrvRegNo, medPrvServTaxRegnNo: form.medPrvServTaxRegnNo,
      medYearEstablished: form.medYearEstablished, medPrvGrade: form.medPrvGrade,
      panNo: form.panNo, providerType: form.providerType,
      noOfBeds: Number(form.noOfBeds) || 0,
      domesticPatientsAvg: Number(form.domesticPatientsAvg) || 0,
      internationalPatientsAvg: Number(form.internationalPatientsAvg) || 0,
      webSiteUrl: form.webSiteUrl, aboutPrv: form.aboutPrv, remarks: '',
      accreditations: form.accreditations.join(','),
      paymentMode:    form.paymentMode,
      medPrvSpltyDesc: form.medPrvSpltyDesc.join(','),
      bankAccTyp: form.bankAccTyp, curBankAccNm: form.curBankAccNm,
      curBankAccNumber: form.curBankAccNumber, curBankBrnCd: form.curBankBrnCd,
      curBankIfsc: form.curBankIfsc, micrCd: form.micrCd,
      ipdDiscount: Number(form.ipdDiscount) || 0,
      opdDiscount: Number(form.opdDiscount) || 0,
      investigationDiscount: Number(form.investigationDiscount) || 0,
      pharmacyDiscount: Number(form.pharmacyDiscount) || 0,
      gstinNo: form.gstinNo, gstinPrc: Number(form.gstinPrc) || 0,
      referralPrc: Number(form.referralPrc) || 0,
    }
  }

  // ── Add mode: Save → success popup → navigate to search on OK ───────────
  async function handleAddSave() {
    const errs = validateSection(0)
    if (errs.length) { setModalMsgs(errs); return }
    setSaving(true)
    try {
      const newPrvCd = await saveProvider(buildPayload(0))
      setNavigateAfterSuccess(true)
      setSuccessMsg(`Provider enrolled successfully.${newPrvCd ? ` Code: ${newPrvCd}` : ''}`)
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to save. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  // ── Edit mode: Save section → show success modal → advance on OK ─────────────
  async function handleSave(sectionId, nextStep) {
    const errs = validateSection(sectionId)
    if (errs.length) { setModalMsgs(errs); return }
    setSaving(true)
    try {
      const newPrvCd = await saveProvider(buildPayload(sectionId))
      if (newPrvCd) setPrvCd(newPrvCd)
      setPendingNext(nextStep ?? null)
      setIsDirty(false)
      setSuccessMsg('Section saved successfully.')
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to save. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  function handleFinish() {
    if (docFile || docForm.docTypeId) {
      setConfirmFinish(true)
      return
    }
    doFinish()
  }

  function doFinish() {
    setNavigateAfterSuccess(true)
    setSuccessMsg('Provider information has been saved successfully.')
  }

  function handleSuccessClose() {
    const next    = pendingNext
    const goSearch = navigateAfterSuccess
    setSuccessMsg(null)
    setPendingNext(null)
    setNavigateAfterSuccess(false)
    if (goSearch) navigate('/provider/search')
    else if (next !== undefined && next !== null) setStep(next)
  }

  // ── Document upload ────────────────────────────────────────────────────────
  async function handleDocUpload() {
    if (!docForm.docTypeId) { setModalMsgs(['Please select a document type.']); return }
    if (!docFile)            { setModalMsgs(['Please choose a file to upload.']); return }
    if (!prvCd)              { setModalMsgs(['Please save the provider first.']); return }

    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']
    const ext = docFile.name.split('.').pop().toLowerCase()
    if (!allowedExts.includes(ext)) {
      setModalMsgs(['Invalid file type. Only PDF, JPG, PNG, DOC and DOCX files are allowed.'])
      return
    }

    if (docForm.docTypeId === 'DT01') {
      if (!docForm.validFrom) { setModalMsgs(['Valid From is required for MOU document.']); return }
      if (!docForm.validUpto) { setModalMsgs(['Valid Upto is required for MOU document.']); return }
    }

    if (docForm.validUpto) {
      const today   = new Date(); today.setHours(0, 0, 0, 0)
      const expiry  = new Date(docForm.validUpto)
      if (expiry < today) {
        setModalMsgs(['License expiry date cannot be in the past.'])
        return
      }
      if (docForm.validFrom && new Date(docForm.validFrom) > expiry) {
        setModalMsgs(['Valid Upto date must be after Valid From date.'])
        return
      }
    }
    const docTypeNm = ddlDocType.find(o => o.value === docForm.docTypeId)?.text ?? docForm.docTypeId
    setDocUploading(true)
    try {
      await uploadDocument({ moduleCd: 'PROVIDER', referenceCd: prvCd, docTypeCd: docForm.docTypeId, docTypeNm, validFrom: docForm.validFrom, validUpto: docForm.validUpto, file: docFile, auth: true })
      const docs = await fetchDocuments('PROVIDER', prvCd)
      setDocuments(docs || [])
      setDocForm({ docTypeId: '', validFrom: '', validUpto: '' })
      setDocFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch {
      setModalMsgs(['Failed to upload document.'])
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

  // ── Header ─────────────────────────────────────────────────────────────────
  const header = (
    <div className="common-header">
      <div className="common-header-content">
        <div className="common-header-title-wrapper">
          <h2 className="common-header-title">
            {isEdit ? `Add / Edit — ${form.prvNm} (${prvCd})` : 'Provider Enrollment'}
          </h2>
        </div>
        <button className="lead-action-back" onClick={() => navigate('/provider/search')}>Back</button>
      </div>
    </div>
  )

  if (loading) return (
    <div className="quotation-container">{header}
      <div className="lead-action-loading"><i className="fas fa-spinner fa-spin"></i> Loading…</div>
    </div>
  )

  // ── ADD MODE ───────────────────────────────────────────────────────────────
  if (!isEdit) return (
    <div className="quotation-container">
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />
      <SuccessModal message={successMsg} onClose={handleSuccessClose} />
      {header}
      <div className="PF-panel-title">Provider Enrollment</div>
      <div className="PF-panel-sub">Fill in the provider details for enrollment</div>

      <CollapsibleCard icon="fas fa-hospital" title="Provider Information">
        <BasicInfoFields form={form} set={set} ddlCountry={ddlCountry} ddlState={ddlState} ddlDistrict={ddlDistrict} />
      </CollapsibleCard>

      <CollapsibleCard icon="fas fa-address-book" title="Contact Details">
        <ContactFields form={form} set={set} />
      </CollapsibleCard>

      <div className="PF-form-footer">
        <span />
        <div className="PF-btns">
          <button className="PF-btn-next" onClick={handleAddSave} disabled={saving}>
            {saving
              ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Saving…</>
              : <><i className="fas fa-save"></i>&nbsp;Submit</>}
          </button>
        </div>
      </div>
    </div>
  )

  // ── EDIT MODE ──────────────────────────────────────────────────────────────
  return (
    <div className="quotation-container">
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />
      <SuccessModal message={successMsg} onClose={handleSuccessClose} />
      {confirmNext !== null && (
        <ConfirmContinueModal
          onCancel={() => setConfirmNext(null)}
          onOk={() => { setStep(confirmNext); setConfirmNext(null); setIsDirty(false) }}
        />
      )}
      {confirmFinish && (
        <ConfirmContinueModal
          message="You have a pending document upload. Please complete the upload before finishing, or click OK to continue without uploading."
          onCancel={() => setConfirmFinish(false)}
          onOk={() => { setConfirmFinish(false); doFinish() }}
        />
      )}
      {header}

      {/* Stepper — matches Med_Tour provider.aspx exactly */}
      <div className="PF-stepper-wrap">
        <div className="PF-stepper">
          {STEPS.map((s, i) => {
            const isDone   = step > s.id
            const isActive = step === s.id
            return (
              <React.Fragment key={s.id}>
                <div className={`PF-step-item${isActive ? ' active' : isDone ? ' done' : ''}`}>
                  <div className={`PF-step-circle${isActive ? ' active' : isDone ? ' done' : ''}`}>
                    {isDone ? <i className="fas fa-check" style={{ fontSize: 10 }}></i> : s.id + 1}
                  </div>
                  <span className="PF-step-label">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`PF-step-line${step > s.id ? ' done' : ''}`} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* ── Section 0 ── */}
      {step === 0 && (
        <>
          <CollapsibleCard icon="fas fa-hospital" title="Provider Information">
            <BasicInfoFields form={form} set={set} ddlCountry={ddlCountry} ddlState={ddlState} ddlDistrict={ddlDistrict} />
          </CollapsibleCard>
          <CollapsibleCard icon="fas fa-address-book" title="Contact Details">
            <ContactFields form={form} set={set} />
          </CollapsibleCard>
          <SectionFooter
            step={step} total={STEPS.length} saving={saving}
            onBack={null}
            onSave={() => handleSave(0, 1)}
            onContinue={() => isDirty ? setConfirmNext(1) : setStep(1)}
          />
        </>
      )}

      {/* ── Section 1 ── */}
      {step === 1 && (
        <>
          <CollapsibleCard icon="fas fa-info-circle" title="Medical &amp; Professional Details">
            <AdditionalInfoFields form={form} set={set} toggleCheck={toggleCheck}
              yearOptions={yearOptions}
              ddlGrade={ddlGrade} ddlProvType={ddlProvType}
              chkSpecialty={chkSpecialty} chkAccredit={chkAccredit} chkPayMode={chkPayMode} />
          </CollapsibleCard>
          <SectionFooter
            step={step} total={STEPS.length} saving={saving}
            onBack={() => setStep(0)}
            onSave={() => handleSave(1, 2)}
            onContinue={() => isDirty ? setConfirmNext(2) : setStep(2)}
          />
        </>
      )}

      {/* ── Section 2 ── */}
      {step === 2 && (
        <>
          <CollapsibleCard icon="fas fa-university" title="Bank &amp; Financial Details">
            <BankFields form={form} set={set} ddlBankType={ddlBankType} ddlBank={ddlBank} />
          </CollapsibleCard>
          <SectionFooter
            step={step} total={STEPS.length} saving={saving}
            onBack={() => setStep(1)}
            onSave={() => handleSave(2, 3)}
            onContinue={() => isDirty ? setConfirmNext(3) : setStep(3)}
          />
        </>
      )}

      {/* ── Section 3 ── */}
      {step === 3 && (
        <>
          <CollapsibleCard icon="fas fa-file-alt" title="MOU &amp; Documents">
            <DocumentsSection
              documents={documents} docForm={docForm} setDocForm={setDocForm}
              docFile={docFile} setDocFile={setDocFile} docUploading={docUploading}
              ddlDocType={ddlDocType} fileRef={fileRef}
              onUpload={handleDocUpload} onDelete={handleDocDelete}
              onViewDoc={openDocument}
            />
          </CollapsibleCard>
          <SectionFooter
            step={step} total={STEPS.length} saving={saving}
            onBack={() => setStep(2)}
            onSave={null}
            onContinue={null}
            onFinish={handleFinish}
          />
        </>
      )}

    </div>
  )
}

// ── Section footer: Back / Save / Continue (matches Med_Tour PF-form-footer) ─
function SectionFooter({ step, total, saving, onBack, onSave, onContinue, onFinish }) {
  const stepLabel = ['Hospital Info', 'Additional Info', 'Bank Details', 'Documents'][step] || ''
  return (
    <div className="PF-form-footer">
      <div className="PF-footer-row">
        <div className="PF-step-hint">
          Step <strong>{step + 1}</strong> of {total} &mdash; {stepLabel}
        </div>
        <div className="PF-btns">
          {onBack && (
            <button className="PF-btn-back" onClick={onBack}>
              &#8592; Back
            </button>
          )}
          {onSave && (
            <button className="PF-btn-next" onClick={onSave} disabled={saving}>
              {saving
                ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Saving…</>
                : <><i className="fas fa-save"></i>&nbsp;Update &amp; Continue &#8250;</>}
            </button>
          )}
          {onContinue && (
            <button className="PF-btn-next" onClick={onContinue}>
              Continue &#8250;
            </button>
          )}
          {onFinish && (
            <button className="PF-btn-next" onClick={onFinish}>
              <i className="fas fa-check"></i>&nbsp;Finish
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Success Modal ────────────────────────────────────────────────────────────
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
            <li>
              <i className="fas fa-circle-dot" style={{ color: '#11998e' }}></i>
              {message}
            </li>
          </ul>
        </div>
        <div className="vmodal-footer">
          <button className="vmodal-ok" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }} onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  )
}

// ── Confirm Continue Modal ───────────────────────────────────────────────────
function ConfirmContinueModal({ onCancel, onOk, message }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: 400, padding: '36px 28px 28px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.22)', textAlign: 'center',
        animation: 'vmodal-in 0.18s ease'
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: '#f97316',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 30, color: '#fff', fontWeight: 700, lineHeight: 1
        }}>?</div>
        <p style={{ fontSize: 15, color: '#333', lineHeight: 1.65, margin: '0 0 28px', padding: '0 8px' }}>
          {message || 'You have unsaved changes. Are you sure you want to continue without saving?'}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{
            padding: '9px 32px', borderRadius: 9, border: '1.5px solid #d0d0d0',
            background: '#fff', color: '#555', fontSize: 14, cursor: 'pointer',
            fontFamily: 'inherit', fontWeight: 500
          }}>Cancel</button>
          <button onClick={onOk} style={{
            padding: '9px 32px', borderRadius: 9, border: 'none',
            background: 'linear-gradient(135deg, #632da7 0%, #5c31aa 20%, #d1626a 50%, #dd6c69 75%, #f28b57 100%)',
            color: '#fff', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600
          }}>OK</button>
        </div>
      </div>
    </div>
  )
}

// ── Collapsible Card ─────────────────────────────────────────────────────────
function CollapsibleCard({ icon, title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="PF-card-react">
      <div className="PF-card-head-react" onClick={() => setOpen(o => !o)}>
        <div className="PF-card-title-react">
          <span className="PF-card-icon-react"><i className={icon}></i></span>
          <span dangerouslySetInnerHTML={{ __html: title }} />
        </div>
        <i className={`fas fa-chevron-${open ? 'up' : 'down'} PF-chevron-react`}></i>
      </div>
      {open && <div className="PF-card-body-react">{children}</div>}
    </div>
  )
}

// ── Field helper ─────────────────────────────────────────────────────────────
function F({ label, required, children, cls = '' }) {
  return (
    <div className={`prv-field ${cls}`}>
      <label className="prv-label">
        {label}{required && <span className="prv-required"> *</span>}
      </label>
      {children}
    </div>
  )
}

// ── Section field components ─────────────────────────────────────────────────
function BasicInfoFields({ form, set, ddlCountry, ddlState, ddlDistrict }) {
  return (
    <div className="prv-form-grid">
      <F label="Provider Name" required>
        <input className="prv-input" value={form.prvNm} onChange={e => set('prvNm', e.target.value)} />
      </F>
      <F label="Provider Address" cls="prv-field--full">
        <input className="prv-input" value={form.prvAddr} onChange={e => set('prvAddr', e.target.value)} />
      </F>
      <F label="Pin / Zip Code">
        <input className="prv-input" value={form.pinCd} onChange={e => set('pinCd', e.target.value)} />
      </F>
      <F label="Location / Area">
        <input className="prv-input" value={form.location} onChange={e => set('location', e.target.value)} />
      </F>
      <F label="Country" required>
        <select className="prv-select" value={form.country}
          onChange={e => { set('country', e.target.value); set('state', ''); set('district', '') }}>
          {ddlCountry.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
        </select>
      </F>
      <F label="State">
        <select className="prv-select" value={form.state}
          onChange={e => { set('state', e.target.value); set('district', '') }}>
          {ddlState.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
        </select>
      </F>
      <F label="City">
        <select className="prv-select" value={form.district}
          onChange={e => set('district', e.target.value)}>
          {ddlDistrict.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
        </select>
      </F>
    </div>
  )
}

function ContactFields({ form, set }) {
  return (
    <div className="prv-form-grid">
      <F label="Primary Contact Name" required>
        <input className="prv-input" value={form.primaryPersonNm} onChange={e => set('primaryPersonNm', e.target.value)} />
      </F>
      <F label="Primary Mobile">
        <input className="prv-input" inputMode="numeric" maxLength={10}
          value={form.primaryMobileNo}
          onChange={e => set('primaryMobileNo', e.target.value.replace(/\D/g, '').slice(0, 10))} />
      </F>
      <F label="Secondary Contact Name">
        <input className="prv-input" value={form.secondaryPersonNm} onChange={e => set('secondaryPersonNm', e.target.value)} />
      </F>
      <F label="Secondary Mobile">
        <input className="prv-input" inputMode="numeric" maxLength={10}
          value={form.secondaryMobileNo}
          onChange={e => set('secondaryMobileNo', e.target.value.replace(/\D/g, '').slice(0, 10))} />
      </F>
      <F label="Landline No">
        <input className="prv-input" inputMode="tel" maxLength={13}
          value={form.landlineNo}
          onChange={e => set('landlineNo', e.target.value.replace(/[^0-9-]/g, '').slice(0, 13))} />
      </F>
      <F label="Email" required>
        <input className="prv-input" type="text" value={form.email} onChange={e => set('email', e.target.value)} placeholder="e.g. a@b.com, c@d.com" />
      </F>
    </div>
  )
}

// Allows positive numbers up to 100.00 with max 2 decimal places; blocks e/+/-
function sanitizePct(v) {
  let s = v.replace(/[^\d.]/g, '')
  const dot = s.indexOf('.')
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, 2)
  if (s !== '' && s !== '.' && parseFloat(s) > 100) return '100'
  return s
}

function AdditionalInfoFields({ form, set, toggleCheck, yearOptions, ddlGrade, ddlProvType, chkSpecialty, chkAccredit, chkPayMode }) {
  return (
    <div className="prv-form-grid">
      <F label="Registration No">
        <input className="prv-input" value={form.medPrvRegNo} onChange={e => set('medPrvRegNo', e.target.value)} />
      </F>
      <F label="Service Tax Reg No">
        <input className="prv-input" value={form.medPrvServTaxRegnNo} onChange={e => set('medPrvServTaxRegnNo', e.target.value)} />
      </F>
      <F label="TAN No">
        <input className="prv-input" value={form.panNo} onChange={e => set('panNo', e.target.value)} />
      </F>
      <F label="Year Established">
        <select className="prv-select" value={form.medYearEstablished} onChange={e => set('medYearEstablished', e.target.value)}>
          {yearOptions.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
        </select>
      </F>
      <F label="Hospital Grade">
        <select className="prv-select" value={form.medPrvGrade} onChange={e => set('medPrvGrade', e.target.value)}>
          {ddlGrade.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
        </select>
      </F>
      <F label="Provider Type">
        <select className="prv-select" value={form.providerType} onChange={e => set('providerType', e.target.value)}>
          {ddlProvType.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
        </select>
      </F>
      <F label="No. of Beds">
        <input className="prv-input" inputMode="numeric" placeholder="Enter no. of beds"
          value={form.noOfBeds}
          onChange={e => set('noOfBeds', e.target.value.replace(/\D/g, ''))} />
      </F>
      <F label="Domestic Patients (Avg / Month)">
        <input className="prv-input" inputMode="decimal" value={form.domesticPatientsAvg}
          onChange={e => set('domesticPatientsAvg', sanitizePct(e.target.value))} />
      </F>
      <F label="International Patients (Avg / Month)">
        <input className="prv-input" inputMode="decimal" value={form.internationalPatientsAvg}
          onChange={e => set('internationalPatientsAvg', sanitizePct(e.target.value))} />
      </F>
      <F label="Website URL">
        <input className="prv-input" type="url" value={form.webSiteUrl} onChange={e => set('webSiteUrl', e.target.value)} />
      </F>
      <F label="Specialties">
        <MultiSelectDropdown
          options={chkSpecialty}
          selected={form.medPrvSpltyDesc}
          onChange={vals => set('medPrvSpltyDesc', vals)}
          placeholder="-- Select Specialties --"
        />
      </F>
      <F label="Accreditations">
        <MultiSelectDropdown
          options={chkAccredit}
          selected={form.accreditations}
          onChange={vals => set('accreditations', vals)}
          placeholder="-- Select Accreditations --"
        />
      </F>
      <F label="Payment Mode Accepted" cls="prv-field--full">
        <div className="prv-check-group">
          {chkPayMode.map(p => (
            <label key={p.value} className="prv-check-item">
              <input type="radio" name="paymentMode"
                checked={form.paymentMode === p.value}
                onChange={() => set('paymentMode', p.value)} />
              {p.text}
            </label>
          ))}
        </div>
      </F>
      <F label="About Provider" cls="prv-field--full">
        <textarea className="prv-textarea" rows={3} value={form.aboutPrv} onChange={e => set('aboutPrv', e.target.value)} />
      </F>
    </div>
  )
}

function BankFields({ form, set, ddlBankType, ddlBank }) {
  return (
    <div className="prv-form-grid">
      <F label="Account Type">
        <select className="prv-select" value={form.bankAccTyp} onChange={e => set('bankAccTyp', e.target.value)}>
          {ddlBankType.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
        </select>
      </F>
      <F label="Account Name">
        <input className="prv-input" value={form.curBankAccNm} onChange={e => set('curBankAccNm', e.target.value)} />
      </F>
      <F label="Account Number">
        <input className="prv-input" value={form.curBankAccNumber} onChange={e => set('curBankAccNumber', e.target.value)} />
      </F>
      <F label="Bank">
        <select className="prv-select" value={form.curBankBrnCd} onChange={e => set('curBankBrnCd', e.target.value)}>
          {ddlBank.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
        </select>
      </F>
      <F label="IFSC / SWIFT Code">
        <input className="prv-input" value={form.curBankIfsc} onChange={e => set('curBankIfsc', e.target.value)} />
      </F>
      <F label="IBAN / MICR Code">
        <input className="prv-input" value={form.micrCd} onChange={e => set('micrCd', e.target.value)} />
      </F>
      <F label="IPD Discount (%)">
        <input className="prv-input" inputMode="decimal" placeholder="0.00" value={form.ipdDiscount}
          onChange={e => set('ipdDiscount', sanitizePct(e.target.value))} />
      </F>
      <F label="OPD Discount (%)">
        <input className="prv-input" inputMode="decimal" placeholder="0.00" value={form.opdDiscount}
          onChange={e => set('opdDiscount', sanitizePct(e.target.value))} />
      </F>
      <F label="Investigation Discount (%)">
        <input className="prv-input" inputMode="decimal" placeholder="0.00" value={form.investigationDiscount}
          onChange={e => set('investigationDiscount', sanitizePct(e.target.value))} />
      </F>
      <F label="Pharmacy Discount (%)">
        <input className="prv-input" inputMode="decimal" placeholder="0.00" value={form.pharmacyDiscount}
          onChange={e => set('pharmacyDiscount', sanitizePct(e.target.value))} />
      </F>
      <F label="GSTIN No">
        <input className="prv-input" value={form.gstinNo} onChange={e => set('gstinNo', e.target.value)} />
      </F>
      <F label="GSTIN %">
        <input className="prv-input" inputMode="decimal" placeholder="0.00" value={form.gstinPrc}
          onChange={e => set('gstinPrc', sanitizePct(e.target.value))} />
      </F>
      <F label="Referral %">
        <input className="prv-input" inputMode="decimal" placeholder="0.00" value={form.referralPrc}
          onChange={e => set('referralPrc', sanitizePct(e.target.value))} />
      </F>
    </div>
  )
}

function DocumentsSection({ documents, docForm, setDocForm, docFile, setDocFile, docUploading, ddlDocType, fileRef, onUpload, onDelete, onViewDoc }) {
  return (
    <>
      <div className="prv-form-grid" style={{ marginBottom: 12 }}>
        <F label="Document Type" required>
          <select className="prv-select" value={docForm.docTypeId}
            onChange={e => setDocForm(p => ({ ...p, docTypeId: e.target.value }))}>
            {ddlDocType.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
          </select>
        </F>
        <F label="Valid From">
          <input className="prv-input" type="date" value={docForm.validFrom}
            onChange={e => setDocForm(p => ({ ...p, validFrom: e.target.value }))} />
        </F>
        <F label="Valid Upto">
          <input className="prv-input" type="date" value={docForm.validUpto}
            onChange={e => setDocForm(p => ({ ...p, validUpto: e.target.value }))} />
        </F>
        <F label="Choose File" cls="prv-field--full">
          <input ref={fileRef} className="prv-input" type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={e => setDocFile(e.target.files[0] || null)} />
        </F>
      </div>
      <div style={{ textAlign: 'right', marginBottom: 16 }}>
        <button className="PF-btn-next" onClick={onUpload} disabled={docUploading}>
          {docUploading
            ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Uploading…</>
            : <><i className="fas fa-upload"></i>&nbsp;Upload</>}
        </button>
      </div>
      {documents.length > 0 ? (
        <div className="prv-doc-table-wrapper">
          <table className="prv-doc-table">
            <thead>
              <tr><th>#</th><th>Document Type</th><th>File Name</th><th>Valid From</th><th>Valid Upto</th><th></th></tr>
            </thead>
            <tbody>
              {documents.map((d, i) => (
                <tr key={d.id}>
                  <td>{i + 1}</td>
                  <td>{d.docTypeNm}</td>
                  <td>
                    <button className="prv-doc-link" onClick={() => onViewDoc(d.id)}>
                      <i className="fas fa-file"></i>&nbsp;{d.fileName}
                    </button>
                  </td>
                  <td>{d.validFrom}</td>
                  <td>{d.validUpto}</td>
                  <td>
                    <button className="prv-btn prv-btn-danger" onClick={() => onDelete(d.id)}>
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ color: '#999', fontSize: 13 }}>No documents uploaded yet.</div>
      )}
    </>
  )
}

// ── Multi-Select Dropdown with checkboxes ─────────────────────────────────────
function MultiSelectDropdown({ options, selected, onChange, placeholder = '-- Select --' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const toggle = val =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val])

  const label = selected.length === 0
    ? placeholder
    : options.filter(o => selected.includes(o.value)).map(o => o.text).join(', ')

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <div
        className="prv-select"
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: selected.length === 0 ? '#aaa' : 'inherit' }}>
          {label}
        </span>
        <i className={`fas fa-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 11, marginLeft: 8, color: '#888', flexShrink: 0 }}></i>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', marginTop: 2
        }}>
          {options.length === 0
            ? <div style={{ padding: '10px 12px', color: '#aaa', fontSize: 13 }}>No options available</div>
            : options.map(o => (
                <label key={o.value} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                  cursor: 'pointer', fontSize: 13,
                  background: selected.includes(o.value) ? '#f5f0ff' : 'transparent'
                }}>
                  <input type="checkbox"
                    checked={selected.includes(o.value)}
                    onChange={() => toggle(o.value)}
                    style={{ accentColor: '#632da7', width: 14, height: 14, flexShrink: 0 }} />
                  {o.text}
                </label>
              ))
          }
        </div>
      )}
    </div>
  )
}

