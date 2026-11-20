import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLeadByClaimNo, fetchDocuments, openDocument, fetchEstimateRequests, fetchEstimateAcceptanceToken, fetchEstimateExpenses, fetchGopData, fetchGopExpenses, fetchGopRecord, saveGop, fetchMasterItems, fetchMedicalBulletins, saveMedicalBulletin, fetchDropdown, fetchDischarge, saveDischarge, saveDischargeApproval, fetchDocumentBlob, fetchSectionRights, uploadDocument, fetchTreatmentPlanPdf } from '../../utils/api'

/* ── Section-wise view permission (Phase 1, view-only) ──────────────────────
   Order matches the sectionVisibility array below. Rights are fetched once
   per mount for the logged-in user's group; missing/undefined entries default
   to visible (fail-open) so the page never breaks while rights are loading
   or for groups that have never been configured.
   Sections are keyed by a fixed Page_Key ('LEAD_ACTION') rather than a
   pages.Id — Lead Action is reached via a button on Lead Search, not the
   menu tree, so it has no row in the `pages` table to resolve an id from. */
const LEAD_ACTION_PAGE_KEY = 'LEAD_ACTION'
const SECTION_CODES = [
  'LEAD_PERSONAL', 'MEDICAL_INFO', 'PAYMENT_INFO', 'ESTIMATE_STATUS',
  'TRAVELLERS_VISA', 'GOP_ISSUE', 'MEDICAL_BULLETIN', 'PATIENT_ADMISSION',
  'PATIENT_DISCHARGE', 'DISCHARGE_APPROVAL', 'CLAIM_SUBMISSION',
]
import { authUtils } from '../../utils/auth'
import GopLetterModal from '../../components/GopLetterModal'
import ValidationModal from '../../components/ValidationModal'
import VisaInviteModal from '../../components/VisaInviteModal'

// "Proceed for Estimate" routes to a different page depending on the logged-in
// user's session type — mirrors the legacy Session["AppType"] branch (MT vs
// Provider), but driven by the actual logged-in user (Location_Code) rather
// than a global deployment setting, since both flows must coexist.
function estimateRequestPath(claimNo, extraParams = '') {
  const isProvider = authUtils.getUser()?.location_Code === 'Provider'
  const base = isProvider ? '/leads/provider-estimate-request' : '/leads/estimate-request'
  return `${base}?claimNo=${claimNo}${extraParams}`
}

/* ── File icon ───────────────────────────────────────────────────────────── */
function fileIcon(fileName) {
  const ext = (fileName ?? '').split('.').pop().toLowerCase()
  if (['jpg','jpeg','png','gif','bmp','webp'].includes(ext)) return 'fas fa-image'
  if (ext === 'pdf')  return 'fas fa-file-pdf'
  if (['doc','docx'].includes(ext)) return 'fas fa-file-word'
  if (['xls','xlsx'].includes(ext)) return 'fas fa-file-excel'
  return 'fas fa-file'
}

/* ── Estimate Status badge ───────────────────────────────────────────────── */
const STATUS_BADGE = {
  'REQUESTED':       'estimate-display-status-requested',
  'ACCEPTED':        'estimate-display-status-additional',
  'ESTIMATE SHARED': 'estimate-display-status-approved',
  'DECLINED':        'estimate-display-status-declined',
}
function badgeCls(nm) {
  return STATUS_BADGE[(nm || '').toUpperCase()] ?? 'estimate-display-status-requested'
}

/* ── Discharge document workflow ────────────────────────────────────────── */
const DISCHARGE_DOC_ACTIONS = [
  { value: 'RECEIVED', icon: 'fas fa-circle-check',    label: 'Discharge – Document Received'         },
  { value: 'PARTIAL',  icon: 'fas fa-adjust',          label: 'Discharge – Partial Document Received' },
  { value: 'PENDING',  icon: 'fas fa-clock',           label: 'Discharge – Document Pending'          },
]

// Full-width segmented option card — active segment highlighted with the
// app's primary purple gradient (matches .gradient-btn / GopLetterModal).
function DischargeActionCard({ icon, label, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '14px 12px',
        cursor: 'pointer',
        borderRadius: 8,
        border: `1.5px solid ${active ? '#72389c' : '#e5e7eb'}`,
        background: active ? 'linear-gradient(135deg,#72389c 0%,#a855f7 100%)' : '#fff',
        color: active ? '#fff' : '#374151',
        transition: 'all 0.15s ease',
        boxShadow: active ? '0 2px 8px rgba(114,56,156,0.25)' : 'none',
      }}
    >
      <i className={icon} style={{ fontSize: 18 }}></i>
      <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{label}</span>
    </div>
  )
}

