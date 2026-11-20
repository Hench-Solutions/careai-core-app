import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getLeadByClaimNo, fetchMasterItems, fetchClaimSubmissionBind, fetchExchangeRate, fetchServiceCharge, fetchDischarge, fetchDocumentBlob, fetchDocumentPreviewHtml, saveCaseInfo, saveTreatmentInfo, saveInvoice, saveClaimSubmissionDraft, submitClaim } from '../../utils/api'
import PatientInfoCard from '../../components/PatientInfoCard'
import CodeSearchModal from '../../components/CodeSearchModal'
import ValidationModal from '../../components/ValidationModal'

/**
 * ClaimSubmission — new page opened from the Lead Action page (Patient Discharge
 * Approval div) once a case reaches status 327. UI-only scaffold for now: a
 * 4-step wizard (one section expanded at a time), matching the approved mockup.
 * Save as Draft / Submit Claim are not wired to an endpoint yet.
 */

const TOTAL_STEPS = 4
const STEP_LABELS = ['Treatment Information', 'Invoice', 'Case Information', 'Document Checklist']

function toDateInputValue(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

// Highlighted amber/yellow — these 6 fields have no existing data source in the
// system (confirmed during the binding analysis); flagged for client sign-off
// on whether they're first captured here or sourced from elsewhere.
const PENDING_FIELD_STYLE = { background: '#fffbe0', borderColor: '#f0d84a' }

// Generated documents are produced by this page itself — always shown first.
// Approved documents (MT_LeadDischargeDoc where Actv_Ind=1 AND Is_Approved=1) are
// fetched live and appended below, per-claim — see fetchDischarge() in the load effect.
const GENERATED_CHECKLIST_ITEMS = [
  { code: 'INVOICE',     label: 'Invoice' },
  { code: 'CASE_REPORT', label: 'Case Report' }
]

function StepTracker({ currentStep, maxReached, onJump }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', margin: '22px 0 26px' }}>
      {STEP_LABELS.map((label, i) => {
        const step = i + 1
        const isCurrent = step === currentStep
        const isDone = step < maxReached
        const clickable = step <= maxReached
        return (
          <div
            key={step}
            onClick={() => clickable && onJump(step)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', cursor: clickable ? 'pointer' : 'default' }}
          >
            {i > 0 && (
              <div style={{
                position: 'absolute', top: 15, left: 'calc(-50% + 15px)', right: 'calc(50% + 15px)', height: 2,
                background: (isDone || isCurrent) ? 'linear-gradient(90deg, #632da7, #d1626a)' : '#e5e7eb', zIndex: 0
              }} />
            )}
            <div style={{
              width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12.5, fontWeight: 700, zIndex: 1,
              background: isDone ? 'var(--gradient-primary, linear-gradient(135deg, #632da7 0%, #5c31aa 20%, #d1626a 50%, #dd6c69 75%, #f28b57 100%))' : '#fff',
              border: isCurrent ? '2px solid #7c3fc9' : '2px solid #e5e7eb',
              color: isDone ? '#fff' : isCurrent ? '#7c3fc9' : '#999'
            }}>
              {isDone ? <i className="fas fa-check"></i> : step}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: isCurrent ? '#232323' : '#888', marginTop: 7, padding: '0 4px', lineHeight: 1.3 }}>
              {label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatusPill({ step, currentStep, maxReached }) {
  const isCurrent = step === currentStep
  const isDone = step < maxReached
  const style = isCurrent
    ? { background: '#f1e9fb', color: '#632da7', border: '1px solid #d8c3f0' }
    : isDone
    ? { background: '#e6f9f0', color: '#0d7a4e', border: '1px solid #b2dfce' }
    : { background: '#f5f5f5', color: '#888', border: '1px solid #e5e7eb' }
  return (
    <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '.02em', ...style }}>
      {isCurrent ? 'Editing' : isDone ? 'Confirmed ✓' : 'Not started'}
    </span>
  )
}

function WizardSection({ step, currentStep, maxReached, title, hint, onJump, children }) {
  const isCurrent = step === currentStep
  return (
    <div className="section-box">
      <div className={`section-header${isCurrent ? '' : ' collapsed'}`} onClick={() => onJump(step)}>
        <h4>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%',
            background: 'var(--gradient-primary, linear-gradient(135deg, #632da7 0%, #5c31aa 20%, #d1626a 50%, #dd6c69 75%, #f28b57 100%))',
            color: '#fff', fontSize: 11, fontWeight: 700, marginRight: 10
          }}>{step}</span>
          {title}
          {hint && <span style={{ fontSize: 11.5, color: '#888', fontWeight: 400, marginLeft: 8 }}>{hint}</span>}
        </h4>
        <StatusPill step={step} currentStep={currentStep} maxReached={maxReached} />
        <span className="section-toggle" style={{ marginLeft: 10 }}><i className="fas fa-chevron-down"></i></span>
      </div>
      <div className={`section-body${isCurrent ? '' : ' collapsed'}`}>
        {children}
      </div>
    </div>
  )
}

export default function ClaimSubmission() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const claimNo = searchParams.get('claimNo') || ''

  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [currentStep, setCurrentStep] = useState(1)
  const [maxReached, setMaxReached] = useState(1)
  const [modalMsgs, setModalMsgs] = useState([])
  const [caseInfoSaving, setCaseInfoSaving] = useState(false)
  const [treatmentInfoSaving, setTreatmentInfoSaving] = useState(false)
  const [invoiceSaving, setInvoiceSaving] = useState(false)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [claimSubmitting, setClaimSubmitting] = useState(false)
  const [draftSaving, setDraftSaving] = useState(false)
  const [draftPdfUrl, setDraftPdfUrl] = useState('') // in-memory blob URL — nothing is uploaded/recorded until Submit
  const [submitSuccessMsgs, setSubmitSuccessMsgs] = useState([])
  const [sectionSuccessMsgs, setSectionSuccessMsgs] = useState([]) // full success modal after each section save
  const [pendingAdvanceStep, setPendingAdvanceStep] = useState(null)

  // ── Section 1 — Final Bill Amount ─────────────────────────────────────
  const [currencyOptions, setCurrencyOptions] = useState([])
  const [currencyCd, setCurrencyCd] = useState('')
  const [finalAmt, setFinalAmt] = useState('')
  const [copayAmt, setCopayAmt] = useState('0')
  const [dedAmt,   setDedAmt]   = useState('0')
  const netAmt = ((parseFloat(finalAmt) || 0) - ((parseFloat(copayAmt) || 0) + (parseFloat(dedAmt) || 0))).toFixed(2)

  const [serviceAmt, setServiceAmt] = useState('')
  const totalAmt = ((parseFloat(netAmt) || 0) + (parseFloat(serviceAmt) || 0)).toFixed(2)
  const [serviceFeeLoading, setServiceFeeLoading] = useState(false)
  const [serviceFeeCalcSteps, setServiceFeeCalcSteps] = useState([]) // [{description, value}] — the auto-calc's rough-work breakdown
  const [serviceFeeReason, setServiceFeeReason] = useState('') // set when no slab matched — shown as a hint, not an error
  const [calcStepsOpen, setCalcStepsOpen] = useState(false)

  const [finalCurrencyCd, setFinalCurrencyCd] = useState('')
  const [exchangeRate, setExchangeRate] = useState(null)
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false)
  const [exchangeRateError, setExchangeRateError] = useState('')
  const convertedAmt = exchangeRate != null ? ((parseFloat(totalAmt) || 0) * exchangeRate).toFixed(2) : ''

  // ── Section 2 — Treatment Information ─────────────────────────────────
  const [roomTypeOptions, setRoomTypeOptions] = useState([])
  const [roomType, setRoomType] = useState('')
  const [los,       setLos]       = useState('')
  const [icdCode,   setIcdCode]   = useState('')
  const [icdDesc,   setIcdDesc]   = useState('')
  const [cptCode,   setCptCode]   = useState('')
  const [cptDesc,   setCptDesc]   = useState('')
  const [drgCode,   setDrgCode]   = useState('')
  const [drgDesc,   setDrgDesc]   = useState('')
  const [codeSearchModal, setCodeSearchModal] = useState(null) // { type: 'ICD'|'CPT'|'DRG', defaultSearch }

  // ── Section 3 — Case Information ───────────────────────────────────────
  const [doa, setDoa] = useState('')
  const [dod, setDod] = useState('')
  const [complaint,    setComplaint]    = useState('')
  const [hpi,           setHpi]          = useState('')
  const [pastHistory,   setPastHistory]  = useState('')
  const [diagnosis,     setDiagnosis]    = useState('')
  const [treatment,     setTreatment]    = useState('')
  const [caseSummary,   setCaseSummary]  = useState('')
  const [providerNm,       setProviderNm]       = useState('')
  const [providerLocation, setProviderLocation] = useState('')

  // ── Section 4 — Document Checklist ────────────────────────────────────
  const [checked, setChecked] = useState({})
  const [approvedDocs, setApprovedDocs] = useState([]) // [{docCd, docNm, fileNm}] — Is_Approved=1 discharge docs
  const [approvedChecklistItems, setApprovedChecklistItems] = useState([]) // [{itemCd, itemNm}] — ticked checklist items with no file behind them
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewError, setPreviewError] = useState('')

  const openDocumentPreview = (docCode, label) => {
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewTitle(label)
    setPreviewHtml('')
    setPreviewError('')
    fetchDocumentPreviewHtml(claimNo, docCode)
      .then(html => setPreviewHtml(html))
      .catch(err => setPreviewError(err?.message || 'Failed to load preview.'))
      .finally(() => setPreviewLoading(false))
  }

  useEffect(() => {
    if (!claimNo) { setError('No Treatment ID provided.'); setLoading(false); return }
    Promise.all([
      getLeadByClaimNo(claimNo),
      fetchMasterItems('RoomType').catch(() => []),
      fetchMasterItems('Currency').catch(() => []),
      fetchClaimSubmissionBind(claimNo).catch(() => null),
      fetchDischarge(claimNo).catch(() => null)
    ])
      .then(([data, roomRows, currencyRows, bind, discharge]) => {
        setApprovedDocs((discharge?.approvalDocs || []).filter(d => d.fileNm))
        setApprovedChecklistItems(discharge?.approvalChecklistItems || [])
        if (!data) { setError('Lead not found.'); return }
        setLead(data)
        setRoomTypeOptions(roomRows || [])
        setCurrencyOptions(currencyRows || [])
        setDoa(toDateInputValue(data?.doa))
        setDod(toDateInputValue(data?.dod))
        setProviderNm(data?.acceptedPrvNm || '')

        if (bind) {
          if (bind.providerNm) setProviderNm(bind.providerNm)
          if (bind.doa) setDoa(toDateInputValue(bind.doa))
          if (bind.dod) setDod(toDateInputValue(bind.dod))
          if (bind.providerCurrencyCd) setCurrencyCd(bind.providerCurrencyCd)

          // Invoice — MT_Invoice values (if already saved) take priority; otherwise
          // fall back to the discharge-approved amount, same as before.
          if (bind.treatmentAmt != null)  setFinalAmt(String(bind.treatmentAmt))
          if (bind.copayAmt != null)      setCopayAmt(String(bind.copayAmt))
          if (bind.deductibleAmt != null) setDedAmt(String(bind.deductibleAmt))
          if (bind.serviceFeeAmt != null) setServiceAmt(String(bind.serviceFeeAmt))
          if (bind.insurerCurrencyCd)     setFinalCurrencyCd(bind.insurerCurrencyCd)
          if (bind.invoiceNo)             setInvoiceNo(bind.invoiceNo)

          setRoomType(bind.roomType || '')
          setLos(bind.los != null ? String(bind.los) : '')
          setIcdCode(bind.icdCd || '')
          setIcdDesc(bind.icdDesc || '')
          setCptCode(bind.cptCd || '')
          setCptDesc(bind.cptDesc || '')
          setDrgCode(bind.drgCd || '')
          setDrgDesc(bind.drgDesc || '')

          const locationParts = [bind.providerLocation, bind.providerDistrict, bind.providerState, bind.providerCountry].filter(Boolean)
          setProviderLocation(locationParts.join(', '))

          if (bind.complaint)     setComplaint(bind.complaint)
          if (bind.hpi)           setHpi(bind.hpi)
          if (bind.pastHistory)   setPastHistory(bind.pastHistory)
          if (bind.caseDiagnosis) setDiagnosis(bind.caseDiagnosis)
          if (bind.caseTreatment) setTreatment(bind.caseTreatment)
          if (bind.caseSummary)   setCaseSummary(bind.caseSummary)
        }
      })
      .catch(() => setError('Failed to load claim details.'))
      .finally(() => setLoading(false))
  }, [claimNo])

  // Live conversion via Open Exchange Rates whenever both currencies are chosen.
  // Discharge date is used to look up the rate, unless it's in the future
  // (rates don't exist yet) — then today's date is used instead.
  const todayStr = new Date().toISOString().slice(0, 10)
  const conversionDate = (dod && dod <= todayStr) ? dod : todayStr

  useEffect(() => {
    if (!currencyCd || !finalCurrencyCd) { setExchangeRate(null); setExchangeRateError(''); return }
    if (currencyCd === finalCurrencyCd) { setExchangeRate(1); setExchangeRateError(''); return }

    let cancelled = false
    setExchangeRateLoading(true)
    setExchangeRateError('')
    fetchExchangeRate(currencyCd, finalCurrencyCd, conversionDate)
      .then(rate => {
        if (cancelled) return
        if (rate == null) { setExchangeRate(null); setExchangeRateError('Rate unavailable — check Open Exchange Rates configuration.') }
        else setExchangeRate(rate)
      })
      .finally(() => { if (!cancelled) setExchangeRateLoading(false) })

    return () => { cancelled = true }
  }, [currencyCd, finalCurrencyCd, conversionDate])

  // Service Fee auto-calc — matches MT_ServiceChargeSlab against the Final Net
  // Amount, converting through the slab's own currency when it differs from
  // Provider Currency. Skips the very first run right after the page loads
  // ONLY when there's an actual saved Service Fee to protect (possibly a
  // manual correction) — an empty/zero Service Fee on load has nothing worth
  // protecting, so the calc runs immediately in that case.
  const skipServiceFeeAutoCalcRef = useRef(true)
  useEffect(() => {
    if (loading) return
    if (skipServiceFeeAutoCalcRef.current) {
      skipServiceFeeAutoCalcRef.current = false
      if (parseFloat(serviceAmt) > 0) return
    }

    const netAmtNum = parseFloat(netAmt) || 0
    if (!claimNo || !currencyCd || netAmtNum <= 0) {
      setServiceFeeCalcSteps([])
      setServiceFeeReason('')
      return
    }

    let cancelled = false
    setServiceFeeLoading(true)
    setServiceFeeCalcSteps([])
    setServiceFeeReason('')
    fetchServiceCharge(claimNo, netAmtNum, currencyCd, conversionDate)
      .then(result => {
        if (cancelled || !result) return
        if (result.matched) {
          setServiceAmt(result.fee != null ? String(result.fee) : '')
          setServiceFeeCalcSteps(result.calculationSteps || [])
          setServiceFeeReason('')
          // Default Final Currency to the matched slab's own Master Currency —
          // only when the user hasn't already picked one — so the Currency
          // Conversion section below can immediately apply the exchange rate.
          if (result.masterCurrencyCd) setFinalCurrencyCd(prev => prev || result.masterCurrencyCd)
        } else {
          setServiceFeeCalcSteps([])
          setServiceFeeReason(result.reason || 'No automated Service Fee rule found — enter the Service Fee manually.')
        }
      })
      .finally(() => { if (!cancelled) setServiceFeeLoading(false) })

    return () => { cancelled = true }
  }, [claimNo, netAmt, currencyCd, conversionDate, loading])

  function jumpTo(step) {
    if (step > maxReached) return
    setCurrentStep(step)
  }

  function validateStep1() {
    const errs = []
    if (!roomType)  errs.push('Room Type is required.')
    if (!los)       errs.push('Length of Stay is required.')
    if (!icdCode)   errs.push('ICD Code is required.')
    if (!icdDesc)   errs.push('ICD Description is required.')
    if (!cptCode)   errs.push('CPT Code is required.')
    if (!cptDesc)   errs.push('CPT Description is required.')
    if (!drgCode)   errs.push('DRG Code is required.')
    if (!drgDesc)   errs.push('DRG Description is required.')
    return errs
  }

  function validateStep2() {
    const errs = []
    if (!currencyCd)      errs.push('Provider Currency is required.')
    if (!finalAmt)         errs.push('Insurance Approved Amount is required.')
    if (!(parseFloat(serviceAmt) > 0)) errs.push('Service Fee is required and must be greater than 0.')
    if (!finalCurrencyCd) errs.push('Final Currency is required.')
    return errs
  }

  function validateStep3() {
    const errs = []
    if (!complaint.trim())    errs.push('Chief Complaint is required.')
    if (!hpi.trim())          errs.push('History of Present Illness is required.')
    if (!pastHistory.trim())  errs.push('Past Surgical / Medical History is required.')
    if (!diagnosis.trim())    errs.push('Diagnosis is required.')
    if (!treatment.trim())    errs.push('Treatment is required.')
    if (!caseSummary.trim())  errs.push('Case Summary is required.')
    return errs
  }

  const STEP_VALIDATORS = { 1: validateStep1, 2: validateStep2, 3: validateStep3 }

  async function nextStep(fromStep) {
    if (fromStep >= TOTAL_STEPS) return

    const validator = STEP_VALIDATORS[fromStep]
    if (validator) {
      const errs = validator()
      if (errs.length > 0) { setModalMsgs(errs); return }
    }

    if (fromStep === 1) {
      setTreatmentInfoSaving(true)
      try {
        await saveTreatmentInfo({ claimNo, icdCode, icdDesc, cptCode, cptDesc, drgCode, drgDesc })
      } catch (err) {
        setModalMsgs([err?.message || 'Failed to save treatment information.'])
        setTreatmentInfoSaving(false)
        return
      }
      setTreatmentInfoSaving(false)
      setPendingAdvanceStep(fromStep + 1)
      setSectionSuccessMsgs(['Treatment information saved successfully.'])
      return
    }

    if (fromStep === 2) {
      setInvoiceSaving(true)
      try {
        const savedInvoiceNo = await saveInvoice({
          claimNo,
          treatmentAmt: parseFloat(finalAmt) || 0,
          copayAmt: parseFloat(copayAmt) || 0,
          deductibleAmt: parseFloat(dedAmt) || 0,
          netAmt: parseFloat(netAmt) || 0,
          serviceFeeAmt: parseFloat(serviceAmt) || 0,
          totalAmt: parseFloat(totalAmt) || 0,
          currencyCd,
          insurerCurrencyCd: finalCurrencyCd,
          exchangeRate: exchangeRate
        })
        if (savedInvoiceNo) setInvoiceNo(savedInvoiceNo)
      } catch (err) {
        setModalMsgs([err?.message || 'Failed to save invoice.'])
        setInvoiceSaving(false)
        return
      }
      setInvoiceSaving(false)
      setPendingAdvanceStep(fromStep + 1)
      setSectionSuccessMsgs(['Invoice saved successfully.'])
      return
    }

    if (fromStep === 3) {
      setCaseInfoSaving(true)
      try {
        await saveCaseInfo({
          claimNo: claimNo,
          complaint: complaint.trim(),
          hpi: hpi.trim(),
          pastHistory: pastHistory.trim(),
          diagnosis: diagnosis.trim(),
          treatment: treatment.trim(),
          caseSummary: caseSummary.trim(),
          roomType,
          los: los.trim()
        })
      } catch (err) {
        setModalMsgs([err?.message || 'Failed to save case information.'])
        setCaseInfoSaving(false)
        return
      }
      setCaseInfoSaving(false)
      setPendingAdvanceStep(fromStep + 1)
      setSectionSuccessMsgs(['Case information saved successfully.'])
      return
    }

    setMaxReached(m => Math.max(m, fromStep + 1))
    setCurrentStep(fromStep + 1)
  }

  function openCodeModal(type) {
    const defaultSearch = type === 'ICD' ? icdCode : type === 'CPT' ? cptCode : drgCode
    setCodeSearchModal({ type, defaultSearch })
  }
  function handleCodeSelect(type, cd, nm) {
    if (type === 'ICD') { setIcdCode(cd); setIcdDesc(nm) }
    if (type === 'CPT') { setCptCode(cd); setCptDesc(nm) }
    if (type === 'DRG') { setDrgCode(cd); setDrgDesc(nm) }
  }

  const header = (
    <div className="common-header">
      <div className="common-header-content">
        <div className="common-header-title-wrapper">
          <h2 className="common-header-title">Claim Submission</h2>
        </div>
        <button className="lead-action-back" onClick={() => navigate(`/leads/actions?claimNo=${claimNo}`)}>Back</button>
      </div>
    </div>
  )

  if (loading) return (
    <div className="quotation-container">
      {header}
      <div className="lead-action-loading"><i className="fas fa-spinner fa-spin"></i> Loading...</div>
    </div>
  )
  if (error || !lead) return (
    <div className="quotation-container">
      {header}
      <div className="lead-action-error">{error || 'Lead not found.'}</div>
    </div>
  )

  const wizardComplete = maxReached >= TOTAL_STEPS

  // Payment_Mode_Cd 'PM0001' = Self Pay, anything else = GOP (same rule used elsewhere in LeadDAL).
  const isSelfPay = lead.paymentMode === 'PM0001'
  const paymentTypeLabel = isSelfPay ? 'Self' : 'GOP'
  const patientInfoExtraFields = [
    { label: 'Accepted Provider', value: providerNm },
    { label: 'Provider Location', value: providerLocation },
    { label: 'Date of Admission', value: doa },
    { label: 'Date of Discharge', value: dod },
    { label: 'Payment Type', value: paymentTypeLabel },
    ...(!isSelfPay ? [{ label: 'Insurer Name', value: lead.insurerName }] : [])
  ]

  return (
    <div className="quotation-container">
      {header}

      <PatientInfoCard lead={lead} extraFields={patientInfoExtraFields} />

      <StepTracker currentStep={currentStep} maxReached={maxReached} onJump={jumpTo} />

      {/* SECTION 1 — Treatment Information */}
      <WizardSection step={1} currentStep={currentStep} maxReached={maxReached} onJump={jumpTo}
        title="Treatment Information" hint="Prefilled from the accepted estimate — required here">
        <div className="grid-form-two-cols" style={{ marginBottom: 16 }}>
          <div className="group-form-medical">
            <label className="label-form-medical">Room Type <span style={{ color: '#e53e3e' }}>*</span></label>
            <select className="input-form-medical" value={roomType} onChange={e => setRoomType(e.target.value)}>
              {roomTypeOptions.map(r => <option key={r.value} value={r.value}>{r.text}</option>)}
            </select>
          </div>
          <div className="group-form-medical">
            <label className="label-form-medical">Length of Stay <span style={{ color: '#e53e3e' }}>*</span></label>
            <input type="text" className="input-form-medical" placeholder="e.g. 5-7 Days" value={los} onChange={e => setLos(e.target.value)} />
          </div>
        </div>

        <div className="grid-form-two-cols" style={{ marginBottom: 16 }}>
          <div className="group-form-medical">
            <label className="label-form-medical">ICD Code <span style={{ color: '#e53e3e' }}>*</span></label>
            <div className="code-input-wrap">
              <input className="input-form-medical" value={icdCode} onChange={e => setIcdCode(e.target.value)} />
              <button type="button" className="code-search-icon" title="Search ICD" onClick={() => openCodeModal('ICD')}>
                <i className="fas fa-search"></i>
              </button>
            </div>
          </div>
          <div className="group-form-medical">
            <label className="label-form-medical">ICD Description <span style={{ color: '#e53e3e' }}>*</span></label>
            <input className="input-form-medical" placeholder="Auto-filled from search" value={icdDesc} onChange={e => setIcdDesc(e.target.value)} />
          </div>
        </div>

        <div className="grid-form-two-cols" style={{ marginBottom: 16 }}>
          <div className="group-form-medical">
            <label className="label-form-medical">CPT Code <span style={{ color: '#e53e3e' }}>*</span></label>
            <div className="code-input-wrap">
              <input className="input-form-medical" value={cptCode} onChange={e => setCptCode(e.target.value)} />
              <button type="button" className="code-search-icon" title="Search CPT" onClick={() => openCodeModal('CPT')}>
                <i className="fas fa-search"></i>
              </button>
            </div>
          </div>
          <div className="group-form-medical">
            <label className="label-form-medical">CPT Description <span style={{ color: '#e53e3e' }}>*</span></label>
            <input className="input-form-medical" placeholder="Auto-filled from search" value={cptDesc} onChange={e => setCptDesc(e.target.value)} />
          </div>
        </div>

        <div className="grid-form-two-cols">
          <div className="group-form-medical">
            <label className="label-form-medical">DRG Code <span style={{ color: '#e53e3e' }}>*</span></label>
            <div className="code-input-wrap">
              <input className="input-form-medical" value={drgCode} onChange={e => setDrgCode(e.target.value)} />
              <button type="button" className="code-search-icon" title="Search DRG" onClick={() => openCodeModal('DRG')}>
                <i className="fas fa-search"></i>
              </button>
            </div>
          </div>
          <div className="group-form-medical">
            <label className="label-form-medical">DRG Description <span style={{ color: '#e53e3e' }}>*</span></label>
            <input className="input-form-medical" placeholder="Auto-filled from search" value={drgDesc} onChange={e => setDrgDesc(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, marginTop: 16, borderTop: '1px solid #efefef' }}>
          <button className="gradient-btn" disabled={treatmentInfoSaving} onClick={() => nextStep(1)}>
            {treatmentInfoSaving ? <><i className="fas fa-spinner fa-spin"></i> Saving...</> : <>Next: Invoice <i className="fas fa-arrow-right"></i></>}
          </button>
        </div>
      </WizardSection>

      {/* SECTION 2 — Invoice */}
      <WizardSection step={2} currentStep={currentStep} maxReached={maxReached} onJump={jumpTo}
        title="Invoice" hint="Editable — updates the approved amount on record">

        {invoiceNo && (
          <div style={{ fontSize: 12.5, color: '#555', marginBottom: 14 }}>
            <b>Invoice No.</b> {invoiceNo}
          </div>
        )}

        <div className="grid-form-two-cols" style={{ marginBottom: 16 }}>
          <div className="group-form-medical">
            <label className="label-form-medical">Provider Currency <span style={{ color: '#e53e3e' }}>*</span></label>
            <select className="input-form-medical" value={currencyCd} onChange={e => setCurrencyCd(e.target.value)}>
              {currencyOptions.map(c => <option key={c.value} value={c.value}>{c.text}</option>)}
            </select>
          </div>
        </div>

        <div className="grid-form-four-cols">
          <div className="group-form-medical">
            <label className="label-form-medical">Insurance Approved Amount <span style={{ color: '#e53e3e' }}>*</span></label>
            <input className="input-form-medical" value={finalAmt} onChange={e => setFinalAmt(e.target.value)} />
          </div>
          <div className="group-form-medical">
            <label className="label-form-medical">Co-Payment</label>
            <input className="input-form-medical" value={copayAmt} onChange={e => setCopayAmt(e.target.value)} onBlur={() => !copayAmt && setCopayAmt('0')} />
          </div>
          <div className="group-form-medical">
            <label className="label-form-medical">Deductible</label>
            <input className="input-form-medical" value={dedAmt} onChange={e => setDedAmt(e.target.value)} onBlur={() => !dedAmt && setDedAmt('0')} />
          </div>
          <div className="group-form-medical">
            <label className="label-form-medical">Final Net Amount</label>
            <input className="input-form-medical" readOnly value={netAmt} style={{ background: '#f5f5f5', fontWeight: 700 }} />
          </div>
        </div>

        <div className="grid-form-two-cols" style={{ marginTop: 16 }}>
          <div className="group-form-medical">
            <label className="label-form-medical">
              Service Fee <span style={{ color: '#e53e3e' }}>*</span>
              {serviceFeeLoading && <i className="fas fa-spinner fa-spin" style={{ marginLeft: 8, color: '#888', fontSize: 11.5 }}></i>}
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {currencyCd && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#632da7', background: '#f1e9fb', border: '1px solid #d8c3f0', borderRadius: 6, padding: '7px 10px', whiteSpace: 'nowrap' }}>
                  {currencyCd}
                </span>
              )}
              <input className="input-form-medical" style={{ maxWidth: 140 }} value={serviceAmt} onChange={e => setServiceAmt(e.target.value)} />
              {serviceFeeCalcSteps.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCalcStepsOpen(true)}
                  title="How this was calculated"
                  style={{ background: '#f1e9fb', border: '1px solid #d8c3f0', color: '#632da7', borderRadius: 6, width: 34, height: 34, flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <i className="fas fa-calculator"></i>
                </button>
              )}
            </div>
            {serviceFeeReason && (
              <div style={{ fontSize: 11.5, color: '#a15c1f', marginTop: 6, lineHeight: 1.5 }}>
                <i className="fas fa-info-circle" style={{ marginRight: 5 }}></i>
                {serviceFeeReason}
              </div>
            )}
          </div>
          <div className="group-form-medical">
            <label className="label-form-medical">Total Amount</label>
            <input className="input-form-medical" readOnly value={totalAmt} style={{ background: '#f5f5f5', fontWeight: 700 }} />
          </div>
        </div>

        <div style={{ height: 1, background: '#efefef', margin: '20px 0' }}></div>

        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#888', margin: '4px 0 12px' }}>
          Currency Conversion <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(Open Exchange Rates)</span>
        </div>
        <div className="grid-form-four-cols">
          <div className="group-form-medical">
            <label className="label-form-medical">Final Currency <span style={{ color: '#e53e3e' }}>*</span></label>
            <select className="input-form-medical" value={finalCurrencyCd} onChange={e => setFinalCurrencyCd(e.target.value)}>
              {currencyOptions.map(c => <option key={c.value} value={c.value}>{c.text}</option>)}
            </select>
          </div>
          <div className="group-form-medical">
            <label className="label-form-medical">Exchange Rate <span style={{ fontWeight: 400, color: '#888' }}>(as on discharge date)</span></label>
            <input
              className="input-form-medical"
              readOnly
              value={exchangeRateLoading ? 'Loading...' : exchangeRate != null ? exchangeRate : ''}
              style={{ background: '#f5f5f5' }}
            />
          </div>
          <div className="group-form-medical" style={{ gridColumn: 'span 2' }}>
            <label className="label-form-medical">
              Converted Amount
              <a
                href="https://www.xe.com/currencytables/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, color: '#0891b2' }}
                title="Verify this rate on xe.com"
              >
                <i className="fas fa-external-link-alt"></i> Verify online
              </a>
            </label>
            <input className="input-form-medical" readOnly value={convertedAmt} style={{ background: '#f5f5f5', fontWeight: 700 }} />
          </div>
        </div>
        {!dod && (
          <div style={{ color: '#b07d00', fontSize: 12.5, marginTop: 8 }}>Discharge date not set yet — using today's date for the exchange rate until it is.</div>
        )}
        {exchangeRateError && (
          <div style={{ color: '#e53e3e', fontSize: 12.5, marginTop: 8 }}>{exchangeRateError}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, marginTop: 16, borderTop: '1px solid #efefef' }}>
          <button className="lead-action-back" style={{ background: '#fff', color: '#632da7', border: '1px solid #d8c3f0' }} onClick={() => jumpTo(1)}><i className="fas fa-arrow-left"></i> Back</button>
          <button className="gradient-btn" disabled={invoiceSaving} onClick={() => nextStep(2)}>
            {invoiceSaving ? <><i className="fas fa-spinner fa-spin"></i> Saving...</> : <>Next: Case Information <i className="fas fa-arrow-right"></i></>}
          </button>
        </div>
      </WizardSection>

      {/* SECTION 3 — Case Information */}
      <WizardSection step={3} currentStep={currentStep} maxReached={maxReached} onJump={jumpTo}
        title="Case Information">
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#888', margin: '4px 0 12px' }}>Case Details</div>
        <div className="grid-form-two-cols" style={{ marginBottom: 16 }}>
          <div className="group-form-medical">
            <label className="label-form-medical">Chief Complaint <span style={{ color: '#e53e3e' }}>*</span></label>
            <textarea className="textarea-form-medical" style={PENDING_FIELD_STYLE} value={complaint} onChange={e => setComplaint(e.target.value)} />
          </div>
          <div className="group-form-medical">
            <label className="label-form-medical">History of Present Illness <span style={{ color: '#e53e3e' }}>*</span></label>
            <textarea className="textarea-form-medical" style={PENDING_FIELD_STYLE} value={hpi} onChange={e => setHpi(e.target.value)} />
          </div>
        </div>
        <div className="grid-form-two-cols" style={{ marginBottom: 16 }}>
          <div className="group-form-medical">
            <label className="label-form-medical">Past Surgical / Medical History <span style={{ color: '#e53e3e' }}>*</span></label>
            <textarea className="textarea-form-medical" style={PENDING_FIELD_STYLE} value={pastHistory} onChange={e => setPastHistory(e.target.value)} />
          </div>
          <div className="group-form-medical">
            <label className="label-form-medical">Diagnosis <span style={{ color: '#e53e3e' }}>*</span></label>
            <textarea className="textarea-form-medical" style={PENDING_FIELD_STYLE} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
          </div>
        </div>
        <div className="group-form-medical" style={{ marginBottom: 16 }}>
          <label className="label-form-medical">Treatment <span style={{ color: '#e53e3e' }}>*</span></label>
          <textarea className="textarea-form-medical" style={PENDING_FIELD_STYLE} value={treatment} onChange={e => setTreatment(e.target.value)} />
        </div>
        <div className="group-form-medical">
          <label className="label-form-medical">Case Summary <span style={{ color: '#e53e3e' }}>*</span></label>
          <textarea className="textarea-form-medical" style={{ ...PENDING_FIELD_STYLE, minHeight: 80 }} value={caseSummary} onChange={e => setCaseSummary(e.target.value)} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, marginTop: 16, borderTop: '1px solid #efefef' }}>
          <button className="lead-action-back" style={{ background: '#fff', color: '#632da7', border: '1px solid #d8c3f0' }} onClick={() => jumpTo(2)}><i className="fas fa-arrow-left"></i> Back</button>
          <button className="gradient-btn" disabled={caseInfoSaving} onClick={() => nextStep(3)}>
            {caseInfoSaving ? <><i className="fas fa-spinner fa-spin"></i> Saving...</> : <>Next: Document Checklist <i className="fas fa-arrow-right"></i></>}
          </button>
        </div>
      </WizardSection>

      {/* SECTION 4 — Document Checklist */}
      <WizardSection step={4} currentStep={currentStep} maxReached={maxReached} onJump={jumpTo}
        title="Document Checklist" hint="Tick what applies — combined into the final Claim Submission PDF">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f0fb' }}>
              <th style={{ padding: '9px 12px', width: 34 }}></th>
              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase', color: '#888' }}>Document</th>
              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase', color: '#888', width: 110 }}>Source</th>
              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase', color: '#888', width: 90 }}>View</th>
            </tr>
          </thead>
          <tbody>
            {GENERATED_CHECKLIST_ITEMS.map(item => (
              <tr key={item.code} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '9px 12px' }}>
                  <input type="checkbox" checked={!!checked[item.code]} onChange={() => setChecked(prev => ({ ...prev, [item.code]: !prev[item.code] }))} />
                </td>
                <td style={{ padding: '9px 12px' }}>{item.label}</td>
                <td style={{ padding: '9px 12px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '.02em', background: '#edf5ff', color: '#2453b0', border: '1px solid #bcd6f7' }}>
                    Generated
                  </span>
                </td>
                <td style={{ padding: '9px 12px' }}>
                  <a
                    href="#"
                    onClick={e => { e.preventDefault(); openDocumentPreview(item.code, item.label) }}
                    style={{ color: '#0891b2' }}
                  >
                    <i className="fas fa-eye"></i>
                  </a>
                </td>
              </tr>
            ))}

            {approvedDocs.map(doc => (
              <tr key={doc.docCd} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '9px 12px' }}>
                  <input type="checkbox" checked readOnly disabled title="Approved document — always included" />
                </td>
                <td style={{ padding: '9px 12px' }}>{doc.docNm}</td>
                <td style={{ padding: '9px 12px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '.02em', background: '#e6f9f0', color: '#0d7a4e', border: '1px solid #b2dfce' }}>
                    Approved
                  </span>
                </td>
                <td style={{ padding: '9px 12px' }}>
                  <a
                    href="#"
                    onClick={e => {
                      e.preventDefault()
                      fetchDocumentBlob(claimNo, doc.fileNm)
                        .then(blob => { const url = URL.createObjectURL(blob); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000) })
                        .catch(() => {})
                    }}
                    style={{ color: '#0891b2' }}
                  >
                    <i className="fas fa-eye"></i>
                  </a>
                </td>
              </tr>
            ))}

            {approvedChecklistItems.map(item => (
              <tr key={item.itemCd} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '9px 12px' }}>
                  <input type="checkbox" checked readOnly disabled title="Approved checklist item — always included" />
                </td>
                <td style={{ padding: '9px 12px' }}>{item.itemNm}</td>
                <td style={{ padding: '9px 12px', color: '#bbb' }}>-</td>
                <td style={{ padding: '9px 12px', color: '#bbb' }}>-</td>
              </tr>
            ))}

            {approvedDocs.length === 0 && approvedChecklistItems.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '14px 12px', color: '#999', textAlign: 'center' }}>No approved discharge documents found for this claim.</td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16, marginTop: 16, borderTop: '1px solid #efefef' }}>
          <button className="lead-action-back" style={{ background: '#fff', color: '#632da7', border: '1px solid #d8c3f0' }} onClick={() => jumpTo(3)}><i className="fas fa-arrow-left"></i> Back</button>
          <span></span>
        </div>
      </WizardSection>

      {previewOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setPreviewOpen(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 10, width: 'min(880px, 100%)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #eee' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#333' }}>{previewTitle} — Preview</span>
              <button
                onClick={() => setPreviewOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888', lineHeight: 1 }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', background: '#f7f7f9' }}>
              {previewLoading && (
                <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
                  <i className="fas fa-spinner fa-spin"></i> Loading preview...
                </div>
              )}
              {!previewLoading && previewError && (
                <div style={{ padding: 40, textAlign: 'center', color: '#c0392b' }}>{previewError}</div>
              )}
              {!previewLoading && !previewError && (
                <iframe
                  title="document-preview"
                  srcDoc={previewHtml}
                  style={{ width: '100%', height: '70vh', border: 'none', background: '#fff' }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {calcStepsOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setCalcStepsOpen(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 10, width: 'min(640px, 100%)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #eee' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#333' }}><i className="fas fa-calculator" style={{ marginRight: 8, color: '#632da7' }}></i>How the Service Fee was calculated</span>
              <button
                onClick={() => setCalcStepsOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888', lineHeight: 1 }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f5f0fb' }}>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase', color: '#888', width: 40 }}>#</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase', color: '#888' }}>Description</th>
                    <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, fontSize: 11.5, textTransform: 'uppercase', color: '#888' }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceFeeCalcSteps.map((step, i) => {
                    const isLast = i === serviceFeeCalcSteps.length - 1
                    return (
                      <tr key={i} style={{ borderBottom: isLast ? 'none' : '1px solid #f0f0f0', background: isLast ? '#f5f0fb' : 'transparent' }}>
                        <td style={{ padding: '9px 12px', color: '#999' }}>{i + 1}</td>
                        <td style={{ padding: '9px 12px', fontWeight: isLast ? 700 : 400 }}>{step.description}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: isLast ? 700 : 400, color: isLast ? '#632da7' : '#232323' }}>{step.value}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Draft action bar — appears once every section has been confirmed */}
      {wizardComplete && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <button
              className="gradient-btn"
              disabled={draftSaving}
              onClick={async () => {
                setDraftSaving(true)
                try {
                  const { pdfBase64, message } = await saveClaimSubmissionDraft({
                    claimNo,
                    memberId: lead.memberId,
                    includeInvoice: !!checked['INVOICE'],
                    includeCaseReport: !!checked['CASE_REPORT']
                  })
                  const byteChars = atob(pdfBase64)
                  const byteNumbers = new Array(byteChars.length)
                  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
                  const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' })
                  if (draftPdfUrl) URL.revokeObjectURL(draftPdfUrl)
                  setDraftPdfUrl(URL.createObjectURL(blob))
                  setSectionSuccessMsgs([message || 'Combined PDF generated successfully.'])
                } catch (err) {
                  setModalMsgs([err?.message || 'Failed to generate the combined PDF.'])
                } finally {
                  setDraftSaving(false)
                }
              }}
            >
              {draftSaving ? <><i className="fas fa-spinner fa-spin"></i> Generating...</> : <><i className="fas fa-save"></i> Save as Draft</>}
            </button>
        </div>
      )}

      {/* Generate & Submit block — only appears once the combined draft PDF has been previewed */}
      {wizardComplete && draftPdfUrl && (
        <div className="section-box">
          <div className="section-header" style={{ cursor: 'default' }}>
            <h4><i className="fas fa-paper-plane" style={{ marginRight: 9, color: '#7c4fc9' }}></i>Generate &amp; Submit</h4>
          </div>
          <div className="section-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <a
                href="#"
                onClick={e => { e.preventDefault(); window.open(draftPdfUrl, '_blank') }}
                style={{ color: '#0891b2', fontSize: 13.5, fontWeight: 600 }}
              >
                <i className="fas fa-file-pdf" style={{ marginRight: 6 }}></i> View Combined Claim File
              </a>
              <button
                className="gradient-btn"
                disabled={claimSubmitting}
                onClick={async () => {
                  setClaimSubmitting(true)
                  try {
                    const result = await submitClaim({
                      claimNo,
                      memberId: lead.memberId,
                      includeInvoice: !!checked['INVOICE'],
                      includeCaseReport: !!checked['CASE_REPORT']
                    })
                    setSubmitSuccessMsgs([result?.errorObj?.[0]?.errorMessage || 'Claim submitted successfully.'])
                  } catch (err) {
                    setModalMsgs([err?.message || 'Failed to submit claim.'])
                  } finally {
                    setClaimSubmitting(false)
                  }
                }}
              >
                {claimSubmitting ? <><i className="fas fa-spinner fa-spin"></i> Submitting...</> : <><i className="fas fa-paper-plane"></i> Submit Claim</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {codeSearchModal && (
        <CodeSearchModal
          type={codeSearchModal.type}
          defaultSearch={codeSearchModal.defaultSearch}
          onSelect={(cd, nm) => handleCodeSelect(codeSearchModal.type, cd, nm)}
          onClose={() => setCodeSearchModal(null)}
        />
      )}

      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />
      <ValidationModal
        messages={sectionSuccessMsgs}
        type="success"
        onClose={() => {
          setSectionSuccessMsgs([])
          if (pendingAdvanceStep != null) {
            setMaxReached(m => Math.max(m, pendingAdvanceStep))
            setCurrentStep(pendingAdvanceStep)
            setPendingAdvanceStep(null)
          }
        }}
      />
      <ValidationModal messages={submitSuccessMsgs} type="success" onClose={() => { setSubmitSuccessMsgs([]); navigate('/leads/search') }} />
    </div>
  )
}
