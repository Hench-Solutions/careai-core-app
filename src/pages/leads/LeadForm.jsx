import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { fetchDropdown, fetchMasterItems, fetchCallingCodes, fetchProvidersWithLocation, saveLead, uploadDocument, getLeadByClaimNo, fetchDocumentBlob, fetchDocuments, openDocument, getProvider } from '../../utils/api'
import { authUtils } from '../../utils/auth'
import CallingCodeSelect from '../../components/CallingCodeSelect'
import ValidationModal from '../../components/ValidationModal'
import SearchMemberModal from '../../components/SearchMemberModal'
import CodeSearchModal from '../../components/CodeSearchModal'

const STEP_PROGRESS_ADD  = { 1: '0%',  2: '25%', 3: '50%', 4: '75%'  }
const STEP_PROGRESS_EDIT = { 1: '25%', 2: '50%', 3: '75%', 4: '100%' }

const BLANK    = [{ value: '', text: '--Select--' }]
const LOADING  = [{ value: '', text: 'Loading...' }]

const ALLOWED_DOC_EXTS  = ['.jpg', '.jpeg', '.png', '.pdf']
const ALLOWED_DOC_LABEL = 'JPEG, JPG, PNG, PDF'

const initialForm = {
  // Step 1
  source: '', insurer: '',
  firstName: '', middleName: '', lastName: '',
  email: '', dob: '', gender: '', nationality: '',
  callingCode: '', mobile: '', mobileOther: '',
  commChannel: '',
  category: 'Normal',
  patientLocation: '', documentType: '', idNo: '',
  idFile: null,
  // Step 2
  treatmentType: '', department: '', provider: '', branch: '', doctor: '',
  icdCode: '', icdDesc: '', cptCode: '', cptDesc: '',
  diagnosis: '', treatment: '',
  medicalFiles: [],
  remarks: '',
  // Step 3
  paymentMode: '', guarantor: '',
  // Step 4
  assignedTo: '', referringAgent: '',
}

// Shared by Edit mode and Subset mode — both pre-populate the form from an
// existing claim's detail, they just differ in what happens after (Edit
// keeps the same claim no/status/documents; Subset starts all of that fresh).
// fullCopy=false (Subset mode) returns only Customer Information — Medical
// Information and Assignment stay blank, and Payee Information is left out
// entirely so it derives naturally like a brand-new lead (see the
// source/insurer → paymentMode/guarantor effect further down).
function mapLeadDetailToForm(data, prev, fullCopy = true) {
  const customerInfo = {
    source:          data.source          ?? '',
    insurer:         data.insurerCd        ?? '',
    firstName:       data.firstName        ?? '',
    middleName:      data.middleName       ?? '',
    lastName:        data.lastName         ?? '',
    email:           data.emailId          ?? '',
    dob:             data.dob              ?? '',
    gender:          data.gender           ?? '',
    nationality:     data.nationality      ?? '',
    callingCode:     data.callingCd        ?? prev.callingCode,
    mobile:          data.mobileNo         ?? '',
    mobileOther:     data.mobileOther      ?? '',
    commChannel:     data.commChannel      ?? '',
    category:        data.leadType         ?? 'Normal',
    patientLocation: data.patientLocation  ?? '',
    documentType:    data.documentType     ?? '',
    idNo:            data.documentNo       ?? '',
  }

  if (!fullCopy) return customerInfo

  return {
    ...customerInfo,
    treatmentType:   data.treatmentType    ?? '',
    department:      data.department       ?? '',
    provider:        data.providerCd       ?? '',
    branch:          data.branchCd         ?? '',
    doctor:          data.doctorCd         ?? '',
    icdCode:         data.icdCode          ?? '',
    icdDesc:         data.icdDesc          ?? '',
    cptCode:         data.cptCode          ?? '',
    cptDesc:         data.cptDesc          ?? '',
    diagnosis:       data.diagnosis        ?? '',
    treatment:       data.treatment        ?? '',
    remarks:         data.caseNote         ?? '',
    paymentMode:     data.paymentMode      ?? '',
    guarantor:       data.guarantor        ?? '',
    assignedTo:      data.caseManager      ?? '',
    referringAgent:  data.agentCd          ?? '',
  }
}

