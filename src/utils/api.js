import { authUtils } from './auth'

export const API_BASE = import.meta.env.VITE_API_BASE

// Single source of truth for the backend's API version route segment.
// Every apiFetch(path) call passes a path WITHOUT a leading /v1 — this is the
// only place that prefix gets added. Set to '' once the backend route no
// longer requires a version segment.
export const API_VERSION = ''
const VERSION_SEGMENT = API_VERSION ? `/${API_VERSION}` : ''

export async function apiFetch(path, options = {}) {
  const token = authUtils.getToken()
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })

  // 204 = no content — return empty response object
  if (res.status === 204) return { errorObj: [], responseObj: null }

  if (res.status === 401) {
    authUtils.clearSession()
    throw new Error('UNAUTHORIZED')
  }

  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      // This app's own GenericResponse shape — ApiActionFilter rewrites 200-with-error
      // responses to a real HTTP status (e.g. 400), so the actual message lives here.
      const appErrorMsg = body?.errorObj?.[0]?.errorMessage
      detail = appErrorMsg
        ? ' | ' + appErrorMsg
        : body?.errors
        ? ' | ' + Object.entries(body.errors).map(([k, v]) => `${k}: ${v}`).join('; ')
        : body?.title
        ? ' | ' + body.title
        : ''
    } catch { /* ignore parse failure */ }
    const msg = `API error ${res.status} — ${path}${detail}`
    console.error(msg)
    throw new Error(msg)
  }

  return res.json()
}

/** Generic dropdown — returns [{value, text}] */
export async function fetchDropdown(mode, filterId = '') {
  const params = new URLSearchParams({ mode })
  if (filterId && filterId !== '0') params.append('filterId', filterId)
  try {
    const data = await apiFetch(`/Master/dropdown?${params}`)
    const items = data?.responseObj ?? []
    return [{ value: '', text: '--Select--' }, ...items]
  } catch (err) {
    console.error(`fetchDropdown(${mode}) failed:`, err.message)
    return [{ value: '', text: '--Select--' }]
  }
}

/** MT_MasterItem items — returns [{value, text}] */
export async function fetchMasterItems(itemType, filterId = '') {
  const params = new URLSearchParams({ itemType })
  if (filterId && filterId !== '0') params.append('filterId', filterId)
  try {
    const data = await apiFetch(`/Master/items?${params}`)
    const items = data?.responseObj ?? []
    return [{ value: '', text: '--Select--' }, ...items]
  } catch (err) {
    console.error(`fetchMasterItems(${itemType}) failed:`, err.message)
    return [{ value: '', text: '--Select--' }]
  }
}

/** ICD / CPT / DRG code search — type: 'ICD'|'CPT'|'DRG', returns [{cd, nm}] */
export async function codeSearch(type, q) {
  if (!q || !q.trim()) return []
  try {
    const params = new URLSearchParams({ type, q: q.trim() })
    const data = await apiFetch(`/Master/code-search?${params}`)
    return data?.responseObj ?? []
  } catch (err) {
    console.error(`codeSearch(${type}) failed:`, err.message)
    return []
  }
}