// Single documents table whose per-row controls change based on the selected
// discharge action:
//   RECEIVED -> Browse (upload) button only
//   PARTIAL  -> Browse button AND checkbox (user chooses per-doc: upload it,
//               or tick it to request from the provider)
//   PENDING  -> checkbox only, plus a "Select All" toggle in the header
function DischargeDocTable({ mode, items, files, onBrowse, onView, checked, onToggle, onToggleAll }) {
  const allChecked = mode === 'PENDING' && items.length > 0 && items.every(d => checked[d.value])
  const showBrowse   = mode === 'RECEIVED' || mode === 'PARTIAL'
  const showCheckbox = mode === 'PARTIAL'  || mode === 'PENDING'

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f5f0fb' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #e5e7eb' }}>
              Document Name
            </th>
            {showBrowse && (
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #e5e7eb' }}>
                Upload
              </th>
            )}
            {showCheckbox && (
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #e5e7eb' }}>
                {mode === 'PENDING' ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, cursor: 'pointer' }}>
                    <input type="checkbox" checked={allChecked} onChange={() => onToggleAll(!allChecked)} />
                    Select All
                  </label>
                ) : (
                  'Ask from Provider'
                )}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={3} style={{ padding: '14px', textAlign: 'center', color: '#999' }}>No discharge documents configured.</td></tr>
          ) : items.map(doc => {
            const fileVal = files[doc.value]
            const isExistingFile = typeof fileVal === 'string' && fileVal
            const fileLabel = fileVal ? (isExistingFile ? fileVal : fileVal.name) : 'Browse'
            return (
              <tr key={doc.value} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 14px', color: '#333' }}>{doc.text}{doc.isRequired && <span style={{ color: '#dc2626' }}> *</span>}</td>
                {showBrowse && (
                  <td style={{ padding: '8px 14px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <label className="gradient-btn" style={{ fontSize: 12, padding: '5px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <i className="fas fa-upload"></i>{fileLabel}
                        <input
                          type="file"
                          style={{ display: 'none' }}
                          onChange={e => onBrowse(doc.value, e.target.files?.[0] || null)}
                        />
                      </label>
                      {isExistingFile && (
                        <a
                          href="#"
                          onClick={e => { e.preventDefault(); onView(fileVal) }}
                          style={{ color: '#0891b2', fontSize: 12, textDecoration: 'underline', whiteSpace: 'nowrap' }}
                          title="View the currently uploaded file"
                        >
                          <i className="fas fa-eye"></i> View
                        </a>
                      )}
                    </div>
                  </td>
                )}
                {showCheckbox && (
                  <td style={{ padding: '8px 14px' }}>
                    <input
                      type="checkbox"
                      checked={!!checked[doc.value]}
                      onChange={() => onToggle(doc.value)}
                    />
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Patient Discharge Approval document table — View existing / Browse replacement /
// View newly-picked local file / Approve checkbox, per the approved screenshot.
function DischargeApprovalDocTable({ items, draftFiles, approvalFiles, onBrowse, onViewExisting, checked, onToggle, locked }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f5f0fb' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #e5e7eb' }}>Document Name</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #e5e7eb' }}>View</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #e5e7eb' }}>Upload</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #e5e7eb' }}>View</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #e5e7eb' }}>Approve</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={5} style={{ padding: '14px', textAlign: 'center', color: '#999' }}>No discharge documents configured.</td></tr>
          ) : items.map(doc => {
            const existingFileNm = draftFiles[doc.value]
            const newFile = approvalFiles[doc.value]
            return (
              <tr key={doc.value} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 14px', color: '#333' }}>{doc.text}{doc.isRequired && <span style={{ color: '#dc2626' }}> *</span>}</td>
                <td style={{ padding: '8px 14px' }}>
                  {existingFileNm ? (
                    <a href="#" onClick={e => { e.preventDefault(); onViewExisting(existingFileNm) }} style={{ color: '#0891b2' }} title="View and download the file">
                      <i className="fas fa-eye"></i>
                    </a>
                  ) : '—'}
                </td>
                <td style={{ padding: '8px 14px' }}>
                  {!locked && (
                    <label className="gradient-btn" style={{ fontSize: 12, padding: '5px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <i className="fas fa-upload"></i>Browse
                      <input type="file" style={{ display: 'none' }} onChange={e => onBrowse(doc.value, e.target.files?.[0] || null)} />
                    </label>
                  )}
                </td>
                <td style={{ padding: '8px 14px' }}>
                  {newFile ? (
                    <a
                      href="#"
                      onClick={e => { e.preventDefault(); const url = URL.createObjectURL(newFile); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000) }}
                      style={{ color: '#0891b2' }}
                      title={`View newly uploaded: ${newFile.name}`}
                    >
                      <i className="fas fa-eye"></i>
                    </a>
                  ) : '—'}
                </td>
                <td style={{ padding: '8px 14px' }}>
                  {existingFileNm ? (
                    <input type="checkbox" checked={!!checked[doc.value]} disabled={locked} onChange={() => onToggle(doc.value)} title="Tick to replace the existing file with the newly uploaded one" />
                  ) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── Collapsible Section ─────────────────────────────────────────────────── */
function Section({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="section-box">
      <div
        className={`section-header${open ? '' : ' collapsed'}`}
        onClick={() => setOpen(o => !o)}
      >
        <h4>{title}</h4>
        <span className="section-toggle"><i className="fas fa-chevron-down"></i></span>
      </div>
      <div className={`section-body${open ? '' : ' collapsed'}`}>
        {children}
      </div>
    </div>
  )
}

/* ── Detail item ─────────────────────────────────────────────────────────── */
function Item({ label, value, full }) {
  const display = value && value.trim() !== '' ? value : null
  return (
    <div className={`detail-item${full ? ' detail-item-full' : ''}`}>
      <label>{label}</label>
      <span className={display ? '' : 'empty-val'}>{display ?? '—'}</span>
    </div>
  )
}

/* ── Button visibility — exact MedTour SetButtonVisibility() logic ───────── *
 *                                                                            *
 *  btnAddInfo          → always visible except else branch                  *
 *  btnRequestEstimateMt → 301 only                                          *
 *  btnRequestInfo       → 301 only                                          *
 *  btnEstimateStatus    → 304 only                                          *
 *  btnAppointment       → 318 & cd=318                                      *
 *  btnAppointmentConfirm→ 318 & cd=319/320 (cd=320 = Re-Schedule)          *
 * ─────────────────────────────────────────────────────────────────────────*/
function buildButtons(statusGrp, statusCd, claimNo, navigate, hasApproved, prvCd, onAcceptEstimate) {
  const grp = String(statusGrp ?? '')
  const cd  = Number(statusCd ?? 0)
  const btn = (label, icon, onClick) => ({ label, icon, onClick })

  const addInfo = btn('Add Info', 'fas fa-info-circle',
    () => navigate(`/lead/edit/${claimNo}`))

  if (grp === '301') return [
    addInfo,
    btn('Proceed for Estimate',        'fas fa-calculator',       () => navigate(estimateRequestPath(claimNo))),
    btn('Request for Additional Info', 'fas fa-file-circle-plus', () => navigate(`/leads/query?claimNo=${claimNo}`)),
  ]

  if (grp === '304') return [
    addInfo,
    btn('Estimate Status',  'fas fa-file-circle-plus', () => navigate(`/leads/estimate-status?claimNo=${claimNo}`)),
    ...(hasApproved                    ? [btn('Compare Estimates', 'fas fa-columns',      () => navigate(`/leads/estimate-compare?claimNo=${claimNo}`))] : []),
    ...(cd === 311 || cd === 316       ? [btn('Accept Estimate',   'fas fa-check-circle', onAcceptEstimate)]                                            : []),
  ]

  // Estimate Accepted (statusCd 316) may carry its own statusGrp — keep showing action buttons
  if (cd === 316) return [
    addInfo,
    btn('Accept Estimate', 'fas fa-check-circle', onAcceptEstimate),
  ]

  if (grp === '318' || grp === '322') {
    if (cd === 318 || cd === 322) return [
      addInfo,
      btn('Book Appointment', 'fas fa-file-circle-plus', () => navigate(`/appointments?claimNo=${claimNo}`)),
    ]
    if (cd === 319 || cd === 320) return [
      addInfo,
      btn(
        cd === 320 ? 'Re-Schedule Appointment' : 'Confirm Appointment',
        'fas fa-file-circle-plus',
        () => navigate(`/appointments/confirm?claimNo=${claimNo}&prvCd=${prvCd ?? ''}`)
      ),
    ]
    return [addInfo]
  }

  // else — hide all buttons
  return []
}

/* ═══════════════════════════════════════════════════════════════════════════
   LeadAction
═══════════════════════════════════════════════════════════════════════════ */
export default function LeadAction() {
  const navigate  = useNavigate()
  const [params]  = useSearchParams()
  const claimNo   = params.get('claimNo') ?? ''

  const [lead,          setLead]          = useState(null)
  const [documents,     setDocuments]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [modalMsgs,     setModalMsgs]     = useState([])
  const [hasApproved,   setHasApproved]   = useState(false)
  const [estimateRows,  setEstimateRows]  = useState([])
  const [treatmentPdfDownloading, setTreatmentPdfDownloading] = useState(false)
  const [viewRow,       setViewRow]       = useState(null)
  const [expenses,      setExpenses]      = useState([])
  const [expLoading,    setExpLoading]    = useState(false)
  const [gopData,       setGopData]       = useState(null)
  const [gopExpenses,   setGopExpenses]   = useState([])
  const [currencyOptions, setCurrencyOptions] = useState([])
  const [stepperOptions, setStepperOptions] = useState([])
  const [gopRecord,     setGopRecord]     = useState(null)
  const [gopSaving,      setGopSaving]      = useState(false)
  const [gopPreviewing,  setGopPreviewing]  = useState(false)
  const [showVisaInvite, setShowVisaInvite] = useState(false)

  const [showGopModal,   setShowGopModal]   = useState(false)
  const [gopDoa,         setGopDoa]         = useState('')
  const [gopDod,         setGopDod]         = useState('')
  const [prvCurrencyCd,  setPrvCurrencyCd]  = useState('')
  const [prvTreatmentCost, setPrvTreatmentCost] = useState('')

  const [admitDoa,        setAdmitDoa]        = useState('')
  const [admitDod,        setAdmitDod]        = useState('')
  const [admitSaving,     setAdmitSaving]     = useState(false)
  const [admitSuccessMsgs, setAdmitSuccessMsgs] = useState([])

  const [dischargeDod,      setDischargeDod]      = useState('')
  const [dischargeRemarks,  setDischargeRemarks]  = useState('')
  const [dischargeSaving,   setDischargeSaving]   = useState(false)
  const [dischargeSuccessMsgs, setDischargeSuccessMsgs] = useState([])

  const [dischargeCurrencyCd,   setDischargeCurrencyCd]   = useState('')
  const [dischargeHospitalAmt,  setDischargeHospitalAmt]  = useState('')
  const [dischargeCopayment,    setDischargeCopayment]    = useState('')
  const [dischargeDeductible,   setDischargeDeductible]   = useState('')
  const dischargeFinalAmt = (
    (parseFloat(dischargeHospitalAmt) || 0)
    - ((parseFloat(dischargeCopayment) || 0) + (parseFloat(dischargeDeductible) || 0))
  ).toFixed(2)

  const [dischargeChecklist,    setDischargeChecklist]      = useState({}) // { [docCd]: bool } — same list as the document table

  // ── Discharge document workflow ───────────────────────────────────────────
  const [dischargeDocDefs,   setDischargeDocDefs]   = useState([])  // [{value: docCd, text: docNm}]
  const [dischargeDocAction, setDischargeDocAction] = useState('RECEIVED')  // 'RECEIVED' | 'PARTIAL' | 'PENDING'
  const [dischargeDocFiles,  setDischargeDocFiles]  = useState({})  // { [docCd]: File | existing fileNm string }
  const [dischargeDocChecked, setDischargeDocChecked] = useState({}) // { [docCd]: bool } — PARTIAL/PENDING mode

  // ── Patient Discharge Approval ────────────────────────────────────────────
  const [approvalFiles,   setApprovalFiles]   = useState({}) // { [docCd]: File } — optional replacement
  const [approvalChecked, setApprovalChecked] = useState({}) // { [docCd]: bool } — Approve checkbox
  const [approvedDocFiles, setApprovedDocFiles] = useState({}) // { [docCd]: fileNm } — last saved approval snapshot
  const [approvalAmtProvider, setApprovalAmtProvider] = useState('')
  const [approvalCopayAmt,    setApprovalCopayAmt]    = useState('0')
  const [approvalDedAmt,      setApprovalDedAmt]      = useState('0')
  const [approvalCurrencyCd,  setApprovalCurrencyCd]  = useState('')
  const approvalNetAmt = (
    (parseFloat(approvalAmtProvider) || 0)
    - ((parseFloat(approvalCopayAmt) || 0) + (parseFloat(approvalDedAmt) || 0))
  ).toFixed(2)
  const [approvalSaving,      setApprovalSaving]      = useState(false)
  const [approvalSuccessMsgs, setApprovalSuccessMsgs] = useState([])

  const today = new Date().toISOString().split('T')[0]
  const [bulletins,            setBulletins]            = useState([])
  const [bulletinDt,           setBulletinDt]           = useState(today)
  const [bulletinProcedureDt,  setBulletinProcedureDt]  = useState('')
  const [bulletinUpdate,       setBulletinUpdate]       = useState('')
  const [bulletinTentativeDod, setBulletinTentativeDod] = useState('')
  const [bulletinEmailTo,      setBulletinEmailTo]      = useState('')
  const [bulletinEmailCc,      setBulletinEmailCc]      = useState('')
  const [bulletinSaving,       setBulletinSaving]       = useState(false)
  const [bulletinSuccessMsgs,  setBulletinSuccessMsgs]  = useState([])
  const [bulletinJustificationFile, setBulletinJustificationFile] = useState(null)

  // ── Section-wise view permission (Phase 1, view-only) ── fail-open: {} ⇒ all visible
  const [sectionRights, setSectionRights] = useState({})

  useEffect(() => {
    let cancelled = false
    async function loadSectionRights() {
      try {
        const rights = await fetchSectionRights(LEAD_ACTION_PAGE_KEY)
        if (!cancelled) setSectionRights(rights || {})
      } catch {
        // Fail-open — leave sectionRights empty so every section stays visible
      }
    }
    loadSectionRights()
    return () => { cancelled = true }
  }, [])

  async function openDoc(id) {
    try {
      await openDocument(id)
    } catch {
      setModalMsgs(['Could not open document. Please try again.'])
    }
  }

  useEffect(() => {
    fetchMasterItems('Currency').then(setCurrencyOptions).catch(() => setCurrencyOptions([]))
  }, [])

  useEffect(() => {
    fetchDropdown('ddlStepper').then(rows => setStepperOptions((rows || []).filter(r => r.value !== ''))).catch(() => setStepperOptions([]))
  }, [])

  useEffect(() => {
    if (!claimNo) { setError('No Treatment ID provided.'); setLoading(false); return }
    Promise.all([
      getLeadByClaimNo(claimNo),
      fetchEstimateRequests(claimNo, 'APPROVED').catch(() => []),
      fetchDocuments('LEAD', claimNo).catch(() => []),
      fetchEstimateRequests(claimNo, 'STATUS').catch(() => []),
      fetchGopData(claimNo).catch(() => null),
      fetchGopExpenses(claimNo).catch(() => []),
      fetchGopRecord(claimNo).catch(() => null),
      fetchMedicalBulletins(claimNo).catch(() => []),
      fetchDropdown('ddlDocumentType', 'Lead_Discharge').catch(() => []),
      fetchDischarge(claimNo).catch(() => ({ header: null, docs: [], checklistCodes: [] }))
    ])
      .then(([data, approvedRows, docs, estRows, gop, gopRows, gopRec, bulletinRows, dischargeDocDefRows, discharge]) => {
        if (!data) { setError('Lead not found.'); return }
        setLead(data)
        setHasApproved((approvedRows || []).length > 0)
        setDocuments(docs || [])
        setEstimateRows(estRows || [])
        setGopData(gop)
        if (gop) {
          setPrvCurrencyCd(gop.currencyCd || '')
          setDischargeCurrencyCd(gop.currencyCd || '')
          setPrvTreatmentCost(gop.treatmentCost != null ? String(gop.treatmentCost) : '')
          setGopDoa(gop.estimatedDoa || '')
          setGopDod(gop.estimatedDod || '')
          setAdmitDoa(data?.doa || gop.estimatedDoa || '')
          setAdmitDod(data?.dod || gop.estimatedDod || '')
          setDischargeDod(data?.dod || gop.estimatedDod || '')
        }
        setGopExpenses(gopRows || [])
        setGopRecord(gopRec)
        setBulletins(bulletinRows || [])
        setBulletinEmailTo(data?.insurerEmail || '')
        setBulletinEmailCc(data?.emailId || '')

        // ── Discharge document workflow — bind lists + derive saved state ──
        setDischargeDocDefs((dischargeDocDefRows || []).filter(d => d.value))

        const savedDocs = discharge?.docs || []
        if (savedDocs.length > 0) {
          const allReceived = savedDocs.every(d => d.status === 'RECEIVED')
          const allRequested = savedDocs.every(d => d.status === 'REQUESTED')
          setDischargeDocAction(allReceived ? 'RECEIVED' : allRequested ? 'PENDING' : 'PARTIAL')
          setDischargeDocFiles(Object.fromEntries(
            savedDocs.filter(d => d.status === 'RECEIVED' && d.fileNm).map(d => [d.docCd, d.fileNm])
          ))
          setDischargeDocChecked(Object.fromEntries(
            savedDocs.filter(d => d.status === 'REQUESTED').map(d => [d.docCd, true])
          ))
        }

        setDischargeChecklist(Object.fromEntries(
          (discharge?.checklistCodes || []).map(code => [code, true])
        ))

        // Header row (if a discharge save already exists for this claim) takes
        // priority over the GOP-derived defaults set above.
        const header = discharge?.header
        if (header) {
          if (header.actionMode) setDischargeDocAction(header.actionMode)
          if (header.dischargeDt) setDischargeDod(header.dischargeDt)
          setDischargeRemarks(header.remarks || '')
          setDischargeCurrencyCd(header.currencyCd || '')
          setDischargeHospitalAmt(header.hospitalAmt != null ? String(header.hospitalAmt) : '')
          setDischargeCopayment(header.copayment != null ? String(header.copayment) : '')
          setDischargeDeductible(header.deductible != null ? String(header.deductible) : '')
        }

        // Approval snapshot (if a Patient Discharge Approval save already exists) —
        // takes priority over blank defaults so a reload shows what was actually approved.
        // Currency defaults to the Patient Discharge div's own currency, but the
        // approver may have picked a different one on a prior save.
        setApprovalCurrencyCd(header?.currencyCd || '')
        const approvalHeader = discharge?.approvalHeader
        if (approvalHeader) {
          setApprovalAmtProvider(approvalHeader.appAmtProvider != null ? String(approvalHeader.appAmtProvider) : '')
          setApprovalCopayAmt(approvalHeader.appCopayAmt != null ? String(approvalHeader.appCopayAmt) : '0')
          setApprovalDedAmt(approvalHeader.appDedAmt != null ? String(approvalHeader.appDedAmt) : '0')
          if (approvalHeader.providerCurrencyCd) setApprovalCurrencyCd(approvalHeader.providerCurrencyCd)
        }
        setApprovedDocFiles(Object.fromEntries(
          (discharge?.approvalDocs || []).filter(d => d.status === 'RECEIVED' && d.fileNm).map(d => [d.docCd, d.fileNm])
        ))
      })
      .catch(() => setError('Failed to load lead details.'))
      .finally(() => setLoading(false))
  }, [claimNo])

  if (loading) return (
    <div className="lead-action-page">
      <div className="la-header-wrap">
        <div className="page-header-banner la-header">
          <h2>Lead Action</h2>
          <button className="lead-action-back" onClick={() => navigate('/leads/search')}>
            Back
          </button>
        </div>
      </div>
      <div className="lead-action-loading"><i className="fas fa-spinner fa-spin"></i> Loading...</div>
    </div>
  )

  if (error || !lead) return (
    <div className="lead-action-page">
      <div className="la-header-wrap">
        <div className="page-header-banner la-header">
          <h2>Lead Action</h2>
          <button className="lead-action-back" onClick={() => navigate('/leads/search')}>
            Back
          </button>
        </div>
      </div>
      <div className="lead-action-error">{error || 'Lead not found.'}</div>
    </div>
  )

  function reloadLead() {
    setLoading(true)
    Promise.all([
      getLeadByClaimNo(claimNo),
      fetchEstimateRequests(claimNo, 'APPROVED').catch(() => []),
      fetchDocuments('LEAD', claimNo).catch(() => []),
      fetchEstimateRequests(claimNo, 'STATUS').catch(() => []),
      fetchGopData(claimNo).catch(() => null),
      fetchGopExpenses(claimNo).catch(() => []),
      fetchGopRecord(claimNo).catch(() => null)
    ])
      .then(([data, approvedRows, docs, estRows, gop, gopRows, gopRec]) => {
        if (!data) return
        setLead(data)
        setHasApproved((approvedRows || []).length > 0)
        setDocuments(docs || [])
        setEstimateRows(estRows || [])
        setGopData(gop)
        if (gop) {
          setPrvCurrencyCd(gop.currencyCd || '')
          setDischargeCurrencyCd(gop.currencyCd || '')
          setPrvTreatmentCost(gop.treatmentCost != null ? String(gop.treatmentCost) : '')
          setGopDoa(gop.estimatedDoa || '')
          setGopDod(gop.estimatedDod || '')
          setAdmitDoa(data?.doa || gop.estimatedDoa || '')
          setAdmitDod(data?.dod || gop.estimatedDod || '')
          setDischargeDod(data?.dod || gop.estimatedDod || '')
        }
        setGopExpenses(gopRows || [])
        setGopRecord(gopRec)
      })
      .finally(() => setLoading(false))
  }

  function ViewEstimateModal({ row, onClose }) {
    const fields = [
      { label: 'Provider',          value: row.prvNm || row.prvCd },
      { label: 'Line of Treatment', value: row.lineOfTreatment },
      { label: 'ICD Code',          value: row.icdCd },
      { label: 'ICD Description',   value: row.icdDesc },
      { label: 'CPT Code',          value: row.cptCd },
      { label: 'CPT Description',   value: row.cptDesc },
      { label: 'DRG Code',          value: row.drgCd },
      { label: 'DRG Description',   value: row.drgDesc },
      { label: 'No. of Days',       value: row.los != null ? String(row.los) : '' },
      { label: 'Currency',          value: row.currency },
    ]
    const hasData = fields.some(f => f.value)

    // Cross-tab: Room Type as columns, Expense Head as rows — mirrors the
    // Estimate Compare layout. roomType is per-line now (a provider can offer
    // several room-type options), so it's no longer a single top-level field.
    const roomTypes = []
    const seenRoomTypes = new Set()
    expenses.forEach(e => {
      const key = e.roomType || ''
      if (!seenRoomTypes.has(key)) { seenRoomTypes.add(key); roomTypes.push({ roomType: key, roomTypeNm: e.roomTypeNm || '(No Room Type)' }) }
    })

    const expenseRows = []
    const seenExpense = new Set()
    expenses.forEach(e => {
      const key = `${e.treatmentCd}|${e.expenseCd}`
      if (!seenExpense.has(key)) { seenExpense.add(key); expenseRows.push({ key, expenseNm: e.expenseNm || '—' }) }
    })

    function cellFor(roomType, key) {
      return expenses.find(e => (e.roomType || '') === roomType && `${e.treatmentCd}|${e.expenseCd}` === key)
    }

    function fmtRange(min, max) {
      const a = (parseFloat(min) || 0).toFixed(2)
      const b = (parseFloat(max) || 0).toFixed(2)
      return a === b ? a : `${a} - ${b}`
    }

    function totalsFor(roomType) {
      return expenses
        .filter(e => (e.roomType || '') === roomType)
        .reduce((acc, e) => ({ min: acc.min + (parseFloat(e.minCost) || 0), max: acc.max + (parseFloat(e.maxCost) || 0) }), { min: 0, max: 0 })
    }

    return (
      <div className="csm-overlay" onClick={onClose}>
        <div className="csm-box es-view-modal" onClick={e => e.stopPropagation()}>
          <div className="csm-header">
            <span><i className="fas fa-file-medical"></i>&nbsp; View Estimate — {row.prvNm || row.prvCd}</span>
            <button className="csm-close" onClick={onClose}><i className="fas fa-times"></i></button>
          </div>
          <div className="es-view-body">
            {hasData ? (
              <table className="es-view-table">
                <tbody>
                  {fields.map(f => f.value
                    ? <tr key={f.label}><th>{f.label}</th><td>{f.value}</td></tr>
                    : null
                  )}
                </tbody>
              </table>
            ) : (
              <p className="csm-hint">No estimate details submitted yet.</p>
            )}
            <div className="es-expense-section">
              <h4 className="es-expense-heading">
                <i className="fas fa-list-alt"></i>&nbsp; Cost Breakdown
              </h4>
              {expLoading ? (
                <p className="csm-hint"><i className="fas fa-spinner fa-spin"></i> Loading…</p>
              ) : expenses.length === 0 ? (
                <p className="csm-hint">No expense data available.</p>
              ) : (
                <table className="es-expense-table">
                  <thead>
                    <tr>
                      <th></th>
                      {roomTypes.map(rt => <th key={rt.roomType} style={{ textAlign: 'left' }}>{rt.roomTypeNm}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {expenseRows.map(er => (
                      <tr key={er.key}>
                        <th style={{ textAlign: 'left' }}>{er.expenseNm}</th>
                        {roomTypes.map(rt => {
                          const cell = cellFor(rt.roomType, er.key)
                          return (
                            <td key={rt.roomType} className="es-expense-cost" style={{ textAlign: 'left' }}>
                              {cell ? fmtRange(cell.minCost, cell.maxCost) : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="es-expense-total-row">
                      <th style={{ textAlign: 'left' }}>Total</th>
                      {roomTypes.map(rt => {
                        const t = totalsFor(rt.roomType)
                        return (
                          <td key={rt.roomType} className="es-expense-cost" style={{ textAlign: 'left' }}>
                            <strong>{fmtRange(t.min, t.max)}</strong>
                          </td>
                        )
                      })}
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  async function handleAcceptEstimate() {
    try {
      const token = await fetchEstimateAcceptanceToken(claimNo)
      if (!token) {
        setModalMsgs(['No active acceptance link found for this case. Please regenerate the estimate from Compare Estimates.'])
        return
      }
      navigate(`/leads/estimate-acceptance?token=${encodeURIComponent(token)}&claim_no=${encodeURIComponent(claimNo)}`)
    } catch {
      setModalMsgs(['Unable to retrieve acceptance link. Please try again.'])
    }
  }

  // ── Download Treatment Plan — same condition/data as Estimate Compare's
  // Download button (at least one provider estimate already shared); uses
  // whatever remarks were last saved (MT_LeadRegistration.EstRem) since there's
  // no remarks textbox on this screen.
  async function handleDownloadTreatmentPlan() {
    setTreatmentPdfDownloading(true)
    try {
      const base64 = await fetchTreatmentPlanPdf({
        claimNo,
        memberId: lead?.memberId ?? '',
        remarks:  lead?.estRem ?? ''
      })
      const byteChars = atob(base64)
      const byteNumbers = new Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `TreatmentPlan_${claimNo}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to download the treatment plan. Please try again.'])
    } finally {
      setTreatmentPdfDownloading(false)
    }
  }

  function handleShowGop() {
    setShowGopModal(true)
  }

  async function handleGenerateGop() {
    if (!gopData) { setModalMsgs(['GOP data not available. Cannot generate GOP.']); return }
    setGopSaving(true)
    try {
      const memberName = [lead.firstName, lead.middleName, lead.lastName].filter(Boolean).join(' ')
      const memberAge  = lead.dob
        ? Math.floor((Date.now() - new Date(lead.dob)) / (365.25 * 24 * 60 * 60 * 1000))
        : null
      const currencyCd = prvCurrencyCd || gopData.currencyCd || ''
      const coPay      = gopData.coPay || ''

      const payload = {
        mode:         gopRecord ? 'U' : 'I',
        claimNo:      lead.claimNo,
        memberId:     lead.memberId,
        prvCd:        gopData.prvCd,
        prvNm:        gopData.prvNm,
        prvLocation:  gopData.prvAddr,
        memberName,
        memberAge,
        memberGender: lead.gender,
        memberEmail:  lead.emailId,
        insurerCd:    lead.insurerCd,
        insurerNm:    lead.insurerNm,
        drNm:         lead.doctorNm,
        treatment:    lead.treatmentTypeNm,
        deptCd:       lead.department,
        currencyCd,
        treatmentCost: parseFloat(prvTreatmentCost) || parseFloat(gopData.treatmentCost) || 0,
        gopRemarks:   gopData.exclusion,
        exclusion:    gopData.exclusion,
        isCoPayment:  coPay.trim() ? 1 : 0,
        coPaymentPer: coPay,
        diagnosis:    lead.icdDesc || '',
        estimatedDoa:    gopDoa,
        estimatedDod:    gopDod,
        stayInHospital:  gopData.los != null ? String(gopData.los) : '',
        roomTypeCd:      gopData.roomTypeCd  || '',
        roomTypeNm:      gopData.roomTypeNm  || '',
        approvedBillAmt: parseFloat(prvTreatmentCost) || null,
        expenses:     gopExpenses.map(r => ({
          id:      r.id,
          gopCost: parseFloat(r.cost) || 0
        }))
      }

      const id = await saveGop(payload)
      const rec = await fetchGopRecord(lead.claimNo)
      setGopRecord(rec)
      setModalMsgs([`GOP ${gopRecord ? 'updated' : 'generated'} successfully. ID: ${id}`])
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to generate GOP. Please try again.'])
    } finally {
      setGopSaving(false)
    }
  }

  const stepActive = Number(lead.stepperCd ?? 0)
  const buttons    = buildButtons(lead.statusGrp, lead.statusCd, claimNo, navigate, hasApproved, lead.acceptedPrvCd || lead.providerCd, handleAcceptEstimate)

  const _sg           = String(lead.statusGrp ?? '')
  const showGop        = (_sg === '318' || _sg === '322') && lead.paymentMode !== 'PM0001'
  const showTravellers = (_sg === '318' || _sg === '322') && (gopData?.travellers?.length > 0)
  const showAdmit      = lead.isAppointmentConfirmed === 1
  const showDischarge  = lead.isAdmitted === 1
  const showBulletin   = _sg === '322'
  const isDischargeLocked     = Number(lead.statusCd) === 327
  const showDischargeApproval = Number(lead.statusCd) === 324 || isDischargeLocked

  // ── Auto-expand rule: whichever sections are actually visible (in render
  // order), only the first and the last one default to expanded; every
  // section in between defaults to collapsed. ──────────────────────────────
  const statusVisibility = [
    true,                          // 0 Lead & Personal Information (includes Documents Uploaded)
    true,                          // 1 Medical Information
    true,                          // 2 Payment Information
    Number(lead.statusCd) > 301,   // 3 Estimate Status
    showTravellers,                // 4 Travellers
    showGop,                       // 5 GOP Issue
    showBulletin,                  // 6 Medical Bulletin
    showAdmit,                     // 7 Patient Admission
    showDischarge,                 // 8 Patient Discharge
    showDischargeApproval,         // 9 Patient Discharge Approval
    Number(lead.statusCd) >= 327,  // 10 Claim Submission
  ]
  // Role-based section rights (fail-open: sectionRights[code] === false is the
  // only case that hides a section — undefined/missing/true all stay visible).
  const sectionVisibility = statusVisibility.map(
    (v, i) => v && sectionRights[SECTION_CODES[i]] !== false
  )
  const visibleSectionIdx = sectionVisibility.reduce((arr, v, i) => v ? [...arr, i] : arr, [])
  const firstSectionIdx   = visibleSectionIdx[0]
  const lastSectionIdx    = visibleSectionIdx[visibleSectionIdx.length - 1]
  const isEdgeSection     = idx => idx === firstSectionIdx || idx === lastSectionIdx

  const thStyle = { padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #dee2e6', whiteSpace: 'nowrap' }
  const tdStyle = { padding: '6px 10px', color: '#333', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' }

  return (
    <div className="lead-action-page">
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />
      <ValidationModal messages={admitSuccessMsgs} onClose={() => { setAdmitSuccessMsgs([]); navigate(0) }} type="success" />
      <ValidationModal messages={dischargeSuccessMsgs} onClose={() => { setDischargeSuccessMsgs([]); navigate('/leads/search') }} type="success" />
      <ValidationModal messages={approvalSuccessMsgs} onClose={() => { setApprovalSuccessMsgs([]); navigate('/leads/search') }} type="success" />
      <ValidationModal messages={bulletinSuccessMsgs} onClose={() => { setBulletinSuccessMsgs([]); fetchMedicalBulletins(claimNo).then(setBulletins).catch(() => {}) }} type="success" />
      {showVisaInvite && <VisaInviteModal claimNo={claimNo} onClose={() => setShowVisaInvite(false)} />}
      {viewRow && <ViewEstimateModal row={viewRow} onClose={() => setViewRow(null)} />}

      {showGopModal && (
        <GopLetterModal
          claimNo={lead.claimNo}
          memberId={lead.memberId}
          prvCd={gopData?.prvCd || ''}
          prvNm={gopData?.prvNm || ''}
          prvEmail={gopData?.prvEmail || ''}
          onClose={() => setShowGopModal(false)}
          onSent={() => navigate('/leads/search')}
        />
      )}

      {/* ── Header banner (constrained to content width) ── */}
      <div className="la-header-wrap">
        <div className="page-header-banner la-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, textAlign: 'left' }}>
            Lead Action {lead?.claimNo && <>- Treatment ID : {lead.claimNo}</>}
          </h2>
          <button className="lead-action-back" onClick={() => navigate('/leads/search')}>
            Back
          </button>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="la-content-wrap">
        <div className="statusbar-wrapper">
          <p className="statusbar-heading">Patient Journey Status</p>
          <div className="statusbar-track">
            {stepperOptions.map(step => (
              <div key={step.value} className={`statusbar-step${stepActive === Number(step.value) ? ' statusbar-active' : ''}`}>
                <div className="statusbar-chip">
                  <span className="statusbar-label">{step.text}</span>
                  <span className="statusbar-dots">
                    <span></span><span></span><span></span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Detail sections ── */}
        <div className="caseassigneddetailswrapper">

          {/* Section 1 — Lead & Personal (expanded) */}
          {sectionVisibility[0] && <Section title="Lead & Personal Information" defaultOpen={isEdgeSection(0)}>
            <div className="detail-grid">
              <Item label="Source"           value={lead.sourceNm}          />
              <Item label={lead.sourceNm || 'Insurance'} value={lead.insurerNm} />
              <Item label="Member ID"        value={lead.memberId}          />
              <Item label="Treatment ID"      value={lead.claimNo}           />
              <Item label="First Name"       value={lead.firstName}         />
              <Item label="Middle Name"      value={lead.middleName}        />
              <Item label="Last Name"        value={lead.lastName}          />
              <Item label="Email"            value={lead.emailId}           />
              <Item label="Date of Birth"    value={lead.dob}               />
              <Item label="Gender"           value={lead.gender}            />
              <Item label="Nationality"      value={lead.nationalityNm}     />
              <Item label="Mobile No."       value={`${lead.callingCd ? lead.callingCd + ' ' : ''}${lead.mobileNo}`} />
              <Item label="Patient Location" value={lead.patientLocationNm} />
              <Item label="Document Type"    value={lead.documentTypeNm}    />
              <Item label="Document No."     value={lead.documentNo}        />
              <Item label="Category"         value={lead.leadType}          />
            </div>

            {documents.length > 0 && (
              <div className="uploaded-files-list" style={{ marginTop: 12 }}>
                {documents.map(doc => (
                  <span
                    key={doc.id}
                    className="file-box"
                    title={`Open ${doc.docTypeNm || doc.originalFileName || doc.fileName}`}
                    onClick={() => openDoc(doc.id)}
                  >
                    <i className={fileIcon(doc.originalFileName || doc.fileName)}></i>
                    {doc.docTypeNm || doc.originalFileName || doc.fileName}
                  </span>
                ))}
              </div>
            )}
          </Section>}

          {/* Section 2 — Medical Info (collapsed) */}
          {sectionVisibility[1] && <Section title="Medical Information" defaultOpen={isEdgeSection(1)}>
            <div className="detail-grid">
              <Item label="Treatment Type" value={lead.treatmentTypeNm} />
              <Item label="Department"     value={lead.departmentNm}    />
              <Item label="Hospital"       value={lead.providerNm}      />
              <Item label="Branch"         value={lead.branchNm}        />
              <Item label="Doctor"         value={lead.doctorNm}        />
            </div>

            {lead.caseNote && (
              <div className="detail-grid" style={{ marginTop: '12px' }}>
                <Item label="Case Note" value={lead.caseNote} full />
              </div>
            )}
          </Section>}

          {/* Section 3 — Payment Info (collapsed) */}
          {sectionVisibility[2] && <Section title="Payment Information" defaultOpen={isEdgeSection(2)}>
            <div className="detail-grid">
              <Item label="Payment Mode" value={lead.paymentModeNm} />
              <Item label="Guarantor"    value={lead.guarantorNm}   />
            </div>
          </Section>}

          {/* Section 4 — Estimate Status (visible only when status has progressed past initial registration) */}
          {sectionVisibility[3] && <Section title="Estimate Status" defaultOpen={isEdgeSection(3)}>
            <div style={{ marginBottom: 10, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 18 }}>
              {estimateRows.some(r => r.isShared === 1) && (
                <span
                  style={{ color: '#c0392b', fontSize: 13, fontWeight: 700, cursor: treatmentPdfDownloading ? 'default' : 'pointer', textDecoration: 'underline', opacity: treatmentPdfDownloading ? 0.6 : 1 }}
                  onClick={() => !treatmentPdfDownloading && handleDownloadTreatmentPlan()}
                >
                  <i className={`fas ${treatmentPdfDownloading ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`} style={{ marginRight: 5 }}></i>
                  {treatmentPdfDownloading ? 'Preparing PDF…' : 'Download Treatment Plan'}
                </span>
              )}
              <span
                style={{ color: '#632da7', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => navigate(estimateRequestPath(claimNo, '&mode=additional'))}
              >
                <i className="fas fa-calculator" style={{ marginRight: 5 }}></i>Proceed for Estimate
              </span>
            </div>
            <div className="estimate-display-container">
              <div className="estimate-display-table-wrapper">
                <table className="estimate-display-table">
                  <thead>
                    <tr>
                      <th>Sl.No</th>
                      <th>Hospital</th>
                      <th>Status</th>
                      <th>View</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                      <th style={{ textAlign: 'center' }}>Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimateRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                          No estimate requests found for this claim.
                        </td>
                      </tr>
                    ) : estimateRows.map((row, i) => {
                      const statusUp = (row.statusNm || '').toUpperCase()
                      const actionEnabled = statusUp === 'REQUESTED' || statusUp === 'ACCEPTED'
                      return (
                        <tr key={row.requestNo}>
                          <td data-label="Sl.No">
                            <span className="estimate-display-slno">{i + 1}</span>
                          </td>
                          <td data-label="Hospital">
                            <span className="estimate-display-hospital-name">
                              {row.prvNm || row.prvCd}
                            </span>
                            {row.isApproved === 1 && (
                              <span className="es-approved-tag">
                                <i className="fas fa-check"></i> Approved
                              </span>
                            )}
                          </td>
                          <td data-label="Status">
                            <span className={`estimate-display-status-badge ${badgeCls(row.statusNm)}`}>
                              {row.statusNm}
                            </span>
                            {row.declineReason && (
                              <div className="es-decline-reason">{row.declineReason}</div>
                            )}
                          </td>
                          <td data-label="View">
                            {statusUp === 'ESTIMATE SHARED' && (
                              <button
                                className="es-plain-icon-btn"
                                title="View Estimate"
                                onClick={() => {
                                  setViewRow(row)
                                  setExpenses([])
                                  setExpLoading(true)
                                  fetchEstimateExpenses(row.requestNo)
                                    .then(data => setExpenses(data || []))
                                    .catch(() => setExpenses([]))
                                    .finally(() => setExpLoading(false))
                                }}
                              >
                                <i className="fas fa-eye view-estimate-icon"></i>
                              </button>
                            )}
                            {row.acceptance === 2 && (
                              <button
                                className="es-plain-icon-btn"
                                title="View Decline Reason"
                                onClick={() => setModalMsgs([row.declineReason || 'No decline reason provided.'])}
                              >
                                <i className="fas fa-eye decline-reason-icon"></i>
                              </button>
                            )}
                          </td>
                          <td data-label="Action" style={{ textAlign: 'center' }}>
                            <button
                              className="es-plain-icon-btn"
                              title={actionEnabled ? 'Fill Estimate' : 'Action not available'}
                              disabled={!actionEnabled}
                              style={{ opacity: actionEnabled ? 1 : 0.35, cursor: actionEnabled ? 'pointer' : 'not-allowed' }}
                              onClick={() => actionEnabled && navigate(`/leads/estimate-req?token=${row.requestNo}`)}
                            >
                              <i className="fas fa-edit" style={{ color: actionEnabled ? '#632da7' : '#999', fontSize: 18 }}></i>
                            </button>
                          </td>
                          <td data-label="Edit" style={{ textAlign: 'center' }}>
                            {statusUp === 'ESTIMATE SHARED' && (
                              <button
                                className="es-plain-icon-btn"
                                title="Edit Estimate"
                                onClick={() => navigate(`/leads/estimate-cu?token=${row.requestNo}&edit=true`)}
                              >
                                <i className="fas fa-pen" style={{ color: '#1a7f5a', fontSize: 17 }}></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>}

          {/* Section — Travellers (visible when statusGrp 318 or 322, no payment mode condition) */}
          {sectionVisibility[4] && (
            <Section title="Travellers and Visa Invite" defaultOpen={isEdgeSection(4)}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Type</th>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Passport No</th>
                      <th style={thStyle}>Nationality</th>
                      <th style={thStyle}>DOB</th>
                      <th style={thStyle}>Travel Date</th>
                      <th style={thStyle}>Mobile</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Visa Invite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gopData.travellers.map((t, idx) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={tdStyle}>{idx + 1}</td>
                        <td style={tdStyle}>{t.traveller === 'P' ? 'Patient' : t.traveller === 'A' ? 'Attendant' : t.traveller}</td>
                        <td style={tdStyle}>{t.fullNm}</td>
                        <td style={tdStyle}>{t.passportNo || '—'}</td>
                        <td style={tdStyle}>{t.nationality || '—'}</td>
                        <td style={tdStyle}>{t.dob || '—'}</td>
                        <td style={tdStyle}>{t.travelDt || '—'}</td>
                        <td style={tdStyle}>{t.mobileNo || '—'}</td>
                        <td style={tdStyle}>{t.emailId || '—'}</td>
                        <td style={tdStyle}>
                          {t.traveller === 'P' && (
                            <a href="#" onClick={e => { e.preventDefault(); setShowVisaInvite(true) }} style={{ color: '#0891b2', textDecoration: 'underline', fontSize: 13 }}>
                              Visa Invite
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Section 5 — GOP Issue (visible when statusGrp = 318 or 322 AND payment mode is not Self) */}
          {sectionVisibility[5] && (
            <Section title="GOP Issue" defaultOpen={isEdgeSection(5)}>
              {gopData ? (
                <div className="detail-grid">
                  <Item label="Provider Code"    value={gopData.prvCd}       />
                  <Item label="Provider Name"    value={gopData.prvNm}       />
                  <Item label="Provider Address" value={gopData.prvAddr}     />
                  <Item label="Policy End Date"  value={gopData.policyEndDt} />
                  <Item label="Co-Payment"       value={gopData.coPay}       />
                  <Item label="Exclusion"        value={gopData.exclusion}   />
                  <Item label="Treatment Type"   value={lead.treatmentTypeNm || ''} />
                  <Item label="No. of Days Stay" value={gopData.los != null ? String(gopData.los) : ''} />
                  <Item label="Room Type"        value={gopData.roomTypeNm || ''} />
                </div>
              ) : (
                <p style={{ color: '#888', padding: '10px 0' }}>No GOP data available for this claim.</p>
              )}

              {gopData && (
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px', maxWidth: 620 }}>
                  <div className="detail-item">
                    <label>Ins. Comp. Currency</label>
                    <span>{gopData.insCurrencyCd || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Ins. Comp. Treatment Cost</label>
                    <span>{gopData.insTreatmentCost ?? '—'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
                      Provider Currency
                    </label>
                    <select
                      className="lead-form-input"
                      value={prvCurrencyCd}
                      onChange={e => setPrvCurrencyCd(e.target.value)}
                    >
                      <option value="">-- Select --</option>
                      {currencyOptions.map(c => (
                        <option key={c.value} value={c.value}>{c.text}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
                      Provider Treatment Cost
                    </label>
                    <input
                      type="number"
                      className="lead-form-input"
                      value={prvTreatmentCost}
                      onChange={e => setPrvTreatmentCost(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
                      Proposed Admission Date
                    </label>
                    <input type="date" className="lead-form-input" value={gopDoa} min={new Date().toISOString().split('T')[0]} onChange={e => setGopDoa(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
                      Expected Discharge Date
                    </label>
                    <input type="date" className="lead-form-input" value={gopDod} min={gopDoa || new Date().toISOString().split('T')[0]} onChange={e => setGopDod(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Expense grid — hidden */}
              <div style={{ display: 'none' }}>
                <table className="estimate-display-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>Sl.No</th>
                      <th>Currency</th>
                      <th>Remarks</th>
                      <th style={{ width: 140 }}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gopExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: 16, color: '#888' }}>
                          No expense records found.
                        </td>
                      </tr>
                    ) : gopExpenses.map((row, idx) => (
                      <tr key={row.id}>
                        <td>{idx + 1}</td>
                        <td>{row.currencyCd || '—'}</td>
                        <td>{row.remarks || '—'}</td>
                        <td>
                          <input
                            type="number"
                            value={row.cost}
                            onChange={e => {
                              const updated = gopExpenses.map((r, i) =>
                                i === idx ? { ...r, cost: e.target.value } : r
                              )
                              setGopExpenses(updated)
                            }}
                            style={{
                              fontSize: 13, color: '#111', background: '#fff',
                              border: '1px solid #dee2e6', borderRadius: 6,
                              padding: '6px 10px', width: '100%', outline: 'none',
                              boxSizing: 'border-box', textAlign: 'right'
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {gopExpenses.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, padding: '8px 10px', color: '#555' }}>
                          Total
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input
                            readOnly
                            value={gopExpenses.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0)}
                            style={{
                              fontSize: 13, color: '#111', background: '#f8f9fa',
                              border: '1px solid #dee2e6', borderRadius: 6,
                              padding: '6px 10px', width: '100%', outline: 'none',
                              boxSizing: 'border-box', textAlign: 'right', fontWeight: 700
                            }}
                          />
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {gopRecord?.gopNo && (
                <div style={{ marginTop: 12 }}>
                  <div className="detail-item">
                    <label>GOP No</label>
                    <span>{gopRecord.gopNo}</span>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button
                  className="gradient-btn"
                  onClick={handleGenerateGop}
                  disabled={gopSaving || !gopData}
                >
                  {gopSaving
                    ? <><i className="fas fa-spinner fa-spin"></i> {gopRecord ? 'Updating...' : 'Generating...'}</>
                    : <><i className="fas fa-file-alt"></i> {gopRecord ? 'Update GOP' : 'Generate GOP'}</>
                  }
                </button>
                <button
                  className="gradient-btn"
                  onClick={handleShowGop}
                  disabled={!gopRecord || gopPreviewing}
                  title={!gopRecord ? 'Generate GOP first' : 'Preview GOP letter'}
                >
                  {gopPreviewing
                    ? <><i className="fas fa-spinner fa-spin"></i> Loading...</>
                    : <><i className="fas fa-eye"></i> Show GOP</>
                  }
                </button>
              </div>
            </Section>
          )}

          {/* Section — Medical Bulletin (visible when statusGrp 322) */}
          {sectionVisibility[6] && (
            <Section title="Medical Bulletin" defaultOpen={isEdgeSection(6)}>

              {/* Add new entry form — 3 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px 24px', maxWidth: 1000 }}>
                {/* Row 1: Bulletin Date | Date of Procedure | To (Email) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>
                    Bulletin Date <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={bulletinDt}
                    onChange={e => setBulletinDt(e.target.value)}
                    style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Date of Procedure</label>
                  <input
                    type="date"
                    value={bulletinProcedureDt}
                    onChange={e => setBulletinProcedureDt(e.target.value)}
                    style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>
                    To (Email) <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={bulletinEmailTo}
                    onChange={e => setBulletinEmailTo(e.target.value)}
                    placeholder="Recipient email"
                    style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                {/* Row 2: Tentative Date of Discharge | CC (Email) | (empty) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Tentative Date of Discharge</label>
                  <input
                    type="text"
                    value={bulletinTentativeDod}
                    onChange={e => setBulletinTentativeDod(e.target.value)}
                    placeholder="e.g. 15-07-2026 or Not decided yet"
                    style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>CC (Email)</label>
                  <input
                    type="text"
                    value={bulletinEmailCc}
                    onChange={e => setBulletinEmailCc(e.target.value)}
                    placeholder="CC email"
                    style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div />
                {/* Row 3: Medical Update (full width) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Medical Update</label>
                  <textarea
                    value={bulletinUpdate}
                    onChange={e => setBulletinUpdate(e.target.value)}
                    rows={4}
                    placeholder="Enter medical update..."
                    style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Justification Letter (if stay extended)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={e => setBulletinJustificationFile(e.target.files?.[0] || null)}
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                  <button
                    className="gradient-btn"
                    disabled={bulletinSaving || !bulletinDt}
                    onClick={async () => {
                      setBulletinSaving(true)
                      try {
                        let justificationFileName = ''
                        if (bulletinJustificationFile) {
                          const uploaded = await uploadDocument({
                            moduleCd:    'LEAD',
                            referenceCd: lead.claimNo,
                            memberId:    lead.memberId,
                            docTypeCd:   'DT14',
                            docTypeNm:   'Justification Letter',
                            file:        bulletinJustificationFile,
                            auth:        true
                          })
                          justificationFileName = uploaded?.fileName || ''
                        }

                        await saveMedicalBulletin({
                          claimNo:           lead.claimNo,
                          memberId:          lead.memberId,
                          medicalBulletinDt: bulletinDt,
                          procedureDt:       bulletinProcedureDt,
                          medicalUpdate:     bulletinUpdate,
                          tentativeDod:      bulletinTentativeDod,
                          emailTo:           bulletinEmailTo,
                          emailCc:           bulletinEmailCc,
                          justificationFileName
                        })
                        setBulletinProcedureDt('')
                        setBulletinUpdate('')
                        setBulletinTentativeDod('')
                        setBulletinDt(new Date().toISOString().split('T')[0])
                        setBulletinJustificationFile(null)
                        setBulletinSuccessMsgs(['Medical Bulletin saved and email sent successfully.'])
                      } catch (err) {
                        setModalMsgs([err?.message || 'Failed to save medical bulletin.'])
                      } finally {
                        setBulletinSaving(false)
                      }
                    }}
                  >
                    {bulletinSaving
                      ? <><i className="fas fa-spinner fa-spin"></i> Saving...</>
                      : <><i className="fas fa-notes-medical"></i> Submit &amp; Send</>
                    }
                  </button>
                </div>
              </div>

              {/* History table — always shown below the form */}
              <div style={{ overflowX: 'auto', marginTop: 28 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Bulletin Date', 'Procedure Date', 'Medical Update', 'Tentative Discharge'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bulletins.length === 0
                      ? <tr><td colSpan={4} style={{ padding: '16px 10px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>No records found.</td></tr>
                      : bulletins.map(b => (
                          <tr key={b.id}>
                            <td style={tdStyle}>{b.medicalBulletinDt}</td>
                            <td style={tdStyle}>{b.procedureDt || '-'}</td>
                            <td style={{ ...tdStyle, whiteSpace: 'pre-wrap', maxWidth: 320 }}>{b.medicalUpdate || '-'}</td>
                            <td style={tdStyle}>{b.tentativeDod || '-'}</td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Section 6 — Patient Admission (visible when statusCd >= 320) */}
          {sectionVisibility[7] && (
            <Section title="Patient Admission" defaultOpen={isEdgeSection(7)}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px', maxWidth: 560 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>
                      Admission Date <span style={{ color: '#e53e3e' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={admitDoa}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => { setAdmitDoa(e.target.value); if (admitDod && e.target.value > admitDod) setAdmitDod('') }}
                      style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Tentative Discharge Date</label>
                    <input
                      type="date"
                      value={admitDod}
                      min={admitDoa || new Date().toISOString().split('T')[0]}
                      onChange={e => setAdmitDod(e.target.value)}
                      style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                    <button
                      className="gradient-btn"
                      disabled={admitSaving || !admitDoa}
                      onClick={async () => {
                        setAdmitSaving(true)
                        try {
                          await saveGop({
                            mode:         'A',
                            claimNo:      lead.claimNo,
                            memberId:     lead.memberId,
                            estimatedDoa: admitDoa,
                            estimatedDod: admitDod
                          })
                          setAdmitSuccessMsgs(['Patient admission details saved successfully.'])
                        } catch (err) {
                          setModalMsgs([err?.message || 'Failed to save admission details.'])
                        } finally {
                          setAdmitSaving(false)
                        }
                      }}
                    >
                      {admitSaving
                        ? <><i className="fas fa-spinner fa-spin"></i> Saving...</>
                        : <><i className="fas fa-hospital-user"></i> Submit</>
                      }
                    </button>
                  </div>
                </div>
            </Section>
          )}

          {/* Section 7 — Patient Discharge (visible when statusCd >= 320) */}
          {sectionVisibility[8] && (
            <Section title="Patient Discharge" defaultOpen={isEdgeSection(8)}>

              {/* ── Accepted provider — automailer recipient for Partial/Pending ── */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px', fontSize: 13, color: '#333', background: '#f5f0fb', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                <span><strong>Accepted Provider:</strong> {gopData?.prvNm || lead.acceptedPrvNm || '—'}</span>
                <span><strong>Email (automailer recipient):</strong> {gopData?.prvEmail || '—'}</span>
              </div>

              {/* ── Discharge document action selection — full width (UI only) ── */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {DISCHARGE_DOC_ACTIONS.map(a => (
                  <DischargeActionCard
                    key={a.value}
                    icon={a.icon}
                    label={a.label}
                    active={dischargeDocAction === a.value}
                    onClick={() => {
                      setDischargeDocAction(a.value)
                      // Keep dischargeDocFiles — previously uploaded/received docs must
                      // stay visible (and carry forward) across a mode switch. Only the
                      // "ask from provider" ticks are mode-specific and get cleared.
                      setDischargeDocChecked({})
                    }}
                  />
                ))}
              </div>

              {dischargeDocAction && (
                <div style={{ marginTop: 20 }}>
                  <DischargeDocTable
                    mode={dischargeDocAction}
                    items={dischargeDocDefs}
                    files={dischargeDocFiles}
                    onBrowse={(docCd, file) => setDischargeDocFiles(prev => ({ ...prev, [docCd]: file }))}
                    onView={fileNm => {
                      fetchDocumentBlob(lead.claimNo, fileNm)
                        .then(blob => {
                          const url = URL.createObjectURL(blob)
                          window.open(url, '_blank')
                          setTimeout(() => URL.revokeObjectURL(url), 60000)
                        })
                        .catch(() => setModalMsgs(['Could not open document. Please try again.']))
                    }}
                    checked={dischargeDocChecked}
                    onToggle={docCd => setDischargeDocChecked(prev => ({ ...prev, [docCd]: !prev[docCd] }))}
                    onToggleAll={allChecked => setDischargeDocChecked(
                      Object.fromEntries(dischargeDocDefs.map(d => [d.value, allChecked]))
                    )}
                  />
                  {(dischargeDocAction === 'PARTIAL' || dischargeDocAction === 'PENDING') && (
                    <div style={{ marginTop: 10, fontSize: 12, color: '#666', fontStyle: 'italic' }}>
                      An email will be sent to the provider for the checked documents on Save.
                      No automatic reminders — resend by saving again.
                    </div>
                  )}

                  {/* ── Fixed checklist — same across all 3 options ── */}
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', width: '100%', marginTop: 20 }}>
                    <div style={{ background: '#f5f0fb', fontWeight: 600, fontSize: 13, padding: '10px 14px', color: '#555' }}>
                      Checklist
                    </div>
                    <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: '10px 28px' }}>
                      {dischargeDocDefs.map(item => (
                        <label
                          key={item.value}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#333', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          <input
                            type="checkbox"
                            checked={!!dischargeChecklist[item.value]}
                            onChange={() => setDischargeChecklist(prev => ({ ...prev, [item.value]: !prev[item.value] }))}
                          />
                          <span>{item.text}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Discharge Date, Remarks & Amounts — just above Save ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px 24px', maxWidth: 840, marginTop: 28 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>
                    Discharge Date <span style={{ color: '#e53e3e' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={dischargeDod}
                    min={admitDoa || undefined}
                    onChange={e => setDischargeDod(e.target.value)}
                    style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Remarks</label>
                  <textarea
                    value={dischargeRemarks}
                    onChange={e => setDischargeRemarks(e.target.value)}
                    rows={2}
                    style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Currency</label>
                  <select
                    className="lead-form-input"
                    value={dischargeCurrencyCd}
                    onChange={e => setDischargeCurrencyCd(e.target.value)}
                    style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  >
                    <option value="">-- Select --</option>
                    {currencyOptions.map(c => (
                      <option key={c.value} value={c.value}>{c.text}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Hospital Amount</label>
                  <input
                    type="number"
                    value={dischargeHospitalAmt}
                    onChange={e => setDischargeHospitalAmt(e.target.value)}
                    placeholder="0.00"
                    style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Copayment</label>
                  <input
                    type="number"
                    value={dischargeCopayment}
                    onChange={e => setDischargeCopayment(e.target.value)}
                    placeholder="0.00"
                    style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Deductible</label>
                  <input
                    type="number"
                    value={dischargeDeductible}
                    onChange={e => setDischargeDeductible(e.target.value)}
                    placeholder="0.00"
                    style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Final Amount</label>
                  <input
                    type="text"
                    value={dischargeFinalAmt}
                    readOnly
                    style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box', background: '#f5f5f5', fontWeight: 600 }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <button
                  className="gradient-btn"
                  disabled={dischargeSaving || !dischargeDod || !dischargeDocAction || isDischargeLocked}
                  title={isDischargeLocked ? 'Discharge already approved — no further changes allowed' : !dischargeDocAction ? 'Select a discharge document status above first' : undefined}
                  onClick={async () => {
                    const docs = dischargeDocDefs
                      .map(d => {
                        const fileVal = dischargeDocFiles[d.value]
                        if (fileVal instanceof File) return { docCd: d.value, docNm: d.text, status: 'RECEIVED', file: fileVal }
                        if (dischargeDocChecked[d.value]) return { docCd: d.value, docNm: d.text, status: 'REQUESTED' }
                        return null
                      })
                      .filter(Boolean)

                    const existingReceivedCount = dischargeDocDefs.filter(d => typeof dischargeDocFiles[d.value] === 'string' && dischargeDocFiles[d.value]).length
                    const receivedCount  = docs.filter(d => d.status === 'RECEIVED').length + existingReceivedCount
                    const requestedCount = docs.filter(d => d.status === 'REQUESTED').length
                    const checklistCount = Object.values(dischargeChecklist).filter(Boolean).length

                    const errs = []
                    if (dischargeDocAction === 'RECEIVED' && receivedCount === 0) {
                      errs.push('Please upload at least one document.')
                    }
                    if (dischargeDocAction === 'PARTIAL' && (receivedCount === 0 || requestedCount === 0)) {
                      errs.push('Please upload at least one document AND select at least one document to ask from the provider.')
                    }
                    if (dischargeDocAction === 'PENDING' && requestedCount === 0) {
                      errs.push('Please select at least one document to ask from the provider.')
                    }
                    if (dischargeDocAction === 'RECEIVED') {
                      const missingMandatory = dischargeDocDefs.filter(d => d.isRequired && !(dischargeDocFiles[d.value] instanceof File) && !dischargeChecklist[d.value])
                      if (missingMandatory.length > 0) {
                        errs.push(`Please upload the mandatory document(s): ${missingMandatory.map(d => d.text).join(', ')}.`)
                      }
                    }
                    if (checklistCount === 0)                  errs.push('Please select at least one checklist item.')
                    if (!dischargeDod)                        errs.push('Discharge Date is required.')
                    if (!(parseFloat(dischargeFinalAmt) > 0))  errs.push('Final Amount must be greater than 0.')
                    if (errs.length > 0) { setModalMsgs(errs); return }

                    setDischargeSaving(true)
                    try {
                      await saveDischarge({
                        claimNo:      lead.claimNo,
                        memberId:     lead.memberId,
                        prvCd:        lead.acceptedPrvCd || lead.providerCd || '',
                        estimatedDod: dischargeDod,
                        gopRemarks:   dischargeRemarks,
                        currencyCd:   dischargeCurrencyCd,
                        hospitalAmt:  dischargeHospitalAmt,
                        copayment:    dischargeCopayment,
                        deductible:   dischargeDeductible,
                        finalAmt:     dischargeFinalAmt,
                        checklist: dischargeDocDefs
                          .filter(item => dischargeChecklist[item.value])
                          .map(item => ({ itemCd: item.value, itemNm: item.text })),
                        actionMode:   dischargeDocAction,
                        docs
                      })
                      setDischargeSuccessMsgs(['Patient discharge details saved successfully.'])
                    } catch (err) {
                      setModalMsgs([err?.message || 'Failed to save discharge details.'])
                    } finally {
                      setDischargeSaving(false)
                    }
                  }}
                >
                  {dischargeSaving
                    ? <><i className="fas fa-spinner fa-spin"></i> Saving...</>
                    : <><i className="fas fa-save"></i> Save</>
                  }
                </button>
              </div>
            </Section>
          )}

          {/* Section 8 — Patient Discharge Approval (visible at status 324, locked at 327) */}
          {sectionVisibility[9] && (
            <Section title="Patient Discharge Approval" defaultOpen={isEdgeSection(9)}>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px', fontSize: 13, color: '#333', background: '#f5f0fb', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                <span><strong>Accepted Provider:</strong> {gopData?.prvNm || lead.acceptedPrvNm || '—'}</span>
                <span><strong>Email (automailer recipient):</strong> {gopData?.prvEmail || '—'}</span>
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', width: '100%', marginBottom: 20 }}>
                <div style={{ background: '#f5f0fb', fontWeight: 600, fontSize: 13, padding: '10px 14px', color: '#555' }}>Checklist</div>
                <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: '10px 28px' }}>
                  {dischargeDocDefs.map(item => (
                    <label key={item.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#333' }}>
                      <input type="checkbox" checked={!!dischargeChecklist[item.value]} disabled readOnly />
                      <span>{item.text}{item.isRequired && <span style={{ color: '#dc2626' }}> *</span>}</span>
                    </label>
                  ))}
                </div>
              </div>

              <DischargeApprovalDocTable
                items={dischargeDocDefs}
                draftFiles={Object.keys(approvedDocFiles).length > 0 ? approvedDocFiles : dischargeDocFiles}
                approvalFiles={approvalFiles}
                onBrowse={(docCd, file) => setApprovalFiles(prev => ({ ...prev, [docCd]: file }))}
                onViewExisting={fileNm => {
                  fetchDocumentBlob(lead.claimNo, fileNm)
                    .then(blob => {
                      const url = URL.createObjectURL(blob)
                      window.open(url, '_blank')
                      setTimeout(() => URL.revokeObjectURL(url), 60000)
                    })
                    .catch(() => setModalMsgs(['Could not open document. Please try again.']))
                }}
                checked={approvalChecked}
                onToggle={docCd => setApprovalChecked(prev => ({ ...prev, [docCd]: !prev[docCd] }))}
                locked={isDischargeLocked}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 32px', marginTop: 20 }}>
                <div style={{ background: '#f5f0fb', border: '1px solid #e3d5f5', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#555', marginBottom: 10 }}>Prepopulated from Discharge</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                    <div className="detail-item"><label>Provider Currency</label><span>{currencyOptions.find(c => c.value === dischargeCurrencyCd)?.text || dischargeCurrencyCd || '—'}</span></div>
                    <div className="detail-item"><label>Hospital Amount</label><span>{dischargeHospitalAmt || '—'}</span></div>
                    <div className="detail-item"><label>Copayment</label><span>{dischargeCopayment || '0'}</span></div>
                    <div className="detail-item"><label>Deductible</label><span>{dischargeDeductible || '0'}</span></div>
                    <div className="detail-item"><label>Final Amount</label><span>{dischargeFinalAmt || '—'}</span></div>
                  </div>
                </div>
                <div style={{ background: '#fff4ef', border: '1px solid #f5d0c0', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#555', marginBottom: 10 }}>Final Approved Amount</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Provider Currency</label>
                      <select value={approvalCurrencyCd} disabled={isDischargeLocked} onChange={e => setApprovalCurrencyCd(e.target.value)}
                        style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}>
                        {currencyOptions.map(c => (
                          <option key={c.value} value={c.value}>{c.text}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Insurance Approved Amount</label>
                      <input type="number" value={approvalAmtProvider} disabled={isDischargeLocked} onChange={e => setApprovalAmtProvider(e.target.value)} placeholder="0.00"
                        style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Co-Payment</label>
                      <input type="number" value={approvalCopayAmt} disabled={isDischargeLocked}
                        onChange={e => setApprovalCopayAmt(e.target.value)}
                        onBlur={e => { if (e.target.value.trim() === '') setApprovalCopayAmt('0') }}
                        placeholder="0.00"
                        style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Deductible</label>
                      <input type="number" value={approvalDedAmt} disabled={isDischargeLocked}
                        onChange={e => setApprovalDedAmt(e.target.value)}
                        onBlur={e => { if (e.target.value.trim() === '') setApprovalDedAmt('0') }}
                        placeholder="0.00"
                        style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Final Payment</label>
                      <input type="text" value={approvalNetAmt} readOnly
                        style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box', background: '#f5f5f5', fontWeight: 600 }} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <button
                  className="gradient-btn"
                  disabled={approvalSaving || isDischargeLocked}
                  title={isDischargeLocked ? 'Discharge already approved — no further changes allowed' : undefined}
                  onClick={async () => {
                    // Every currently-received document is sent — the Approve flag
                    // only tells the backend whether to use a newly-picked replacement
                    // file (checked) or keep the existing file (unchecked); it does not
                    // gate whether the document gets promoted at all. Documents with no
                    // draft file yet can also be uploaded for the first time here.
                    const approvalDocs = dischargeDocDefs
                      .filter(d => dischargeDocFiles[d.value] || approvalFiles[d.value] instanceof File)
                      .map(d => ({
                        docCd: d.value,
                        docNm: d.text,
                        approve: !!approvalChecked[d.value],
                        file: approvalFiles[d.value] instanceof File ? approvalFiles[d.value] : undefined
                      }))

                    const missingUpload = approvalDocs.find(d => d.approve && !d.file)
                    if (missingUpload) {
                      setModalMsgs([`Please upload a replacement document for "${missingUpload.docNm}" before approving it, or uncheck to keep the existing file.`])
                      return
                    }

                    const missingMandatory = dischargeDocDefs.filter(d => d.isRequired && !dischargeDocFiles[d.value] && !approvalFiles[d.value] && !dischargeChecklist[d.value])
                    if (missingMandatory.length > 0) {
                      setModalMsgs([`Mandatory document(s) missing: ${missingMandatory.map(d => d.text).join(', ')}. Please upload them, or tick them off in the checklist if already included in another uploaded file.`])
                      return
                    }

                    setApprovalSaving(true)
                    try {
                      await saveDischargeApproval({
                        claimNo: lead.claimNo,
                        memberId: lead.memberId,
                        appAmtProvider: approvalAmtProvider,
                        appCopayAmt: approvalCopayAmt,
                        appDedAmt: approvalDedAmt,
                        appNetAmtProvider: approvalNetAmt,
                        currencyCd: approvalCurrencyCd,
                        docs: approvalDocs
                      })
                      setApprovalSuccessMsgs(['Patient discharge approved successfully.'])
                    } catch (err) {
                      setModalMsgs([err?.message || 'Failed to save discharge approval.'])
                    } finally {
                      setApprovalSaving(false)
                    }
                  }}
                >
                  {approvalSaving
                    ? <><i className="fas fa-spinner fa-spin"></i> Saving...</>
                    : <><i className="fas fa-save"></i> Save</>
                  }
                </button>
              </div>
            </Section>
          )}

          {/* Section — Claim Submission (visible once discharge is approved, status >= 327) */}
          {sectionVisibility[10] && (
            <Section title="Claim Submission" defaultOpen={isEdgeSection(10)}>
              <p style={{ fontSize: 13, color: '#555', margin: '0 0 14px' }}>
                Finalize the claim submission — bill amount, treatment codes, case details, and the document checklist — in a dedicated page.
              </p>
              <button
                className="gradient-btn"
                onClick={() => navigate(`/leads/claim-submission?claimNo=${lead.claimNo}`)}
              >
                <i className="fas fa-file-invoice"></i> Open Claim Submission
              </button>
            </Section>
          )}

        </div>

        {/* ── Action buttons at bottom ── */}
        {buttons.length > 0 && (
          <div className="action-buttons">
            {buttons.map((b, i) => (
              <button key={i} className="gradient-btn" onClick={b.onClick}>
                <i className={b.icon}></i> {b.label}
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