export default function LeadForm() {
  const { claimNo: editClaimNo, sourceClaimNo } = useParams()   // editClaimNo: /lead/edit/:claimNo — undefined = new lead
                                                                 // sourceClaimNo: /lead/subset/:sourceClaimNo — the root claim being subset-ed
  const isEditMode   = !!editClaimNo
  const isSubsetMode = !!sourceClaimNo
  const navigate   = useNavigate()
  const location   = useLocation()

  const [step, setStep]         = useState(1)
  const [memberSearch,     setMemberSearch]     = useState({ open: false })
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [form, setForm]         = useState(initialForm)
  const [errors, setErrors]     = useState({})
  const [submitted,  setSubmitted]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState('')
  // Synchronous guard against a double-click/double-submit — `saving` state
  // alone has a render-timing gap (the button doesn't visually disable until
  // the next render), which let a fast second click fire handleSubmit again
  // and create a duplicate claim. A ref updates instantly, closing that gap.
  const submittingRef = useRef(false)
  const [modalMsgs,  setModalMsgs]  = useState([])
  const [savedIds,  setSavedIds]  = useState({ memberId: '', claimNo: '' })
  const [currentStatusCd, setCurrentStatusCd] = useState(0)
  const [loading,   setLoading]   = useState(isEditMode || isSubsetMode)  // true while fetching existing lead
  const [existingIdDoc,          setExistingIdDoc]          = useState(null)
  const [existingMedicalDocs,    setExistingMedicalDocs]    = useState([])
  const [medicalDocsExpanded,    setMedicalDocsExpanded]    = useState(false)
  const [idFileError,            setIdFileError]            = useState('')
  const [medFileError,           setMedFileError]           = useState('')
  const [isDirty,                setIsDirty]                = useState(false)
  const [pendingPath,            setPendingPath]            = useState(null)
  const [showLeaveConfirm,       setShowLeaveConfirm]       = useState(false)
  const [codeSearchModal,        setCodeSearchModal]        = useState(null)
  const medicalFileRef          = useRef(null)
  const idFileRef               = useRef(null)

  /* ── Dropdown state ─────────────────────────────────────────── */
  const [ddlSource,        setDdlSource]        = useState(BLANK)
  const [ddlInsurer,       setDdlInsurer]        = useState(BLANK)
  const [ddlCommChannel,   setDdlCommChannel]    = useState(BLANK)
  const [ddlGender,        setDdlGender]         = useState(BLANK)
  const [ddlNationality,   setDdlNationality]    = useState(BLANK)
  const [ddlCallingCodes,  setDdlCallingCodes]   = useState([])
  const [ddlPatientLoc,    setDdlPatientLoc]     = useState(BLANK)
  const [ddlDocType,       setDdlDocType]        = useState(BLANK)
  const [ddlTreatmentType, setDdlTreatmentType]  = useState(BLANK)
  const [ddlDepartment,    setDdlDepartment]     = useState(BLANK)
  const [allProviderItems, setAllProviderItems]  = useState([])
  const [selCountry,       setSelCountry]        = useState('')
  const [selCity,          setSelCity]           = useState('')
  const [ddlBranch,        setDdlBranch]         = useState(BLANK)
  const [ddlDoctor,        setDdlDoctor]         = useState(BLANK)
  const [providerLocked,   setProviderLocked]    = useState(false)
  const [lockedLocation,   setLockedLocation]    = useState(null)
  const [ddlPaymentMode,   setDdlPaymentMode]    = useState(BLANK)
  const [ddlGuarantor,     setDdlGuarantor]      = useState(BLANK)
  const [ddlCrm,           setDdlCrm]            = useState(BLANK)
  const [ddlAgent,         setDdlAgent]          = useState(BLANK)

  /* ── Pre-populate from MemberSearch page (location.state) ──── */
  useEffect(() => {
    const member = location.state?.member
    if (!member) return
    const parts = (member.fullName || '').trim().split(/\s+/)
    setSelectedMemberId(member.memberId || '')
    setForm(prev => ({
      ...prev,
      firstName:   parts[0]                              || '',
      middleName:  parts.length === 3 ? parts[1]        : '',
      lastName:    parts.length >= 2 ? parts[parts.length - 1] : '',
      email:       member.email       || '',
      mobile:      member.mobileNo    || '',
      idNo:        member.nationalId  || '',
      dob:         member.dob         || '',
      gender:      member.gender      || '',
      nationality: member.nationality || '',
      callingCode: member.callingCd   || '',
    }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Load all static dropdowns on mount ────────────────────── */
  useEffect(() => {
    fetchDropdown('DrpSource').then(setDdlSource).catch(() => setDdlSource(BLANK))
    fetchMasterItems('Gender').then(setDdlGender).catch(() => setDdlGender(BLANK))
    fetchMasterItems('Communication_Channel').then(setDdlCommChannel).catch(() => setDdlCommChannel(BLANK))
    fetchDropdown('ddlNationality').then(setDdlNationality).catch(() => setDdlNationality(BLANK))
    fetchDropdown('ddlPatientLocation').then(setDdlPatientLoc).catch(() => setDdlPatientLoc(BLANK))
    fetchDropdown('ddlDocumentType', 'LEAD_ID').then(setDdlDocType).catch(() => setDdlDocType(BLANK))
    fetchMasterItems('TreatmentType').then(setDdlTreatmentType).catch(() => setDdlTreatmentType(BLANK))
    fetchProvidersWithLocation().then(setAllProviderItems).catch(() => setAllProviderItems([]))
    fetchMasterItems('PaymentMode').then(setDdlPaymentMode).catch(() => setDdlPaymentMode(BLANK))
    fetchDropdown('drpCrm').then(setDdlCrm).catch(() => setDdlCrm(BLANK))
    fetchCallingCodes().then(setDdlCallingCodes).catch(() => setDdlCallingCodes([]))
  }, [])

  /* ── Cascade: Assigned To (Case Manager) → Referring Agent ─── */
  useEffect(() => {
    if (!form.assignedTo) { setDdlAgent(BLANK); return }
    setDdlAgent(LOADING)
    fetchDropdown('drpReferingAgent', form.assignedTo)
      .then(items => setDdlAgent(items.length ? items : BLANK))
      .catch(() => setDdlAgent(BLANK))
  }, [form.assignedTo])

  /* ── Cascade: Source → Insurer ──────────────────────────────── */
  useEffect(() => {
    if (!form.source) { setDdlInsurer(BLANK); return }
    setDdlInsurer(LOADING)
    fetchDropdown('EntityBySourceCd', form.source)
      .then(setDdlInsurer)
      .catch(() => setDdlInsurer(BLANK))
  }, [form.source])

  /* ── Auto-set GOP + Guarantor when Source = Insurance (SR0006) ─ */
  useEffect(() => {
    if (!form.source) return
    if (form.source === 'SR0006' && form.insurer) {
      setForm(prev => ({ ...prev, paymentMode: 'PM0002', guarantor: form.insurer }))
    } else if (form.source !== 'SR0006' && !isEditMode) {
      setForm(prev => ({ ...prev, paymentMode: 'PM0001', guarantor: '' }))
    }
  }, [form.source, form.insurer])

  /* ── Cascade: PaymentMode → Guarantor ───────────────────────── */
  /* Each payment mode sources guarantors from a different table:             */
  /* PM0001 Self Pay → MT_MasterItem(Self Pay)                                */
  /* PM0002 GOP Insurance → MT_Insurer                                        */
  /* PM0003 Bank Finance → MT_MasterItem(Bank)                                */
  /* PM0004 Government Finance → MT_MasterItem(GovernmentFinance)             */
  useEffect(() => {
    if (!form.paymentMode) { setDdlGuarantor(BLANK); return }
    setDdlGuarantor(LOADING)
    fetchDropdown('drpGuarantor', form.paymentMode)
      .then(setDdlGuarantor)
      .catch(() => setDdlGuarantor(BLANK))
  }, [form.paymentMode])

  /* ── Cascade: TreatmentType → Department ───────────────────── */
  useEffect(() => {
    if (!form.treatmentType) { setDdlDepartment(BLANK); return }
    setDdlDepartment(LOADING)
    fetchMasterItems('ProviderDepartment', form.treatmentType)
      .then(setDdlDepartment)
      .catch(() => setDdlDepartment(BLANK))
  }, [form.treatmentType])

  /* ── Cascade: Provider → Branch + Doctor ───────────────────── */
  useEffect(() => {
    if (!form.provider) {
      setDdlBranch(BLANK)
      setDdlDoctor(BLANK)
      return
    }
    setDdlBranch(LOADING)
    setDdlDoctor(LOADING)
    fetchDropdown('DrpBranch', form.provider)
      .then(setDdlBranch).catch(() => setDdlBranch(BLANK))
    fetchDropdown('drpDoctor', form.provider)
      .then(setDdlDoctor).catch(() => setDdlDoctor(BLANK))
  }, [form.provider])

  /* ── Sync Country/City when provider is pre-set (edit mode) ── */
  useEffect(() => {
    if (!form.provider || !allProviderItems.length) return
    const match = allProviderItems.find(i => i.prv_Cd === form.provider)
    if (match) {
      setSelCountry(match.country_Cd)
      setSelCity(match.city_Cd)
    }
  }, [form.provider, allProviderItems])

  /* ── Provider-portal user: lock Country/City/Hospital to their own provider ── */
  useEffect(() => {
    const user = authUtils.getUser()
    if (user?.location_Code !== 'Provider' || !user?.prv_Cd) return
    getProvider(user.prv_Cd).then(data => {
      if (!data) return
      setLockedLocation({
        countryCd: data.country ?? '', countryNm: data.countryNm ?? '',
        cityCd:    data.state ?? '',   cityNm:    data.stateNm ?? '',
        prvCd:     data.prvCd ?? '',   prvNm:     data.prvNm ?? '',
      })
      setSelCountry(data.country ?? '')
      setSelCity(data.state ?? '')
      setForm(prev => ({ ...prev, provider: data.prvCd ?? '' }))
      setProviderLocked(true)
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Edit mode: fetch and pre-populate ─────────────────────── */
  useEffect(() => {
    if (!isEditMode) return
    setLoading(true)
    getLeadByClaimNo(editClaimNo)
      .then(data => {
        if (!data) return
        setForm(prev => ({ ...prev, ...mapLeadDetailToForm(data, prev) }))
        setSavedIds({ memberId: data.memberId ?? '', claimNo: data.claimNo ?? '' })
        setCurrentStatusCd(data.statusCd ?? 0)
        // Load documents from MT_AppDocument (new unified table)
        fetchDocuments('LEAD', data.claimNo ?? editClaimNo).then(docs => {
          setExistingIdDoc(docs.find(d => d.docTypeCd === '303') ?? null)
          setExistingMedicalDocs(docs.filter(d => d.docTypeCd === '316'))
        }).catch(() => {})
      })
      .catch(err => setSaveError(err.message || 'Failed to load lead details.'))
      .finally(() => setLoading(false))
  }, [editClaimNo]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Subset mode: fetch the root claim and pre-populate, but as a fresh
     claim — same member, no carried-over claim no/status/documents. The
     user uploads new documents for the subset from scratch. ───────────── */
  useEffect(() => {
    if (!isSubsetMode) return
    setLoading(true)
    getLeadByClaimNo(sourceClaimNo)
      .then(data => {
        if (!data) return
        setForm(prev => ({ ...prev, ...mapLeadDetailToForm(data, prev, false) }))
        setSelectedMemberId(data.memberId ?? '')   // reuse the same patient/member
      })
      .catch(err => setSaveError(err.message || 'Failed to load the source claim.'))
      .finally(() => setLoading(false))
  }, [sourceClaimNo]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Field change ───────────────────────────────────────────── */
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e })
    setIsDirty(true)
  }

  /* ── Cascading field changes ────────────────────────────────── */
  const onSourceChange = val => {
    setForm(prev => ({ ...prev, source: val, insurer: '', paymentMode: '', guarantor: '' }))
    if (errors.source) setErrors(prev => { const e = { ...prev }; delete e.source; return e })
  }

  const onTreatmentTypeChange = val => {
    setForm(prev => ({ ...prev, treatmentType: val, department: '' }))
  }

  const onCountryChange = val => {
    setSelCountry(val)
    setSelCity('')
    setForm(prev => ({ ...prev, provider: '', branch: '', doctor: '' }))
  }

  const onCityChange = val => {
    setSelCity(val)
    setForm(prev => ({ ...prev, provider: '', branch: '', doctor: '' }))
  }

  const onProviderChange = val => {
    setForm(prev => ({ ...prev, provider: val, branch: '', doctor: '' }))
  }

  const onPaymentModeChange = val => {
    setForm(prev => ({ ...prev, paymentMode: val, guarantor: '' }))
  }

  const onNationalityChange = val => {
    const selectedText = ddlNationality.find(o => o.value === val)?.text ?? ''
    const matched = ddlCallingCodes.find(c =>
      c.isoCode === val ||
      c.country_Nm?.toLowerCase() === val.toLowerCase() ||
      c.country_Nm?.toLowerCase() === selectedText.toLowerCase()
    )
    setForm(prev => ({ ...prev, nationality: val, callingCode: matched ? matched.value : '' }))
    if (errors.nationality) setErrors(prev => { const e = { ...prev }; delete e.nationality; return e })
  }

  /* ── Medical file handling ──────────────────────────────────── */
  const handleMedicalFiles = e => {
    const incoming = Array.from(e.target.files)
    const invalid  = incoming.filter(f => !ALLOWED_DOC_EXTS.includes('.' + f.name.split('.').pop().toLowerCase()))
    if (invalid.length) {
      e.target.value = ''
      setMedFileError(`Only ${ALLOWED_DOC_LABEL} files are allowed.`)
      return
    }
    setMedFileError('')
    setIsDirty(true)
    setForm(prev => ({ ...prev, medicalFiles: [...prev.medicalFiles, ...incoming] }))
  }
  const removeMedicalFile = idx => {
    setForm(prev => ({ ...prev, medicalFiles: prev.medicalFiles.filter((_, i) => i !== idx) }))
  }

  /* ── Validation per step ────────────────────────────────────── */
  const validate = stepNum => {
    const e = {}
    if (stepNum === 1) {
      if (!form.source)           e.source       = 'Lead Source is required'
      if (!form.firstName.trim()) e.firstName    = 'First Name is required'
      if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address'
      if (!form.gender)           e.gender       = 'Gender is required'
      if (!form.callingCode)      e.callingCode   = 'Calling Code is required'
      if (!form.patientLocation)  e.patientLocation = 'Patient Location is required'
      if (!form.documentType)     e.documentType = 'Document Type is required'
      if (!form.idNo.trim())      e.idNo         = 'ID Number is required'
    }
    if (stepNum === 2) {
      if (!form.treatmentType) e.treatmentType = 'Treatment Type is required'
      if (!form.remarks.trim()) e.remarks      = 'Case Notes are required'
    }
    if (stepNum === 3) {
      if (!form.paymentMode) e.paymentMode = 'Payment Mode is required'
      if (!form.guarantor)   e.guarantor   = form.paymentMode === 'PM0001' ? 'Payment Type is required' : 'Guarantor is required'
    }
    if (stepNum === 4) {
      if (!form.assignedTo) e.assignedTo = 'Assigned To is required'
    }
    return e
  }

  const goNext = () => {
    const e = validate(step)
    if (Object.keys(e).length) { setErrors(e); setModalMsgs(Object.values(e)); return }
    setStep(s => s + 1)
  }
  const goPrev = () => setStep(s => s - 1)

  const handleSubmit = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    try {
    const e = validate(4)
    if (Object.keys(e).length) { setErrors(e); setModalMsgs(Object.values(e)); return }

    setSaving(true)
    setSaveError('')
    try {
      const result = await saveLead({
        claimNo:         isEditMode ? editClaimNo : '',   // empty = INSERT, populated = UPDATE
        subsetOfClaimNo: isSubsetMode ? sourceClaimNo : '', // populated = this INSERT becomes a Subset Claim
        memberId:       selectedMemberId,                // pre-selected from search; skips MT_MemberRegistration insert
        source: form.source, insurerCd: form.insurer,
        firstName: form.firstName, middleName: form.middleName, lastName: form.lastName,
        emailId: form.email, dob: form.dob,
        gender: form.gender, nationality: form.nationality,
        callingCd: form.callingCode, mobileNo: form.mobile, mobileOther: form.mobileOther,
        commChannel: form.commChannel,
        leadType: form.category,
        patientLocation: form.patientLocation,
        documentType: form.documentType, documentNo: form.idNo,
        treatmentType: form.treatmentType, department: form.department,
        providerCd: form.provider, branchCd: form.branch, doctorCd: form.doctor,
        icdCode: form.icdCode, icdDesc: form.icdDesc,
        cptCode: form.cptCode, cptDesc: form.cptDesc,
        diagnosis: form.diagnosis, treatment: form.treatment,
        caseNote: form.remarks,
        paymentMode: form.paymentMode, guarantor: form.guarantor,
        caseManager: form.assignedTo, agentCd: form.referringAgent,
        // Status — new lead gets 301; edit mode passes current status unchanged
        statusCd:      isEditMode ? currentStatusCd : 301,
        statusRemarks: isEditMode ? 'Lead Updated' : 'Lead Registered',
      })

      const claimNo  = result?.claim_No  ?? editClaimNo ?? ''
      const memberId = result?.member_Id ?? savedIds.memberId ?? ''

      // Upload documents if any were selected
      const hasFiles = form.idFile || form.medicalFiles.length > 0
      if (claimNo && hasFiles) {
        try {
          if (form.idFile) {
            await uploadDocument({ moduleCd: 'LEAD', referenceCd: claimNo, memberId, docTypeCd: '303', docTypeNm: 'Id Proof(Pan Card)', file: form.idFile, auth: true })
          }
          for (const f of form.medicalFiles) {
            await uploadDocument({ moduleCd: 'LEAD', referenceCd: claimNo, memberId, docTypeCd: '316', docTypeNm: 'Medical Documents', file: f, auth: true })
          }
        } catch (uploadErr) {
          console.warn('Document upload failed:', uploadErr.message)
          // Lead is saved — don't block submission on upload failure
        }
      }

      setSavedIds({ memberId, claimNo })
      setIsDirty(false)
      setSubmitted(true)
    } catch (err) {
      setSaveError(err.message || 'Failed to save lead. Please try again.')
    } finally {
      setSaving(false)
    }
    } finally {
      submittingRef.current = false
    }
  }

  const handleReset = () => {
    if (isEditMode) {
      setIsDirty(false)
      navigate('/lead')   // leave edit URL entirely — fresh new lead
      return
    }
    setForm(initialForm)
    setErrors({})
    setIsDirty(false)
    setStep(1)
    setSubmitted(false)
    setSaveError('')
    setSavedIds({ memberId: '', claimNo: '' })
  }

  /* ── Unsaved-changes guard ──────────────────────────────────── */
  useEffect(() => {
    if (!isDirty) return
    const handler = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  useEffect(() => {
    if (!isDirty) return
    const handleClick = e => {
      const link = e.target.closest('a')
      if (!link) return
      const href = link.getAttribute('href')
      if (!href || link.target === '_blank' || link.download || !href.startsWith('/')) return
      e.preventDefault()
      e.stopPropagation()
      setPendingPath(href)
      setShowLeaveConfirm(true)
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [isDirty])

  /* ── View existing document ────────────────────────────────── */
  const openDoc = async (fileName) => {
    try {
      const blob = await fetchDocumentBlob(editClaimNo, fileName)
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      console.error('Failed to open document:', err.message)
    }
  }

  /* ── Style helpers ──────────────────────────────────────────── */
  const sf = field => errors[field] ? 'leadform-field-input field-invalid'  : 'leadform-field-input'
  const ss = field => errors[field] ? 'leadform-field-select field-invalid' : 'leadform-field-select'

  /* ── Derived provider cascade lists ────────────────────────── */
  const provCountries = [...new Map(
    allProviderItems.map(i => [i.country_Cd, { value: i.country_Cd, text: i.country_Nm }])
  ).values()].sort((a, b) => a.text.localeCompare(b.text))

  const provCities = selCountry
    ? [...new Map(
        allProviderItems
          .filter(i => i.country_Cd === selCountry)
          .map(i => [i.city_Cd, { value: i.city_Cd, text: i.city_Nm }])
      ).values()].sort((a, b) => a.text.localeCompare(b.text))
    : []

  const filteredProviders = (selCountry && selCity)
    ? allProviderItems.filter(i => i.country_Cd === selCountry && i.city_Cd === selCity)
    : []

  if (loading) {
    return (
      <div className="leadform-header-section" style={{ textAlign: 'center', padding: '60px 0' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: 32, color: '#72389c' }}></i>
        <p style={{ marginTop: 12, color: '#666' }}>Loading lead details...</p>
      </div>
    )
  }

  return (
    <div>
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />

      {/* ── Search Member / Patient modal ───────────────────────────── */}
      {memberSearch.open && (
        <SearchMemberModal
          onClose={() => setMemberSearch(s => ({ ...s, open: false }))}
          onSelect={member => {
            setSelectedMemberId(member.memberId)
            const parts = (member.fullName || '').trim().split(/\s+/)
            setForm(prev => ({
              ...prev,
              firstName:  parts[0] || '',
              middleName: parts.length === 3 ? parts[1] : '',
              lastName:   parts.length >= 2 ? parts[parts.length - 1] : '',
              email:       member.email       || prev.email,
              mobile:      member.mobileNo    || prev.mobile,
              idNo:        member.nationalId  || prev.idNo,
              dob:         member.dob         || prev.dob,
              gender:      member.gender      || prev.gender,
              nationality: member.nationality || prev.nationality,
              callingCode: member.callingCd   || prev.callingCode,
            }))
          }}
        />
      )}

      {/* ICD / CPT search modal */}
      {codeSearchModal && (
        <CodeSearchModal
          type={codeSearchModal.type}
          defaultSearch={codeSearchModal.defaultSearch}
          onSelect={(cd, nm) => {
            const t = codeSearchModal.type.toLowerCase()
            setForm(f => ({ ...f, [`${t}Code`]: cd, [`${t}Desc`]: nm }))
            setCodeSearchModal(null)
          }}
          onClose={() => setCodeSearchModal(null)}
        />
      )}

      {/* Unsaved-changes confirm dialog */}
      {showLeaveConfirm && (
        <div className="csm-overlay" onClick={() => { setShowLeaveConfirm(false); setPendingPath(null) }}>
          <div className="confirm-modal-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-modal-body">
              <i className="fas fa-question-circle confirm-modal-icon"></i>
              <p>Leaving this page will lose all unsaved data. Are you sure you want to continue?</p>
            </div>
            <div className="confirm-modal-footer">
              <button className="confirm-btn-cancel"
                onClick={() => { setShowLeaveConfirm(false); setPendingPath(null) }}>
                Cancel
              </button>
              <button className="confirm-btn-ok"
                onClick={() => { setIsDirty(false); setShowLeaveConfirm(false); navigate(pendingPath) }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="leadform-header-section">
        <h1 className="leadform-header-title">{isSubsetMode ? `Create Subset Claim — ${sourceClaimNo}` : 'Patient Registration'}</h1>
        <p className="leadform-header-subtitle">
          {isSubsetMode
            ? 'Pre-filled from the root claim — review, adjust, and upload fresh documents for this subset.'
            : 'Complete patient information in 4 easy steps'}
        </p>

        <ul className="leadform-progress-tracker">
          {['Customer Information', 'Medical Information', 'Payee Information', 'Assignment'].map((label, i) => {
            const sn = i + 1
            const cls = sn < step ? 'leadform-step-done' : sn === step ? 'leadform-step-active' : ''
            return <li key={sn} data-step={sn} className={cls}><strong>{label}</strong></li>
          })}
        </ul>

        <div className="leadform-progress-bar-container">
          {(() => {
            const pct = submitted ? '100%' : (isEditMode ? STEP_PROGRESS_EDIT : STEP_PROGRESS_ADD)[step]
            return <div className="leadform-progress-fill" style={{ width: pct }}>{pct}</div>
          })()}
        </div>
      </div>

      <div className="leadform-container">

        {/* ══════════════ STEP 1 — Customer Information ══════════════ */}
        <div className={`leadform-section ${step === 1 && !submitted ? 'leadform-section-active' : ''}`}>
          <div className="leadform-section-header">
            <h2 className="leadform-section-title"><i className="fas fa-info-circle"></i> Customer Information</h2>
            <span className="leadform-step-indicator">Step 1 of 4</span>
          </div>

          <h3 className="leadform-subsection-title">Customer Information</h3>
          <div className="leadform-grid">

            {/* Lead Source */}
            <div className="leadform-field">
              <label className="leadform-field-label">Lead Source <span className="leadform-required-star">*</span></label>
              <select className={ss('source')} value={form.source} onChange={e => onSourceChange(e.target.value)}>
                {ddlSource.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
            </div>

            {/* Insurer — cascades from Source */}
            <div className="leadform-field">
              <label className="leadform-field-label">
                {ddlSource.find(o => o.value === form.source)?.text || 'Insurer / Entity'}
              </label>
              <select className="leadform-field-select" value={form.insurer} onChange={e => handleChange('insurer', e.target.value)}
                disabled={!form.source || ddlInsurer[0]?.text === 'Loading...'}>
                {ddlInsurer.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
              {!form.source && <span className="leadform-helper-text">Select Lead Source first</span>}
            </div>

            {/* Communication Channel — reuses the same Lead Source master list */}
            <div className="leadform-field">
              <label className="leadform-field-label">Communication Channel</label>
              <select className="leadform-field-select" value={form.commChannel} onChange={e => handleChange('commChannel', e.target.value)}>
                {ddlCommChannel.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
            </div>
          </div>

          <div className="leadform-subsection-title-row">
            <h3 className="leadform-subsection-title">Personal Information</h3>
          </div>
          <div className="leadform-grid">

            <div className="leadform-field">
              <label className="leadform-field-label">First Name <span className="leadform-required-star">*</span></label>
              <input className={sf('firstName')} placeholder="First Name" maxLength={30} value={form.firstName}
                onKeyDown={e => { if (e.key.length === 1 && !/^[a-zA-Z ]$/.test(e.key)) e.preventDefault() }}
                onChange={e => handleChange('firstName', e.target.value.replace(/[^a-zA-Z ]/g, '').slice(0, 30))} />
            </div>

            <div className="leadform-field">
              <label className="leadform-field-label">Middle Name</label>
              <input className="leadform-field-input" placeholder="Middle Name" maxLength={30} value={form.middleName}
                onKeyDown={e => { if (e.key.length === 1 && !/^[a-zA-Z ]$/.test(e.key)) e.preventDefault() }}
                onChange={e => handleChange('middleName', e.target.value.replace(/[^a-zA-Z ]/g, '').slice(0, 30))} />
            </div>

            <div className="leadform-field">
              <label className="leadform-field-label">Last Name</label>
              <input className="leadform-field-input" placeholder="Last Name" maxLength={30} value={form.lastName}
                onKeyDown={e => { if (e.key.length === 1 && !/^[a-zA-Z ]$/.test(e.key)) e.preventDefault() }}
                onChange={e => handleChange('lastName', e.target.value.replace(/[^a-zA-Z ]/g, '').slice(0, 30))} />
            </div>

            <div className="leadform-field">
              <label className="leadform-field-label">Email Address</label>
              <input className={sf('email')} placeholder="name@example.com" type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} />
            </div>

            <div className="leadform-field">
              <label className="leadform-field-label">Date of Birth</label>
              <input className={sf('dob')} type="date" max={new Date().toISOString().split('T')[0]} value={form.dob} onChange={e => handleChange('dob', e.target.value)} />
            </div>

            <div className="leadform-field">
              <label className="leadform-field-label">Gender <span className="leadform-required-star">*</span></label>
              <select className={ss('gender')} value={form.gender} onChange={e => handleChange('gender', e.target.value)}>
                {ddlGender.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
            </div>

            <div className="leadform-field">
              <label className="leadform-field-label">Nationality</label>
              <select className={ss('nationality')} value={form.nationality} onChange={e => onNationalityChange(e.target.value)}>
                {ddlNationality.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
            </div>

            <div className="leadform-field">
              <label className="leadform-field-label">Contact Number</label>
              <div className="leadform-phone-input-wrapper">
                <CallingCodeSelect
                  codes={ddlCallingCodes}
                  value={form.callingCode}
                  onChange={val => handleChange('callingCode', val)}
                  hasError={!!errors.callingCode}
                />
                <input type="tel" placeholder="Phone number" maxLength={10} value={form.mobile} onChange={e => handleChange('mobile', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} />
              </div>
            </div>

            <div className="leadform-field">
              <label className="leadform-field-label">Alternate Mobile No(Comma Separated)</label>
              <input type="text" className="leadform-field-input" placeholder="e.g. 9876543210, 9123456780" value={form.mobileOther}
                onChange={e => handleChange('mobileOther', e.target.value.replace(/[^0-9,\s]/g, ''))} />
            </div>

            <div className="leadform-field">
              <label className="leadform-field-label">Select Category</label>
              <div className="lead-type-options">
                {['Priority', 'Emergency', 'Normal'].map(cat => (
                  <label key={cat} className={`lead-type-option ${cat.toLowerCase()} ${form.category === cat ? 'selected' : ''}`}
                    onClick={() => handleChange('category', cat)}>
                    <input type="radio" name="category" value={cat} checked={form.category === cat} readOnly />
                    <span>{cat}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="leadform-field">
              <label className="leadform-field-label">Patient Location <span className="leadform-required-star">*</span></label>
              <select className={ss('patientLocation')} value={form.patientLocation} onChange={e => handleChange('patientLocation', e.target.value)}>
                {ddlPatientLoc.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
            </div>

            <div className="leadform-field">
              <label className="leadform-field-label">Identification Document <span className="leadform-required-star">*</span></label>
              <div className="leadform-id-input-wrapper">
                <select className={ss('documentType')} value={form.documentType} onChange={e => handleChange('documentType', e.target.value)}>
                  {ddlDocType.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
                </select>
                <input className={sf('idNo')} placeholder="ID No." value={form.idNo} onChange={e => handleChange('idNo', e.target.value)} />
              </div>
            </div>

            <div className="leadform-field">
              <label className="leadform-field-label">
                Upload Identification Document
                <span className="leadform-helper-text" style={{ marginLeft: 8, fontWeight: 400 }}>
                  (Accepted: {ALLOWED_DOC_LABEL})
                </span>
              </label>
              <input type="file" className="leadform-field-input" accept=".jpg,.jpeg,.png,.pdf"
                ref={idFileRef} onChange={e => {
                  const file = e.target.files[0]
                  if (!file) { handleChange('idFile', null); setIdFileError(''); return }
                  const ext = '.' + file.name.split('.').pop().toLowerCase()
                  if (!ALLOWED_DOC_EXTS.includes(ext)) {
                    e.target.value = ''
                    setIdFileError(`Only ${ALLOWED_DOC_LABEL} files are allowed.`)
                    handleChange('idFile', null)
                    return
                  }
                  setIdFileError('')
                  handleChange('idFile', file)
                }} />
              {idFileError && <span className="leadform-helper-text" style={{ color: '#e53e3e' }}>{idFileError}</span>}
              {isEditMode && existingIdDoc && (
                <div className="leadform-file-info" style={{ marginTop: 6 }}>
                  <div className="leadform-file-item">
                    <span className="leadform-file-name">
                      <i className="fas fa-file-alt" style={{ marginRight: 4, color: '#667eea' }}></i>
                      {existingIdDoc.originalFileName || existingIdDoc.fileName}
                    </span>
                    <span className="leadform-doc-view-btn" onClick={() => openDocument(existingIdDoc.id)}>
                      <i className="fas fa-eye"></i> View
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="leadform-button-group">
            <button className="leadform-btn leadform-btn-next" onClick={goNext}>
              Next <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>

        {/* ══════════════ STEP 2 — Medical Information ══════════════ */}
        <div className={`leadform-section ${step === 2 && !submitted ? 'leadform-section-active' : ''}`}>
          <div className="leadform-section-header">
            <h2 className="leadform-section-title"><i className="fas fa-heartbeat"></i> Medical Information</h2>
            <span className="leadform-step-indicator">Step 2 of 4</span>
          </div>

          <div className="leadform-grid">

            {/* Treatment Type */}
            <div className="leadform-field">
              <label className="leadform-field-label">Treatment Type <span className="leadform-required-star">*</span></label>
              <select className={ss('treatmentType')} value={form.treatmentType} onChange={e => onTreatmentTypeChange(e.target.value)}>
                {ddlTreatmentType.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
            </div>

            {/* Department — cascades from TreatmentType */}
            <div className="leadform-field">
              <label className="leadform-field-label">Department</label>
              <select className={ss('department')} value={form.department} onChange={e => handleChange('department', e.target.value)}
                disabled={!form.treatmentType || ddlDepartment[0]?.text === 'Loading...'}>
                {ddlDepartment.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
              {!form.treatmentType && <span className="leadform-helper-text">Select Treatment Type first</span>}
            </div>

            {/* Country — cascades to City → Hospital */}
            <div className="leadform-field">
              <label className="leadform-field-label">Country</label>
              <select className="leadform-field-select" value={selCountry}
                onChange={e => onCountryChange(e.target.value)}
                disabled={providerLocked || !allProviderItems.length}>
                {providerLocked
                  ? <option value={lockedLocation.countryCd}>{lockedLocation.countryNm}</option>
                  : <>
                      <option value="">--Select--</option>
                      {provCountries.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
                    </>}
              </select>
            </div>

            {/* City — cascades from Country */}
            <div className="leadform-field">
              <label className="leadform-field-label">City</label>
              <select className="leadform-field-select" value={selCity}
                onChange={e => onCityChange(e.target.value)}
                disabled={providerLocked || !selCountry}>
                {providerLocked
                  ? <option value={lockedLocation.cityCd}>{lockedLocation.cityNm}</option>
                  : <>
                      <option value="">--Select--</option>
                      {provCities.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
                    </>}
              </select>
              {!providerLocked && !selCountry && <span className="leadform-helper-text">Select Country first</span>}
            </div>

            {/* Preferred Hospital — cascades from Country + City */}
            <div className="leadform-field">
              <label className="leadform-field-label">Preferred Hospital</label>
              <select className={ss('provider')} value={form.provider}
                onChange={e => onProviderChange(e.target.value)}
                disabled={providerLocked || !selCity}>
                {providerLocked
                  ? <option value={lockedLocation.prvCd}>{lockedLocation.prvNm}</option>
                  : <>
                      <option value="">--Select--</option>
                      {filteredProviders.map(o => <option key={o.prv_Cd} value={o.prv_Cd}>{o.prv_Nm}</option>)}
                    </>}
              </select>
              {!providerLocked && !selCity && <span className="leadform-helper-text">Select Country and City first</span>}
            </div>

            {/* Doctor — cascades from Provider */}
            <div className="leadform-field">
              <label className="leadform-field-label">Preferred Doctor</label>
              <select className="leadform-field-select" value={form.doctor} onChange={e => handleChange('doctor', e.target.value)}
                disabled={!form.provider || ddlDoctor[0]?.text === 'Loading...'}>
                {ddlDoctor.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
              {!form.provider && <span className="leadform-helper-text">Select Hospital first</span>}
            </div>

            {/* ICD Code */}
            <div className="leadform-field">
              <label className="leadform-field-label">ICD Code</label>
              <div className="code-input-wrap">
                <input className="leadform-field-input" value={form.icdCode}
                  onChange={e => handleChange('icdCode', e.target.value)}
                  placeholder="Enter or search ICD code" />
                <button type="button" className="code-search-icon"
                  onClick={() => setCodeSearchModal({ type: 'ICD', defaultSearch: form.icdCode })}
                  title="Search ICD">
                  <i className="fas fa-search"></i>
                </button>
              </div>
            </div>

            {/* ICD Description */}
            <div className="leadform-field">
              <label className="leadform-field-label">ICD Description</label>
              <input className="leadform-field-input" value={form.icdDesc} readOnly
                placeholder="Auto-filled from search" style={{ backgroundColor: '#f0f0f0', cursor: 'default' }} />
            </div>

            {/* CPT Code */}
            <div className="leadform-field">
              <label className="leadform-field-label">CPT Code</label>
              <div className="code-input-wrap">
                <input className="leadform-field-input" value={form.cptCode}
                  onChange={e => handleChange('cptCode', e.target.value)}
                  placeholder="Enter or search CPT code" />
                <button type="button" className="code-search-icon"
                  onClick={() => setCodeSearchModal({ type: 'CPT', defaultSearch: form.cptCode })}
                  title="Search CPT">
                  <i className="fas fa-search"></i>
                </button>
              </div>
            </div>

            {/* CPT Description */}
            <div className="leadform-field">
              <label className="leadform-field-label">CPT Description</label>
              <input className="leadform-field-input" value={form.cptDesc} readOnly
                placeholder="Auto-filled from search" style={{ backgroundColor: '#f0f0f0', cursor: 'default' }} />
            </div>

            {/* Diagnosis */}
            <div className="leadform-field">
              <label className="leadform-field-label">Diagnosis</label>
              <textarea className="leadform-field-textarea" rows={2}
                placeholder="Enter diagnosis details..."
                value={form.diagnosis} onChange={e => handleChange('diagnosis', e.target.value)} />
            </div>

            {/* Treatment */}
            <div className="leadform-field">
              <label className="leadform-field-label">Treatment</label>
              <textarea className="leadform-field-textarea" rows={2}
                placeholder="Enter treatment details..."
                value={form.treatment} onChange={e => handleChange('treatment', e.target.value)} />
            </div>
          </div>

          <div className="leadform-grid">
            <div className="leadform-field leadform-full-width">
              <label className="leadform-field-label">Medical Reports</label>
              <div className="leadform-file-upload-zone" onClick={() => medicalFileRef.current?.click()}>
                <input type="file" multiple accept=".jpg,.jpeg,.png,.pdf"
                  style={{ display: 'none' }} ref={medicalFileRef} onChange={handleMedicalFiles} />
                <div className="leadform-file-icon"><i className="fas fa-file-medical"></i></div>
                <div className="leadform-upload-text">Upload medical reports</div>
                <div className="leadform-upload-subtext">Accepted: {ALLOWED_DOC_LABEL}</div>
                {form.medicalFiles.length > 0 && (
                  <div className="leadform-file-info" onClick={e => e.stopPropagation()}>
                    {form.medicalFiles.map((file, idx) => (
                      <div className="leadform-file-item" key={idx}>
                        <span className="leadform-file-name">{file.name}</span>
                        <span className="leadform-file-remove" onClick={() => removeMedicalFile(idx)}>Remove</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {medFileError && <span className="leadform-helper-text" style={{ color: '#e53e3e' }}>{medFileError}</span>}
              {isEditMode && existingMedicalDocs.length > 0 && (
                <div className="leadform-existing-docs-panel">
                  <div className="leadform-existing-docs-header" onClick={() => setMedicalDocsExpanded(x => !x)}>
                    <span>
                      <i className="fas fa-folder-open" style={{ marginRight: 5, color: '#667eea' }}></i>
                      Previously uploaded ({existingMedicalDocs.length} file{existingMedicalDocs.length > 1 ? 's' : ''})
                    </span>
                    <i className={`fas fa-chevron-${medicalDocsExpanded ? 'up' : 'down'}`}></i>
                  </div>
                  {medicalDocsExpanded && (
                    <div className="leadform-existing-docs-body">
                      {existingMedicalDocs.map((doc, idx) => (
                        <div className="leadform-file-item" key={idx}>
                          <span className="leadform-file-name">
                            <i className="fas fa-file-alt" style={{ marginRight: 4, color: '#667eea' }}></i>
                            {doc.originalFileName || doc.fileName}
                          </span>
                          <span className="leadform-doc-view-btn" onClick={() => openDocument(doc.id)}>
                            <i className="fas fa-eye"></i> View
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="leadform-field leadform-full-width">
              <label className="leadform-field-label">Case Notes & Remarks <span className="leadform-required-star">*</span></label>
              <textarea className={`leadform-field-textarea ${errors.remarks ? 'field-invalid' : ''}`}
                rows={3} placeholder="Enter any special requirements, notes, or additional information..."
                value={form.remarks} onChange={e => handleChange('remarks', e.target.value)} />
            </div>
          </div>

          <div className="leadform-button-group">
            <button className="leadform-btn leadform-btn-prev" onClick={goPrev}>
              <i className="fas fa-arrow-left"></i> Previous
            </button>
            <button className="leadform-btn leadform-btn-next" onClick={goNext}>
              Next <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>

        {/* ══════════════ STEP 3 — Mode of Payment ══════════════ */}
        <div className={`leadform-section ${step === 3 && !submitted ? 'leadform-section-active' : ''}`}>
          <div className="leadform-section-header">
            <h2 className="leadform-section-title"><i className="fas fa-credit-card"></i> Mode of Payment</h2>
            <span className="leadform-step-indicator">Step 3 of 4</span>
          </div>

          <div className="leadform-grid">

            {/* Payment Mode */}
            <div className="leadform-field">
              <label className="leadform-field-label">Payment Mode <span className="leadform-required-star">*</span></label>
              <select className={ss('paymentMode')} value={form.paymentMode} onChange={e => onPaymentModeChange(e.target.value)}>
                {ddlPaymentMode.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
            </div>

            {/* Guarantor / Payment Type */}
            <div className="leadform-field">
              <label className="leadform-field-label">{form.paymentMode === 'PM0001' ? 'Payment Type' : 'Guarantor'} <span className="leadform-required-star">*</span></label>
              <select className={ss('guarantor')} value={form.guarantor} onChange={e => handleChange('guarantor', e.target.value)}>
                {ddlGuarantor.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
            </div>
          </div>

          <div className="leadform-button-group">
            <button className="leadform-btn leadform-btn-prev" onClick={goPrev}>
              <i className="fas fa-arrow-left"></i> Previous
            </button>
            <button className="leadform-btn leadform-btn-next" onClick={goNext}>
              Next <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>

        {/* ══════════════ STEP 4 — Case Assignment ══════════════ */}
        <div className={`leadform-section ${step === 4 && !submitted ? 'leadform-section-active' : ''}`}>
          <div className="leadform-section-header">
            <h2 className="leadform-section-title"><i className="fas fa-user-check"></i> Case Assignment</h2>
            <span className="leadform-step-indicator">Step 4 of 4</span>
          </div>

          <div className="leadform-grid">

            <div className="leadform-field">
              <label className="leadform-field-label">Assigned To (Case Manager) <span className="leadform-required-star">*</span></label>
              <select className={ss('assignedTo')} value={form.assignedTo} onChange={e => handleChange('assignedTo', e.target.value)}>
                {ddlCrm.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
            </div>

            <div className="leadform-field">
              <label className="leadform-field-label">Team Member</label>
              <select className="leadform-field-select" value={form.referringAgent} onChange={e => handleChange('referringAgent', e.target.value)}>
                {ddlAgent.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
            </div>
          </div>

          {saveError && (
            <div className="leadform-error-banner">
              <i className="fas fa-exclamation-circle"></i> {saveError}
            </div>
          )}
          <div className="leadform-button-group">
            <button className="leadform-btn leadform-btn-prev" onClick={goPrev} disabled={saving}>
              <i className="fas fa-arrow-left"></i> Previous
            </button>
            <button className="leadform-btn leadform-btn-submit" onClick={handleSubmit} disabled={saving}>
              {saving
                ? <><i className="fas fa-spinner fa-spin"></i> Saving...</>
                : <><i className="fas fa-check"></i> Submit Lead</>}
            </button>
          </div>
        </div>

        {/* ══════════════ SUCCESS ══════════════ */}
        <div className={`leadform-section ${submitted ? 'leadform-section-active' : ''}`}>
          <div className="leadform-success-screen">
            <div className="leadform-success-icon"><i className="fas fa-check-circle"></i></div>
            <h2 className="leadform-success-title">SUCCESS!</h2>
            <p className="leadform-success-message">Patient lead has been successfully submitted.</p>
            {savedIds.memberId && (
              <div className="leadform-success-ids">
                <span><strong>Member ID:</strong> {savedIds.memberId}</span>
                <span><strong>Treatment ID:</strong> {savedIds.claimNo}</span>
              </div>
            )}
            <button className="leadform-btn leadform-btn-next" style={{ marginTop: 25 }} onClick={handleReset}>
              <i className="fas fa-plus"></i> Add New Lead
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