/** Fetch lead details for edit pre-population — returns LeadDetail or null */
export async function getLeadByClaimNo(claimNo) {
  try {
    const data = await apiFetch(`/Lead/${encodeURIComponent(claimNo)}`)
    return data?.responseObj ?? null
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/** One-shot bind for the Claim Submission page — Final Bill Amount, Treatment Info, Provider. */
export async function fetchClaimSubmissionBind(claimNo) {
  try {
    const data = await apiFetch(`/Lead/claim-submission-bind?claimNo=${encodeURIComponent(claimNo)}`)
    return data?.responseObj ?? null
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/** Open Exchange Rates proxy — returns the FROM→TO rate for the given date, or null if unavailable. */
export async function fetchExchangeRate(fromCurrency, toCurrency, date) {
  try {
    const params = new URLSearchParams({ fromCurrency, toCurrency, date })
    const data = await apiFetch(`/Lead/exchange-rate?${params}`)
    return data?.errorObj?.some(e => e.errorCode === 0) ? data.responseObj : null
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    return null
  }
}

/** Claim Submission — Invoice's live Service Fee auto-calc.
 * Returns { matched, fee, currencyCd, calculation, reason } or null on a hard failure. */
export async function fetchServiceCharge(claimNo, netAmt, providerCurrencyCd, date) {
  try {
    const params = new URLSearchParams({ claimNo, netAmt, providerCurrencyCd, date })
    const data = await apiFetch(`/Lead/service-charge?${params}`)
    return data?.errorObj?.some(e => e.errorCode === 0) ? data.responseObj : null
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    return null
  }
}

/** Claim Submission — Case Information section (Section 3). Saved to MT_CaseManage. */
export async function saveCaseInfo(payload) {
  try {
    const data = await apiFetch('/Lead/case-info-save', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    if (!data?.errorObj?.some(e => e.errorCode === 0)) {
      throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to save case information.')
    }
    return data
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/**
 * Claim Submission — Treatment Information section (Section 1). Fires the 3
 * independently reusable code-table saves (ICD, CPT, DRG) together so the
 * wizard step feels atomic, while each endpoint stays callable on its own
 * (e.g. by Lead Registration) without pulling in the others.
 * Room Type/LOS are captured here but persisted later, folded into the
 * Case Information save (Section 3) — both live on MT_CaseManage, so this
 * keeps that table to one update per Claim Submission run instead of two.
 */
export async function saveTreatmentInfo({ claimNo, icdCode, icdDesc, cptCode, cptDesc, drgCode, drgDesc }) {
  async function post(path, params) {
    const data = await apiFetch(`${path}?${new URLSearchParams(params)}`, { method: 'POST' })
    if (!data?.errorObj?.some(e => e.errorCode === 0)) {
      throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to save treatment information.')
    }
    return data
  }
  try {
    await Promise.all([
      post('/Lead/case-icd-save', { claimNo, icdCode, icdDesc }),
      post('/Lead/case-cpt-save', { claimNo, cptCode, cptDesc }),
      post('/Lead/case-drg-save', { claimNo, drgCode, drgDesc })
    ])
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/** Claim Submission — Invoice section (Section 2). Saved to MT_Invoice. Returns the generated/existing Invoice_No. */
export async function saveInvoice(payload) {
  try {
    const data = await apiFetch('/Lead/invoice-save', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    if (!data?.errorObj?.some(e => e.errorCode === 0)) {
      throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to save invoice.')
    }
    return data?.responseObj ?? null
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/** Claim Submission — "Save as Draft": generates the combined checklist PDF for preview
 * only (nothing uploaded/recorded server-side). Returns { pdfBase64, message } — message
 * carries a "could not include X (corrupted file)" note when a document had to be skipped. */
export async function saveClaimSubmissionDraft(payload) {
  try {
    const data = await apiFetch('/Lead/claim-submission-save-draft', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    if (!data?.errorObj?.some(e => e.errorCode === 0)) {
      throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to generate the combined PDF.')
    }
    return { pdfBase64: data?.responseObj ?? null, message: data?.errorObj?.[0]?.errorMessage || '' }
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/** Claim Submission — "View" popup HTML for a generated document (Invoice / Case Report). */
export async function fetchDocumentPreviewHtml(claimNo, docCode) {
  try {
    const data = await apiFetch(`/Lead/document-preview-html?claimNo=${encodeURIComponent(claimNo)}&docCode=${encodeURIComponent(docCode)}`)
    if (!data?.errorObj?.some(e => e.errorCode === 0)) {
      throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to load preview.')
    }
    return data?.responseObj ?? ''
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/** Claim Submission — final submit: generates + uploads the combined checklist PDF,
 * records it in MT_AppDocument, sets Claim_Submit_Flag on MT_CaseManage, and moves the
 * lead to status 329 (Claim Submitted). */
export async function submitClaim(payload) {
  try {
    const data = await apiFetch('/Lead/claim-submit', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    if (!data?.errorObj?.some(e => e.errorCode === 0)) {
      throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to submit claim.')
    }
    return data
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/**
 * Save (insert) or update a lead.
 * Caller must supply statusCd + statusRemarks — never hardcoded here or in the API.
 * isEdit=false → statusCd=301, statusRemarks="Lead Registered"
 * isEdit=true  → statusCd=302, statusRemarks="Lead Updated"
 * Returns { member_Id, claim_No }
 */
export async function saveLead(payload) {
  try {
    const data = await apiFetch('/Lead/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    return data?.responseObj ?? null
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/**
 * Upload ID document + medical reports for a saved lead.
 * idFile     — File | null
 * medicalFiles — File[]
 * Returns { uploaded: string[], errors: string[] }
 */
export async function uploadLeadDocuments(claimNo, memberId, idFile, medicalFiles = []) {
  const token = authUtils.getToken()
  const form = new FormData()
  form.append('claimNo',       claimNo)
  form.append('memberId',      memberId)
  // DocCd and DocNm supplied by the app — never hardcoded in the API
  form.append('idDocCd',       '303')
  form.append('idDocNm',       'Id Proof(Pan Card)')
  form.append('medicalDocCd',  '316')
  form.append('medicalDocNm',  'Medical Documents')
  if (idFile) form.append('idDocument', idFile)
  medicalFiles.forEach(f => form.append('medicalReports', f))

  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/upload-documents`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  })

  if (res.status === 401) {
    authUtils.clearSession()
    window.dispatchEvent(new CustomEvent('careai:logout'))
    throw new Error('UNAUTHORIZED')
  }

  if (!res.ok) throw new Error(`Upload failed — HTTP ${res.status}`)
  return res.json()
}

/**
 * Search leads by Member Name / Email Id / Reference No.
 * searchBy: "Name" | "Email_Id" | "Member_Id"
 * Returns [] on failure (read operation — no logout dispatch).
 */
export async function fetchLeadSearch(searchBy = 'Name', searchVal = '', statusGrp = '') {
  const params = new URLSearchParams({ searchBy, searchVal, statusGrp })
  try {
    const data = await apiFetch(`/Lead/search?${params}`)
    return data?.responseObj ?? []
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/**
 * Search members in MT_MemberRegistration.
 * filters: { name, emailId, mobileNo, nationalId } — any combination, all optional
 */
export async function searchMembers({ name = '', emailId = '', mobileNo = '', nationalId = '' } = {}) {
  const params = new URLSearchParams()
  if (name)       params.append('name',       name)
  if (emailId)    params.append('emailId',    emailId)
  if (mobileNo)   params.append('mobileNo',   mobileNo)
  if (nationalId) params.append('nationalId', nationalId)
  try {
    const data = await apiFetch(`/Lead/member-search?${params}`)
    return data?.responseObj ?? []
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/**
 * Fetch an uploaded document as a Blob (auth header is sent — token never in URL).
 * Caller should create an object URL and open it in a new tab.
 */
export async function fetchDocumentBlob(claimNo, fileName) {
  const token = authUtils.getToken()
  const url   = `${API_BASE}${VERSION_SEGMENT}/Lead/document?claimNo=${encodeURIComponent(claimNo)}&fileName=${encodeURIComponent(fileName)}`
  const res   = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.blob()
}

/**
 * Fetch query document checklist items (MT_MasterItem WHERE Item_Type='Query').
 * Returns [{value, text}] — no --Select-- entry (used as checklist, not dropdown).
 */
export async function fetchQueryItems() {
  try {
    const data = await apiFetch('/Master/items?itemType=Query')
    return data?.responseObj ?? []
  } catch (err) {
    console.error('fetchQueryItems failed:', err.message)
    return []
  }
}

/**
 * Submit lead query (selected documents + email recipients).
 * POST /Lead/query
 */
export async function submitLeadQuery(payload) {
  try {
    const data = await apiFetch('/Lead/query', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    return data
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/**
 * Flat list of all active providers with country + city for cascade dropdowns.
 * GET /Master/providers-with-location
 * Returns [{country_Cd, country_Nm, city_Cd, city_Nm, prv_Cd, prv_Nm, prv_Email}]
 */
export async function fetchProvidersWithLocation() {
  try {
    const data = await apiFetch('/Master/providers-with-location')
    return data?.responseObj ?? []
  } catch (err) {
    console.error('fetchProvidersWithLocation failed:', err.message)
    return []
  }
}

/**
 * Provider Estimate Request page — branches/doctors for the logged-in
 * Provider-portal user's own provider. Prv_Cd is resolved server-side from
 * the JWT, so no filter is passed here. Returns [{value, text}].
 */
export async function fetchMyBranches() {
  try {
    const data = await apiFetch('/Provider/my-branches')
    return data?.responseObj ?? []
  } catch (err) {
    console.error('fetchMyBranches failed:', err.message)
    return []
  }
}

export async function fetchMyDoctors() {
  try {
    const data = await apiFetch('/Provider/my-doctors')
    return data?.responseObj ?? []
  } catch (err) {
    console.error('fetchMyDoctors failed:', err.message)
    return []
  }
}

/**
 * Submit estimate request to selected providers.
 * POST /Estimate/submit
 */
export async function submitEstimateRequest(payload) {
  try {
    const data = await apiFetch('/Estimate/submit', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    return data
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/**
 * Get lead details by estimate token — works without login (email link) and with login (executive).
 * GET /Lead/estimate-req?token=xxx
 * Returns LeadEstimateReqDetail { IsTokenValid, IsExpired, RequestId, PrvCd, PrvNm, LeadAcceptance, DeclineReason, Lead }
 */
export async function getLeadByEstimateToken(token) {
  const url = `${API_BASE}${VERSION_SEGMENT}/Lead/estimate-req?token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  if (res.status === 204) return { isTokenValid: false }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data?.responseObj ?? { isTokenValid: false }
}

/**
 * Submit provider action (Accept=1 / Decline=2).
 * POST /Lead/estimate-req/action — no auth required.
 * payload: { token, claimNo, memberId, action, declineReason, statusCd, statusRemarks, caseManagerEmail }
 */
export async function submitProviderAction(payload) {
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/estimate-req/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Submit estimate details filled by provider (lead_estimate_cu).
 * POST /Lead/lead-estimate-cu — no auth required.
 * Marks token as used, updates status, sends email.
 */
export async function submitLeadEstimateCu(payload) {
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/lead-estimate-cu`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Upload doctor detail file (DocCd=305) — no auth required.
 * POST /Lead/upload-doctor-detail (multipart/form-data)
 */
export async function uploadDoctorDetail(claimNo, memberId, file) {
  const form = new FormData()
  form.append('claimNo',  claimNo)
  form.append('memberId', memberId)
  form.append('file',     file)
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/upload-doctor-detail`, {
    method: 'POST',
    body: form
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Expense lines for a specific estimate request (MT_EstimateExpense).
 * Returns [{ treatmentNm, expenseCd, expenseNm, cost, remarks, currency }]
 */
export async function fetchEstimateExpenses(requestNo) {
  try {
    const params = new URLSearchParams({ requestNo })
    const data = await apiFetch(`/Estimate/expenses?${params}`)
    return data?.responseObj ?? []
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    return []
  }
}

/**
 * List estimate requests for a claim.
 * mode: STATUS (all) | COMPARE (provider-submitted) | APPROVED | SHARED
 * Returns [EstimateRequestRow]
 */
export async function fetchEstimateRequests(claimNo, mode = 'STATUS') {
  try {
    const params = new URLSearchParams({ claimNo, mode })
    const data = await apiFetch(`/Estimate/requests?${params}`)
    return data?.responseObj ?? []
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/**
 * Perform an action on selected estimate requests.
 * payload: { mode, claimNo, memberId, requestNos[], statusCd, statusRemarks }
 * mode: APPROVE | SHARE
 */
export async function submitEstimateAction(payload) {
  try {
    const data = await apiFetch('/Estimate/action', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    return data
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/**
 * Treatment Plan PDF (event 127) — download only, no email sent.
 * Returns base64 PDF bytes for every provider on the claim with
 * IsApproved=1 AND IsShared=1.
 */
export async function fetchTreatmentPlanPdf({ claimNo, memberId, remarks }) {
  const data = await apiFetch('/Estimate/treatment-plan-pdf', {
    method: 'POST',
    body: JSON.stringify({ claimNo, memberId, remarks })
  })
  if (!data?.responseObj) throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to generate the treatment plan PDF.')
  return data.responseObj
}

// ── Lead Support (Team Lead) ─────────────────────────────────────────────────

export async function searchSupportRecords(claimNo, action) {
  const params = new URLSearchParams({ claimNo, action })
  const data = await apiFetch(`/Estimate/support/search?${params}`)
  if (!data?.errorObj?.some(e => e.errorCode === 0))
    throw new Error(data?.errorObj?.[0]?.errorMessage || 'No eligible records found.')
  return data.responseObj ?? []
}

export async function submitSupportAction(payload) {
  const data = await apiFetch('/Estimate/support/submit', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  if (!data?.errorObj?.some(e => e.errorCode === 0))
    throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to submit.')
  return data.responseObj
}

// mode: 'ICD' | 'CPT' | 'DRG' | 'ALL' — only the matching field pair(s) are saved
export async function updateEstimateCodes(payload) {
  const data = await apiFetch('/Estimate/update-codes', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  if (!data?.errorObj?.some(e => e.errorCode === 0))
    throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to save code.')
  return data.responseObj
}

/**
 * Authenticated — get the active estimate-acceptance token for a claimNo.
 * Used by portal executives to open the acceptance page on the member's behalf.
 * GET /Lead/estimate-acceptance-token?claimNo=xxx
 */
export async function fetchEstimateAcceptanceToken(claimNo) {
  try {
    const data = await apiFetch(`/Lead/estimate-acceptance-token?claimNo=${encodeURIComponent(claimNo)}`)
    return data?.responseObj ?? ''
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

/**
 * Get shared estimates for member acceptance page — public (no auth).
 * GET /Lead/estimate-acceptance?token=xxx
 * Returns EstimateAcceptanceDetail { isTokenValid, isExpired, isUsed, lead, sharedEstimates[] }
 */
export async function getEstimateAcceptance(token, claimNo = '') {
  const params = new URLSearchParams({ token })
  if (claimNo) params.append('claimNo', claimNo)
  const url = `${API_BASE}${VERSION_SEGMENT}/Lead/estimate-acceptance?${params}`
  const res = await fetch(url)
  if (res.status === 204) return { isTokenValid: false }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data?.responseObj ?? { isTokenValid: false }
}

/**
 * Member accepts one provider's estimate — public (no auth).
 * POST /Lead/estimate-acceptance/accept
 * payload: { token, claimNo, memberId, requestNo, prvCd, statusCd, statusRemarks }
 */
export async function submitEstimateAccept(payload) {
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/estimate-acceptance/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Add a single traveller row to MT_LeadTravel — called per Add-click.
 * POST /Lead/travel-info/add-traveller — no auth.
 * Returns GenericResponse<int> where ResponseObj = new row Id.
 */
export async function addTraveller(payload) {
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/travel-info/add-traveller`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    // Try to read API error message from body
    try {
      const body = await res.json()
      const msg  = body?.errorObj?.[0]?.errorMessage || body?.title || `HTTP ${res.status}`
      throw new Error(msg)
    } catch (e) {
      throw new Error(e.message || `HTTP ${res.status}`)
    }
  }
  return res.json()
}

/**
 * Soft-delete a traveller row (Actv_Ind=0).
 * DELETE /Lead/travel-info/traveller/{id} — no auth.
 */
export async function deleteTraveller(id) {
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/travel-info/traveller/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Fetch existing travellers for a claim on page reload.
 * GET /Lead/travel-info/travellers?claimNo=xxx&token=xxx — no auth.
 */
export async function fetchTravellers(claimNo, token) {
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/travel-info/travellers?claimNo=${encodeURIComponent(claimNo)}&token=${encodeURIComponent(token)}`)
  if (!res.ok) return []
  return res.json()
}

/**
 * Public document upload — no auth required.
 * Used by TravelInfo for GOP (docCd=310) and Passport (docCd=322).
 * Saves to MT_CaseDocument. Returns { uploaded, errors }.
 * POST /Lead/upload-document
 */
export async function uploadPublicDocument(claimNo, memberId, docCd, docNm, file) {
  const form = new FormData()
  form.append('claimNo',  claimNo)
  form.append('memberId', memberId)
  form.append('docCd',    String(docCd))
  form.append('docNm',    docNm)
  form.append('file',     file)
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/upload-document`, {
    method: 'POST',
    body: form
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Member submits travel info — public (no auth). Marks token IsUsed=1.
 * POST /Lead/travel-info
 * payload: { token, claimNo, memberId, requestNo, prvCd, statusCd, statusRemarks, gopUrl }
 */
export async function submitTravelInfo(payload) {
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/travel-info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Public — load member document upload page (validates token, returns patient + query items).
 * GET /Lead/member-documents?claimNo=xxx&token=xxx
 */
export async function getMemberDocPage(claimNo, token) {
  const params = new URLSearchParams({ claimNo, token })
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/member-documents?${params}`)
  if (res.status === 204) return { isTokenValid: false }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data?.responseObj ?? { isTokenValid: false }
}

/**
 * Public — upload a single query document.
 * POST /Lead/member-documents/upload (multipart)
 */
export async function uploadMemberDoc(claimNo, memberId, queryCd, queryText, file) {
  const form = new FormData()
  form.append('claimNo',   claimNo)
  form.append('memberId',  memberId)
  form.append('queryCd',   queryCd)
  form.append('queryText', queryText)
  form.append('file',      file)
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/member-documents/upload`, {
    method: 'POST',
    body: form
  })
  if (!res.ok) {
    try {
      const body = await res.json()
      throw new Error(body?.errorObj?.[0]?.errorMessage || `HTTP ${res.status}`)
    } catch (e) { throw new Error(e.message || `HTTP ${res.status}`) }
  }
  return res.json()
}

/**
 * Public — finalise document submission (status 304, email 112).
 * POST /Lead/member-documents/submit
 */
export async function submitMemberDocs(payload) {
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/member-documents/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Submit a new appointment request (Mode C) — status 319, email 117.
 * POST /Appointment/submit
 */
export async function submitAppointment(payload) {
  const data = await apiFetch('/Appointment/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  return data
}

/**
 * Load existing appointment for claim + provider (used by confirm page).
 * GET /Appointment?claimNo=xxx&prvCd=xxx
 */
export async function getAppointment(claimNo, prvCd) {
  const params = new URLSearchParams({ claimNo, prvCd })
  const data = await apiFetch(`/Appointment?${params}`)
  return data?.responseObj ?? null
}

/**
 * Confirm an existing appointment (Mode AC) — status 320, email 118.
 * POST /Appointment/confirm
 */
export async function confirmAppointment(payload) {
  const data = await apiFetch('/Appointment/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  return data
}

// ── Provider Module ─────────────────────────────────────────────────────────

/** Search providers. searchBy: Prv_Nm | Prv_Cd | Country | City */
export async function searchProviders(searchBy = 'Prv_Nm', searchVal = '') {
  const params = new URLSearchParams({ searchBy, searchVal })
  const data = await apiFetch(`/Provider/search?${params}`)
  return data?.responseObj ?? []
}

/** Get full provider detail by prvCd — for edit form. */
export async function getProvider(prvCd) {
  const params = new URLSearchParams({ prvCd })
  const data = await apiFetch(`/Provider?${params}`)
  return data?.responseObj ?? null
}

/** Save (insert or update) a provider. payload: ProviderSaveRequest */
export async function saveProvider(payload) {
  const token = authUtils.getToken()
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Provider/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  })
  if (res.status === 401) { authUtils.clearSession(); throw new Error('UNAUTHORIZED') }
  const data = await res.json()
  // Surface the API error message so the form can show it
  if (!res.ok) {
    const msg = data?.errorObj?.[0]?.errorMessage || `API error ${res.status}`
    throw new Error(msg)
  }
  return data?.responseObj ?? null
}

/** Get uploaded documents for a provider. */
export async function getProviderDocuments(prvCd) {
  const params = new URLSearchParams({ prvCd })
  const data = await apiFetch(`/Provider/documents?${params}`)
  return data?.responseObj ?? []
}

/** Upload a provider document (multipart). Returns saved document row. */
export async function saveProviderDocument(prvCd, docTypeId, docTypeNm, validFrom, validUpto, file) {
  const token = authUtils.getToken()
  const form = new FormData()
  form.append('prvCd',      prvCd)
  form.append('docTypeId',  docTypeId)
  form.append('docTypeNm',  docTypeNm)
  form.append('validFrom',  validFrom)
  form.append('validUpto',  validUpto)
  form.append('file',       file)
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Provider/documents`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  })
  if (res.status === 401) { authUtils.clearSession(); throw new Error('UNAUTHORIZED') }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data?.responseObj ?? null
}

/** Stream a provider document from blob — opens in new browser tab. */
export async function openProviderDocument(filePath) {
  const token = authUtils.getToken()
  const params = new URLSearchParams({ filePath })
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Provider/document?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (res.status === 401) { authUtils.clearSession(); throw new Error('UNAUTHORIZED') }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

/** Soft-delete a provider document. */
export async function deleteProviderDocument(id) {
  const data = await apiFetch(`/Provider/documents/${id}`, { method: 'DELETE' })
  return data
}

/** Get MOU/Contract files for a company — for ProviderAction page. */
export async function getCompanyAgreements(compCd) {
  const params = new URLSearchParams({ compCd })
  const data = await apiFetch(`/Provider/agreements?${params}`)
  return data?.responseObj ?? []
}

/** Send MOU/Contract email to provider — status 102, email event 119. */
export async function sendProviderContract(payload) {
  const data = await apiFetch('/Provider/send-contract', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  return data
}

/** Get status audit log for a provider (Section 4 grid). */
export async function getProviderStatusLog(prvCd) {
  const params = new URLSearchParams({ prvCd })
  const data = await apiFetch(`/Provider/status-log?${params}`)
  return data?.responseObj ?? []
}

/** Update provider status with reason from Section 4 — writes to MT_Provider + MT_ProviderStatusLog. */
export async function updateProviderStatus(prvCd, statusCd, statusRemarks) {
  const data = await apiFetch('/Provider/update-status', {
    method: 'POST',
    body: JSON.stringify({ prvCd, statusCd: Number(statusCd), statusRemarks })
  })
  return data
}

// ── End Provider Module ──────────────────────────────────────────────────────

// ── Accounts Module — Insurer Payment ────────────────────────────────────────

/** Add a new insurer payment voucher. Mode is always 'A' from this call. */
export async function saveInsurerPayment(payload) {
  const data = await apiFetch('/Accounts/insurer-payment', {
    method: 'POST',
    body: JSON.stringify({ mode: 'A', ...payload })
  })
  return data?.responseObj ?? ''
}

/** Save reconciliation lines against a payment voucher. Mode is always 'I' from this call. */
export async function saveReconciliation(pmtNo, lines) {
  const data = await apiFetch('/Accounts/insurer-payment', {
    method: 'POST',
    body: JSON.stringify({ mode: 'I', pmtNo, lines })
  })
  return data?.responseObj ?? ''
}

/** Payment Status grid + summary totals. mode is always 'G' from this call. */
export async function searchInsurerPayments({ pmtNo = '', insurerCd = '', status = '' } = {}) {
  const params = new URLSearchParams({ mode: 'G', pmtNo, insurerCd, status })
  const data = await apiFetch(`/Accounts/insurer-payment?${params}`)
  return data?.responseObj ?? { rows: [], totalPending: 0, totalReceived: 0 }
}

/** Reconciliation candidates (pending invoices, status 100/101, scoped to the voucher's insurer). mode is always 'R'. */
export async function fetchReconciliationCandidates(insurerCd) {
  const params = new URLSearchParams({ mode: 'R', insurerCd })
  const data = await apiFetch(`/Accounts/insurer-payment?${params}`)
  return data?.responseObj ?? []
}

/** Reconciliation history popup (from MT_PaymentRecon). mode is always 'H'.
 *  Pass invoiceNo for the Previously Received popup, or pmtNo for the Amount Adjusted popup. */
export async function fetchPaymentReconHistory({ invoiceNo = '', pmtNo = '' } = {}) {
  const params = new URLSearchParams({ mode: 'H', invoiceNo, pmtNo })
  const data = await apiFetch(`/Accounts/insurer-payment?${params}`)
  return data?.responseObj ?? []
}

/** Invoice-wise drill-down behind the Total Pending / Total Received summary tiles.
 *  type: 'PENDING' | 'RECEIVED'. mode is always 'D'. */
export async function fetchInvoiceDetails({ insurerCd = '', type = '' } = {}) {
  const params = new URLSearchParams({ mode: 'D', insurerCd, type })
  const data = await apiFetch(`/Accounts/insurer-payment?${params}`)
  return data?.responseObj ?? []
}

// ── End Accounts Module ──────────────────────────────────────────────────────

// ── Reports Module — generic MIS page ────────────────────────────────────────

/**
 * One call for every MIS report — the SP decides the title, which filters
 * apply, and the columns, so adding a new report needs no change here.
 * Returns { meta: {reportTitle, showDateFilter, showClaimNoFilter, showMemberIdFilter}, rows: [...] }
 */
export async function fetchMisReport(reportCode, { fromDt = '', toDt = '', claimNo = '', memberId = '' } = {}) {
  const params = new URLSearchParams({ reportCode, fromDt, toDt, claimNo, memberId })
  const data = await apiFetch(`/Reports/mis?${params}`)
  if (!data?.errorObj?.some(e => e.errorCode === 0))
    throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to load report.')
  return data?.responseObj ?? { meta: {}, rows: [] }
}

/** Downloads the same report (same filters) as an .xlsx file. */
export async function downloadMisReport(reportCode, { fromDt = '', toDt = '', claimNo = '', memberId = '' } = {}) {
  const token = authUtils.getToken()
  const params = new URLSearchParams({ reportCode, fromDt, toDt, claimNo, memberId })
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Reports/mis/export?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${reportCode}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

/**
 * Dashboard MIS page — ONE call loads everything (meta + tiles + every
 * detail dataset). Tile clicks/downloads filter this cached payload
 * client-side; no second query runs just to show the page.
 * Returns { meta, tiles: [...], datasets: [[...], [...], ...] }
 */
export async function fetchMisDashboard(reportCode, { fromDt = '', toDt = '', claimNo = '', memberId = '' } = {}) {
  const params = new URLSearchParams({ reportCode, fromDt, toDt, claimNo, memberId })
  const data = await apiFetch(`/Reports/dashboard?${params}`)
  if (!data?.errorObj?.some(e => e.errorCode === 0))
    throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to load dashboard.')
  return data?.responseObj ?? { meta: {}, tiles: [], datasets: [] }
}

/** Downloads one tile's rows (dataset filtered by filterColumn=filterValue) as .xlsx. */
export async function downloadMisDashboardTile(reportCode, { datasetIndex = 0, filterColumn = '', filterValue = '', fromDt = '', toDt = '', claimNo = '', memberId = '' } = {}) {
  const token = authUtils.getToken()
  const params = new URLSearchParams({ reportCode, datasetIndex, filterColumn, filterValue, fromDt, toDt, claimNo, memberId })
  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Reports/dashboard/export?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${reportCode}_${filterValue || 'All'}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

// ── End Reports Module ────────────────────────────────────────────────────────

/** Calling codes with flag data */
export async function fetchCallingCodes() {
  try {
    const data = await apiFetch('/Master/callingcodes')
    return data?.responseObj ?? []
  } catch (err) {
    console.error('fetchCallingCodes failed:', err.message)
    return []
  }
}

// ── Page Management Module ───────────────────────────────────────────────────

/**
 * List all user groups.
 * GET /Admin/groups
 * Returns [{ id, groupNm, groupDesc, actvInd, crtdDt }]
 */
export async function fetchGroups(mode = 'B', pageLevel = 0, parentId = 0) {
  const params = new URLSearchParams({ mode, pageLevel, parentId })
  try {
    const data = await apiFetch(`/Admin/groups?${params}`)
    return data?.responseObj ?? []
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

export async function fetchPages(mode, parentId = null) {
  const params = new URLSearchParams({ mode })
  if (parentId != null) params.append('parentId', parentId)
  try {
    const data = await apiFetch(`/Admin/pages?${params}`)
    return data?.responseObj ?? []
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

export async function fetchPageDetail(mode, id) {
  try {
    const data = await apiFetch(`/Admin/pages/${id}/detail?mode=${mode}`)
    return data?.responseObj ?? null
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

export async function savePage(payload) {
  try {
    return await apiFetch('/Admin/pages/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

export async function fetchPageTree() {
  try {
    const data = await apiFetch('/Admin/page-tree')
    return data?.responseObj ?? []
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

export async function fetchGroupDetail(id) {
  try {
    const data = await apiFetch(`/Admin/groups/${id}/detail`)
    return data?.responseObj ?? null
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

export async function saveGroup(payload) {
  try {
    const data = await apiFetch('/Admin/groups/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    return data
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

export async function fetchPageSections(pageKey) {
  try {
    const data = await apiFetch(`/Admin/page-sections?pageKey=${encodeURIComponent(pageKey)}`)
    return data?.responseObj ?? []
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

export async function fetchSectionRights(pageKey) {
  try {
    const data = await apiFetch(`/Lead/section-rights?pageKey=${encodeURIComponent(pageKey)}`)
    return data?.responseObj ?? {}
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

const MENU_CACHE_KEY = 'careai_menu'

/**
 * Fetch the role-based menu tree for the logged-in user.
 * GET /Admin/user-menu
 * Returns [{section, pageId, iconCss, items:[{pageId,pageTitle,pageUrl,iconCss,hasChildren,children:[...]}]}]
 * Result is cached in localStorage — cleared on logout.
 */
export async function getUserMenu() {
  const cached = localStorage.getItem(MENU_CACHE_KEY)
  if (cached) {
    try { return JSON.parse(cached) } catch { /* ignore corrupt cache */ }
  }
  try {
    const data = await apiFetch('/Admin/user-menu')
    const menu = data?.responseObj ?? []
    localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(menu))
    return menu
  } catch (err) {
    console.error('getUserMenu failed:', err.message)
    return []
  }
}

export function clearMenuCache() {
  localStorage.removeItem(MENU_CACHE_KEY)
}

// ── Communication Log ─────────────────────────────────────────────────────────

export async function fetchCommunicationLog(claimNo) {
  const data = await apiFetch(`/Lead/communication-log?claimNo=${encodeURIComponent(claimNo)}`)
  return data?.responseObj ?? []
}

export async function resendCommunication(id) {
  return apiFetch('/Lead/communication-log/resend', {
    method: 'POST',
    body: JSON.stringify({ id })
  })
}

// ── Reset Lead to Registration ───────────────────────────────────────────────

export async function resetLeadToRegistration(payload) {
  return apiFetch('/Lead/reset-to-registration', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

// ── GOP Data ──────────────────────────────────────────────────────────────────

export async function fetchGopData(claimNo) {
  const data = await apiFetch(`/Lead/gop-data?claimNo=${encodeURIComponent(claimNo)}`)
  return data?.responseObj ?? null
}

export async function fetchGopExpenses(claimNo) {
  const data = await apiFetch(`/Lead/gop-expenses?claimNo=${encodeURIComponent(claimNo)}`)
  return data?.responseObj ?? []
}

export async function fetchGopRecord(claimNo) {
  const data = await apiFetch(`/Lead/gop-record?claimNo=${encodeURIComponent(claimNo)}`)
  return data?.responseObj ?? null
}

export async function saveGop(payload) {
  const data = await apiFetch('/Lead/gop-save', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  if (!data?.errorObj?.some(e => e.errorCode === 0))
    throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to generate GOP')
  return data.responseObj
}

/** payload: { claimNo, memberId, prvCd, notifyChannel } — notifyChannel: "Email" | "WhatsApp" | "Both" */
export async function sendGopToProvider(payload) {
  const data = await apiFetch('/Lead/gop-send', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  if (!data?.errorObj?.some(e => e.errorCode === 0))
    throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to send GOP')
  return data.responseObj
}

// ── Patient Discharge document workflow ─────────────────────────────────────

/**
 * GET /Lead/discharge?claimNo=xxx — header + docs + checklist in one call.
 * Used to prefill both a fresh visit and Edit mode.
 * Returns { header: {actionMode, dischargeDt, remarks, currencyCd, hospitalAmt, copayment, deductible, finalAmt} | null,
 *           docs: [{docCd, docNm, status, fileNm}], checklistCodes: string[] }
 */
export async function fetchDischarge(claimNo) {
  const data = await apiFetch(`/Lead/discharge?claimNo=${encodeURIComponent(claimNo)}`)
  return data?.responseObj ?? { header: null, docs: [], checklistCodes: [] }
}

/**
 * Single Save for the Patient Discharge div — header (date/remarks/currency/amounts)
 * + per-document received/requested state (+ optional uploaded files) + checklist
 * + status 324/325/326. Same endpoint for the first save and every later edit.
 * docs: [{ docCd, docNm, status: 'RECEIVED'|'REQUESTED', file?: File }]
 * checklist: [{ itemCd, itemNm }] — checked items only
 */
export async function saveDischarge({ claimNo, memberId, prvCd, estimatedDod, gopRemarks, currencyCd, hospitalAmt, copayment, deductible, finalAmt, checklist, actionMode, docs }) {
  const token = authUtils.getToken()
  const form = new FormData()
  form.append('claimNo',      claimNo)
  form.append('memberId',     memberId)
  form.append('prvCd',        prvCd ?? '')
  form.append('estimatedDod', estimatedDod ?? '')
  form.append('gopRemarks',   gopRemarks ?? '')
  form.append('currencyCd',   currencyCd ?? '')
  form.append('hospitalAmt',  hospitalAmt ?? '')
  form.append('copayment',    copayment ?? '')
  form.append('deductible',   deductible ?? '')
  form.append('finalAmt',     finalAmt ?? '')
  form.append('actionMode',   actionMode ?? '')
  docs.forEach((doc, i) => {
    form.append(`Docs[${i}].DocCd`, String(doc.docCd))
    form.append(`Docs[${i}].DocNm`, doc.docNm)
    form.append(`Docs[${i}].Status`, doc.status)
    if (doc.file) form.append(`Docs[${i}].File`, doc.file)
  })
  checklist.forEach((item, i) => {
    form.append(`Checklist[${i}].ItemCd`, item.itemCd)
    form.append(`Checklist[${i}].ItemNm`, item.itemNm)
  })

  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/discharge-save`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  })
  if (res.status === 401) { authUtils.clearSession(); throw new Error('UNAUTHORIZED') }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const modelErrors = data?.errors
      ? Object.entries(data.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
      : ''
    throw new Error(modelErrors || data?.errorObj?.[0]?.errorMessage || data?.title || `Failed to save discharge details (HTTP ${res.status})`)
  }
  if (!data?.errorObj?.some(e => e.errorCode === 0))
    throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to save discharge details.')
  return data.responseObj
}

/**
 * Patient Discharge Approval — promotes Approve-checked docs into MT_AppDocument,
 * records final approved amounts, sets status 327. POST /Lead/discharge-approve.
 * docs: [{ docCd, docNm, approve: bool, file?: File }]
 */
export async function saveDischargeApproval({ claimNo, memberId, appAmtProvider, appCopayAmt, appDedAmt, appNetAmtProvider, currencyCd, docs }) {
  const token = authUtils.getToken()
  const form = new FormData()
  form.append('claimNo', claimNo)
  form.append('memberId', memberId)
  form.append('appAmtProvider', appAmtProvider ?? '')
  form.append('appCopayAmt', appCopayAmt ?? '')
  form.append('appDedAmt', appDedAmt ?? '')
  form.append('appNetAmtProvider', appNetAmtProvider ?? '')
  form.append('currencyCd', currencyCd ?? '')
  docs.forEach((doc, i) => {
    form.append(`Docs[${i}].DocCd`, String(doc.docCd))
    form.append(`Docs[${i}].DocNm`, doc.docNm)
    form.append(`Docs[${i}].Approve`, String(!!doc.approve))
    if (doc.file) form.append(`Docs[${i}].File`, doc.file)
  })

  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/discharge-approve`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  })
  if (res.status === 401) { authUtils.clearSession(); throw new Error('UNAUTHORIZED') }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const modelErrors = data?.errors
      ? Object.entries(data.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
      : ''
    throw new Error(modelErrors || data?.errorObj?.[0]?.errorMessage || data?.title || `Failed to save discharge approval (HTTP ${res.status})`)
  }
  if (!data?.errorObj?.some(e => e.errorCode === 0))
    throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to save discharge approval.')
  return data.responseObj
}

// ── Visa Invite ───────────────────────────────────────────────────────────────

export async function fetchVisaInvite(claimNo) {
  const data = await apiFetch(`/Lead/visa-invite?claimNo=${encodeURIComponent(claimNo)}`)
  if (!data?.errorObj?.some(e => e.errorCode === 0))
    throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to load Visa Invite')
  return data?.responseObj ?? ''
}

// ── Medical Bulletin ─────────────────────────────────────────────────────────

export async function fetchMedicalBulletins(claimNo) {
  const data = await apiFetch(`/Lead/medical-bulletins?claimNo=${encodeURIComponent(claimNo)}`)
  return data?.responseObj ?? []
}

export async function saveMedicalBulletin(payload) {
  const data = await apiFetch('/Lead/medical-bulletin/save', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  if (!data?.errorObj?.some(e => e.errorCode === 0))
    throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to save medical bulletin')
  return data.responseObj
}

// ── Email Event ───────────────────────────────────────────────────────────────

export async function emailEventApi(payload) {
  const data = await apiFetch('/Master/email-event', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  return data?.responseObj ?? null
}

// ── Case Status ──────────────────────────────────────────────────────────────

export async function caseStatusApi(payload) {
  const data = await apiFetch('/Master/case-status', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  return data?.responseObj ?? null
}

// ── Service Charge Slab ──────────────────────────────────────────────────────

export async function serviceChargeSlabApi(payload) {
  const data = await apiFetch('/Master/service-charge-slab', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  return data?.responseObj ?? null
}

// ── Document Master ──────────────────────────────────────────────────────────

export async function documentApi(payload) {
  const data = await apiFetch('/Master/document', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  return data?.responseObj ?? null
}

// ── Master Item ───────────────────────────────────────────────────────────────

export async function masterItemApi(payload) {
  const data = await apiFetch('/Master/master-item', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  return data?.responseObj ?? null
}

// ── Referral Invoice (case-bill-referral page) ───────────────────────────────

export async function fetchReferralInvoiceList({ hospitalNm = '', fromDt = '', uptoDt = '' } = {}) {
  const params = new URLSearchParams({ mode: 'L', hospitalNm, fromDt, uptoDt })
  const data = await apiFetch(`/Accounts/referral-invoice?${params}`)
  return data?.responseObj ?? []
}

export async function fetchReferralInvoiceCaseGrid(prvCd, fromDt, uptoDt, invoiceNo = '') {
  const params = new URLSearchParams({ mode: 'C', prvCd, fromDt, uptoDt, invoiceNo })
  const data = await apiFetch(`/Accounts/referral-invoice?${params}`)
  return data?.responseObj ?? null
}

export async function saveReferralInvoice(payload) {
  const data = await apiFetch('/Accounts/referral-invoice', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  return data?.responseObj ?? null
}

/** mode=H — every saved referral invoice header (Draft or Generated, any provider, or one provider via prvCd). */
export async function fetchReferralInvoiceHeaderList({ status = '', hospitalNm = '', fromDt = '', uptoDt = '', prvCd = '' } = {}) {
  const params = new URLSearchParams({ mode: 'H', status, hospitalNm, fromDt, uptoDt, prvCd })
  const data = await apiFetch(`/Accounts/referral-invoice?${params}`)
  return data?.responseObj ?? []
}

/** mode=V — one saved header (any status) + its cases/lines, by Id. */
export async function fetchReferralInvoiceDetail(id) {
  const params = new URLSearchParams({ mode: 'V', id })
  const data = await apiFetch(`/Accounts/referral-invoice?${params}`)
  return data?.responseObj ?? null
}

/** mode=D — Referral Invoice Dashboard ("Billing Run") page: summary tiles + provider grid, or one provider via prvCd. */
export async function fetchReferralInvoiceDashboard({ fromDt = '', uptoDt = '', prvCd = '' } = {}) {
  const params = new URLSearchParams({ mode: 'D', fromDt, uptoDt, prvCd })
  const data = await apiFetch(`/Accounts/referral-invoice?${params}`)
  return data?.responseObj ?? null
}

// ── Case Notes ───────────────────────────────────────────────────────────────

export async function fetchCaseNotes(claimNo) {
  const data = await apiFetch(`/Lead/case-notes?claimNo=${encodeURIComponent(claimNo)}`)
  return data?.responseObj ?? []
}

export async function saveCaseNote(payload) {
  return apiFetch('/Lead/case-notes/save', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export async function fetchCaseStatuses() {
  const data = await apiFetch('/Master/case-statuses')
  return data?.responseObj ?? []
}

// "Not Closed" reason cascade — Sub Category 1 (By Insurance/Member/Prosepra)
// and Sub Category 2 (specific reason, value = Reason_Cd saved on the note).
export async function fetchNotClosedSub1() {
  return fetchDropdown('ddlNotClosedSub1')
}

export async function fetchNotClosedSub2(sub1Cd) {
  return fetchDropdown('ddlNotClosedSub2', sub1Cd)
}

// ── Case Documents ────────────────────────────────────────────────────────────

export async function fetchCaseDocuments(claimNo) {
  try {
    const data = await apiFetch(`/Lead/case-documents?claimNo=${encodeURIComponent(claimNo)}`)
    return data?.responseObj ?? []
  } catch (err) {
    console.error('fetchCaseDocuments failed:', err.message)
    return []
  }
}

export async function fetchCaseDocTypes() {
  try {
    const data = await apiFetch('/Master/dropdown?mode=ddlcasedoctype')
    return data?.responseObj ?? []
  } catch {
    return []
  }
}

export async function uploadCaseDocument(claimNo, memberId, docCd, docNm, file) {
  const token = authUtils.getToken()
  const form = new FormData()
  form.append('claimNo',   claimNo)
  form.append('memberId',  memberId)
  form.append('idDocCd',   String(docCd))
  form.append('idDocNm',   docNm)
  form.append('idDocument', file)

  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Lead/upload-documents`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  })

  if (res.status === 401) {
    authUtils.clearSession()
    window.dispatchEvent(new CustomEvent('careai:logout'))
    throw new Error('UNAUTHORIZED')
  }

  if (!res.ok) throw new Error(`Upload failed — HTTP ${res.status}`)
  return res.json()
}

// ── Document Module (unified — MT_AppDocument) ───────────────────────────────

/**
 * Upload a document for any module (LEAD | PROVIDER | AGENT).
 * auth=true  → sends Bearer token (authenticated flows)
 * auth=false → no token (public forms: member, provider estimate, travel)
 * POST /Document/upload
 */
export async function uploadDocument({ moduleCd, referenceCd, memberId = '', docTypeCd, docTypeNm, validFrom = '', validUpto = '', requestNo = '', file, auth = true }) {
  const token = authUtils.getToken()
  const form  = new FormData()
  form.append('moduleCd',    moduleCd)
  form.append('referenceCd', referenceCd)
  form.append('memberId',    String(memberId ?? ''))
  form.append('docTypeCd',   String(docTypeCd))
  form.append('docTypeNm',   docTypeNm)
  if (validFrom)   form.append('validFrom',  validFrom)
  if (validUpto)   form.append('validUpto',  validUpto)
  if (requestNo)   form.append('requestNo',  requestNo)
  form.append('file',        file)

  const headers = {}
  if (auth && token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${VERSION_SEGMENT}/Document/upload`, {
    method: 'POST',
    headers,
    body: form
  })

  if (res.status === 401) {
    authUtils.clearSession()
    window.dispatchEvent(new CustomEvent('careai:logout'))
    throw new Error('UNAUTHORIZED')
  }
  if (!res.ok) {
    let msg = `Upload failed — HTTP ${res.status}`
    try { const b = await res.json(); msg = b?.error || msg } catch { /* ignore */ }
    throw new Error(msg)
  }
  return res.json()
}

/**
 * Fetch uploaded documents for a module + reference.
 * GET /Document/list?moduleCd=&referenceCd=
 */
export async function fetchDocuments(moduleCd, referenceCd) {
  try {
    const params = new URLSearchParams({ moduleCd, referenceCd })
    const data   = await apiFetch(`/Document/list?${params}`)
    return Array.isArray(data) ? data : (Array.isArray(data?.responseObj) ? data.responseObj : [])
  } catch {
    return []
  }
}

/**
 * Stream a document by Id and open it in a new browser tab.
 * GET /Document?id=123
 */
export async function openDocument(id) {
  const token = authUtils.getToken()
  const res   = await fetch(`${API_BASE}${VERSION_SEGMENT}/Document?id=${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

/**
 * Soft-delete a document (Actv_Ind=0).
 * DELETE /Document/{id}
 */
export async function deleteDocument(id) {
  const data = await apiFetch(`/Document/${id}`, { method: 'DELETE' })
  return data
}

// ── Agent Module ─────────────────────────────────────────────────────────────

/** Save agent — mode I (insert) or U (update). Returns { agentCd } on success. */
export async function saveAgent(payload) {
  const data = await apiFetch('/Master/agent', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  const errorCode = data?.errorObj?.[0]?.errorCode
  if (errorCode !== 0) {
    throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to save agent.')
  }
  return data?.responseObj
}

/**
 * Fetch agents — POST /Master/agent mode R.
 * All filter params are optional. Pass none to get all agents.
 * Pass { agentCd } to load a single agent for edit forms.
 */
export async function fetchAgents({ agentCd = '', agentNm = '', email = '', mobile = '', agentType = '' } = {}) {
  try {
    const data = await apiFetch('/Master/agent', {
      method: 'POST',
      body: JSON.stringify({ mode: 'R', agentCd, agentNm, email, mobile, agentType })
    })
    return data?.responseObj?.agents ?? []
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') window.dispatchEvent(new CustomEvent('careai:logout'))
    throw err
  }
}

// ── Insurer Module ────────────────────────────────────────────────────────────

/** Fetch insurers — GET /Master/insurer. All params optional. */
export async function fetchInsurers({ insurerCd = '', insurerNm = '', prefixCode = '', email = '' } = {}) {
  const params = new URLSearchParams()
  if (insurerCd)  params.set('insurerCd',  insurerCd)
  if (insurerNm)  params.set('insurerNm',  insurerNm)
  if (prefixCode) params.set('prefixCode', prefixCode)
  if (email)      params.set('email',      email)
  const qs = params.toString()
  const data = await apiFetch(`/Master/insurer${qs ? '?' + qs : ''}`)
  const errorCode = data?.errorObj?.[0]?.errorCode
  if (errorCode !== 0 && errorCode !== 1) throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to fetch insurers.')
  return data?.responseObj?.insurers ?? []
}

/** Save insurer — mode I (insert) or U (update). Returns { insurerCd } on success. */
export async function saveInsurer(payload) {
  const data = await apiFetch('/Master/insurer', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  const errorCode = data?.errorObj?.[0]?.errorCode
  if (errorCode !== 0) throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to save insurer.')
  return data?.responseObj
}

// ── Employees ─────────────────────────────────────────────────────────────────

export async function fetchEmployees() {
  try {
    const data = await apiFetch('/Admin/employees')
    return data?.responseObj ?? []
  } catch {
    return []
  }
}

export async function fetchEmployeeDetail(id, employeeCd = '') {
  const params = new URLSearchParams()
  if (employeeCd) params.append('employeeCd', employeeCd)
  const query = params.toString() ? `?${params}` : ''
  const data = await apiFetch(`/Admin/employees/${id}${query}`)
  if (!data?.responseObj) {
    const msg = data?.errorObj?.[0]?.errorMessage || 'Employee not found'
    throw new Error(msg)
  }
  return data.responseObj
}

export async function saveEmployee(payload) {
  const data = await apiFetch('/Admin/employees/save', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  const errorCode = data?.errorObj?.[0]?.errorCode
  if (errorCode !== 0) {
    throw new Error(data?.errorObj?.[0]?.errorMessage || 'Failed to save employee')
  }
  return data
}
