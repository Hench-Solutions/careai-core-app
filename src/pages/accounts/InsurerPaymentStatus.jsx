import { useState, useEffect, useMemo, Fragment } from 'react'
import { useNavigate, useBlocker } from 'react-router-dom'
import { fetchDropdown, fetchMasterItems, saveInsurerPayment, searchInsurerPayments, fetchReconciliationCandidates, fetchPaymentReconHistory, fetchInvoiceDetails, saveReconciliation } from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'

const BLANK_FORM = { pmtDt: '', pmtAmt: '', currencyCd: '', bankNm: '', pmtRefNo: '', remarks: '' }

export default function InsurerPaymentStatus() {
  const navigate = useNavigate()
  const [ddlInsurer, setDdlInsurer] = useState([{ value: '', text: '--Select--' }])
  const [ddlBank, setDdlBank] = useState([{ value: '', text: '--Select--' }])
  const [ddlStatus, setDdlStatus] = useState([{ value: '', text: '--All--' }])
  const [ddlCurrency, setDdlCurrency] = useState([{ value: '', text: '--Select--' }])

  const [filterInsurer, setFilterInsurer] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [rows, setRows] = useState([])
  const [totalPending, setTotalPending] = useState(0)
  const [totalReceived, setTotalReceived] = useState(0)
  const [totalsCurrencyCd, setTotalsCurrencyCd] = useState('')
  const [loading, setLoading] = useState(false)

  // "Dirty" once the user has picked an Insurer and run a search — leaving the
  // page from this point on (in-app navigation or browser close/refresh) asks
  // for confirmation first, since there may be an in-progress reconciliation.
  const [searchedInsurer, setSearchedInsurer] = useState(false)

  const blocker = useBlocker(searchedInsurer)

  useEffect(() => {
    if (!searchedInsurer) return
    const handler = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [searchedInsurer])

  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [addPaymentOpen, setAddPaymentOpen] = useState(false)
  const [modalMsgs, setModalMsgs] = useState([])
  const [successMsg, setSuccessMsg] = useState('')
  const [successShouldRedirect, setSuccessShouldRedirect] = useState(false)

  /* ── Reconciliation panel ────────────────────────────────────────────── */
  const [expandedPmtNo, setExpandedPmtNo] = useState('')
  const [reconRows, setReconRows] = useState([])
  const [reconLoading, setReconLoading] = useState(false)
  const [reconSaving, setReconSaving] = useState(false)
  const [reconSearch, setReconSearch] = useState('')

  const filteredReconRows = useMemo(() => {
    if (!reconSearch.trim()) return reconRows
    const q = reconSearch.toLowerCase()
    return reconRows.filter(r =>
      r.invoiceNo?.toLowerCase().includes(q) ||
      r.claimNo?.toLowerCase().includes(q) ||
      r.remarks?.toLowerCase().includes(q)
    )
  }, [reconRows, reconSearch])

  /* ── Reconciliation history popup — reused for Previously Received (by invoice)
     and Amount Adjusted (by voucher) ─────────────────────────────────── */
  const [historyTitle, setHistoryTitle] = useState('')
  const [historyRows, setHistoryRows] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  /* ── Invoice-wise drill-down behind the Total Pending / Total Received tiles ── */
  const [detailTitle, setDetailTitle] = useState('')
  const [detailRows, setDetailRows] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailSearch, setDetailSearch] = useState('')

  const filteredDetailRows = useMemo(() => {
    if (!detailSearch.trim()) return detailRows
    const q = detailSearch.toLowerCase()
    return detailRows.filter(d =>
      d.insurerNm?.toLowerCase().includes(q) ||
      d.claimNo?.toLowerCase().includes(q) ||
      d.invoiceNo?.toLowerCase().includes(q) ||
      d.statusNm?.toLowerCase().includes(q)
    )
  }, [detailRows, detailSearch])

  useEffect(() => {
    fetchDropdown('ddlinsurer').then(setDdlInsurer)
    fetchDropdown('drpbank').then(setDdlBank)
    fetchDropdown('ddlinvoicestatus').then(setDdlStatus)
    fetchMasterItems('Currency').then(setDdlCurrency)
    runSearch('', '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Default the Add New Payment currency to the selected Insurer's MT_Invoice
  // Insurer_Currency_Cd (already fetched via totalsCurrencyCd) — user can still
  // override it manually afterwards.
  useEffect(() => {
    if (totalsCurrencyCd) setForm(prev => ({ ...prev, currencyCd: totalsCurrencyCd }))
  }, [totalsCurrencyCd])

  async function runSearch(insurerCd, status) {
    setLoading(true)
    try {
      const result = await searchInsurerPayments({ insurerCd, status })
      setRows(result.rows ?? [])
      setTotalPending(result.totalPending ?? 0)
      setTotalReceived(result.totalReceived ?? 0)
      setTotalsCurrencyCd(result.currencyCd ?? '')
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  function handleSearch() {
    runSearch(filterInsurer, filterStatus)
    setSearchedInsurer(Boolean(filterInsurer))
  }

  function handleRefresh() {
    setSearchedInsurer(false)
    setFilterInsurer('')
    setFilterStatus('')
    runSearch('', '')
  }

  function handleFormChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmitPayment() {
    const errs = []
    if (!filterInsurer) errs.push('Please select an Insurer in the Status section above first.')
    if (!form.pmtDt) errs.push('Please enter the Payment Date.')
    if (!form.currencyCd) errs.push('Please select a Currency.')
    if (!form.pmtAmt || Number(form.pmtAmt) <= 0) errs.push('Please enter a valid Amount Received.')
    if (errs.length > 0) { setModalMsgs(errs); return }

    setSaving(true)
    try {
      const pmtNo = await saveInsurerPayment({
        insurerCd:  filterInsurer,
        pmtDt:      form.pmtDt,
        pmtAmt:     Number(form.pmtAmt),
        currencyCd: form.currencyCd,
        bankNm:     form.bankNm,
        pmtRefNo:   form.pmtRefNo,
        remarks:    form.remarks,
      })
      setSuccessMsg(`Payment ${pmtNo} added successfully.`)
      setSuccessShouldRedirect(false)
      setForm(BLANK_FORM)
      runSearch(filterInsurer, filterStatus)
    } catch {
      setModalMsgs(['Failed to save payment. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleAction(row) {
    if (expandedPmtNo === row.pmtNo) {
      setExpandedPmtNo('')
      setReconRows([])
      return
    }

    setExpandedPmtNo(row.pmtNo)
    setReconSearch('')
    setReconLoading(true)
    try {
      const candidates = await fetchReconciliationCandidates(row.insurerCd)
      // Balance_Amt (Converted_Net_Amt - Adjust_Treatment_Amt) already IS the true remaining
      // amount — Adjust_Treatment_Amt is a running total updated by every past reconciliation
      // payment, so it already nets those out. Previously Received is shown only as an
      // informational cross-check (recomputed independently from MT_PaymentRecon), never
      // subtracted again here — doing so would double-count prior payments.
      setReconRows(candidates.map(c => ({
        invoiceNo:  c.invoiceNo,
        claimNo:    c.claimNo,
        claimAmt:   Number(c.claimAmount || 0),
        claimRemaining: Number(c.balanceAmt || 0),
        previouslyReceived: Number(c.previouslyReceived || 0),
        statusCd:   c.statusCd,
        insurerNm:  row.insurerNm,
        pmtNo:      row.pmtNo,
        selected:   false,
        payableAmt: '0',
        remarks:    '',
      })))
    } catch {
      setReconRows([])
      setModalMsgs(['Failed to load pending invoices. Please try again.'])
    } finally {
      setReconLoading(false)
    }
  }

  function totalAllocated() {
    return reconRows.reduce((sum, r) => sum + (r.selected ? Number(r.payableAmt || 0) : 0), 0)
  }

  function handleReconRowChange(claimNo, field, value) {
    const voucherRow = rows.find(r => r.pmtNo === expandedPmtNo)
    const voucherRemaining = Number(voucherRow?.remainingAmt ?? 0)

    setReconRows(prev => prev.map(r => {
      if (r.claimNo !== claimNo) return r
      const next = { ...r, [field]: value }

      if (field === 'selected' && !value) next.payableAmt = '0'

      if (field === 'payableAmt') {
        // Allow free typing but cap fractional part at 2 decimals (e.g. "12", "12.5", "12.50")
        if (value !== '' && !/^\d*\.?\d{0,2}$/.test(value)) return r

        const amt = Number(value)
        if (!Number.isNaN(amt)) {
          const alreadyAllocatedElsewhere = prev
            .filter(x => x.claimNo !== claimNo && x.selected)
            .reduce((sum, x) => sum + Number(x.payableAmt || 0), 0)
          const maxForVoucher = voucherRemaining - alreadyAllocatedElsewhere
          let capped = amt
          if (capped > r.claimRemaining) capped = r.claimRemaining
          if (capped > maxForVoucher) capped = Math.max(maxForVoucher, 0)
          next.payableAmt = capped === amt ? value : String(capped)
        }
      }
      return next
    }))
  }

  function shortfallFor(r) {
    return Math.max(r.claimRemaining - Number(r.payableAmt || 0), 0)
  }

  async function handleShowHistory({ invoiceNo = '', pmtNo = '', title }) {
    setHistoryTitle(title)
    setHistoryLoading(true)
    try {
      setHistoryRows(await fetchPaymentReconHistory({ invoiceNo, pmtNo }))
    } catch {
      setHistoryRows([])
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handleShowDetail(type) {
    const insurerNm = filterInsurer ? (ddlInsurer.find(o => o.value === filterInsurer)?.text ?? filterInsurer) : 'All Insurers'
    setDetailTitle(`Invoice Details - ${insurerNm}`)
    setDetailSearch('')
    setDetailLoading(true)
    try {
      setDetailRows(await fetchInvoiceDetails({ insurerCd: filterInsurer, type }))
    } catch {
      setDetailRows([])
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleReconSubmit() {
    const selected = reconRows.filter(r => r.selected && Number(r.payableAmt) > 0)
    if (selected.length === 0) {
      setModalMsgs(['Please select at least one claim with a payable amount.'])
      return
    }
    if (selected.some(r => !r.statusCd)) {
      setModalMsgs(['Please choose a Status for every selected claim.'])
      return
    }

    setReconSaving(true)
    try {
      await saveReconciliation(expandedPmtNo, selected.map(r => ({
        invoiceNo:     r.invoiceNo,
        claimNo:       r.claimNo,
        amount:        Number(r.payableAmt),
        differenceAmt: shortfallFor(r),
        statusCd:      r.statusCd,
        remarks:       r.remarks,
      })))
      setSuccessMsg(`Reconciled ${selected.length} claim(s) totalling ${totalAllocated().toFixed(2)} against ${expandedPmtNo}.`)
      setSuccessShouldRedirect(true)
      setExpandedPmtNo('')
      setReconRows([])
      runSearch(filterInsurer, filterStatus)
    } catch {
      setModalMsgs(['Failed to save reconciliation. Please try again.'])
    } finally {
      setReconSaving(false)
    }
  }

  return (
    <div className="invl-wrap">
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />
      <ValidationModal
        messages={successMsg ? [successMsg] : []}
        type="success"
        onClose={() => {
          setSuccessMsg('')
          if (successShouldRedirect) {
            setSearchedInsurer(false)
            navigate('/accounts/insurer-payment-status')
          }
        }}
      />

      {/* ── Leave-page confirmation (in-app navigation, once a search has been run) ── */}
      {blocker.state === 'blocked' && (
        <div className="vmodal-overlay" onClick={() => blocker.reset()}>
          <div className="vmodal-box" onClick={e => e.stopPropagation()}>
            <div className="vmodal-header">
              <i className="fas fa-exclamation-triangle"></i>
              <span>Leave this page?</span>
            </div>
            <div className="vmodal-body">
              <ul className="vmodal-list">
                <li><i className="fas fa-circle-dot"></i>
                  Are you sure you want to leave this page? Any in-progress reconciliation will be lost.
                </li>
              </ul>
            </div>
            <div className="vmodal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-outline" onClick={() => blocker.reset()}>Cancel</button>
              <button className="vmodal-ok" onClick={() => blocker.proceed()}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reconciliation history popup (Previously Received / Amount Adjusted) ─── */}
      {historyTitle && (
        <div className="vmodal-overlay" onClick={() => setHistoryTitle('')}>
          <div className="vmodal-box" style={{ width: 680 }} onClick={e => e.stopPropagation()}>
            <div className="vmodal-header">
              <i className="fas fa-history"></i>
              <span>{historyTitle}</span>
            </div>
            <div className="vmodal-body">
              {historyLoading ? (
                <div className="invl-empty"><i className="fas fa-spinner fa-spin"></i>&nbsp; Loading...</div>
              ) : historyRows.length === 0 ? (
                <div className="invl-empty"><i className="fas fa-info-circle"></i>&nbsp; No payment history found.</div>
              ) : (
                <div className="invl-table-wrap">
                  <table className="invl-table">
                    <thead>
                      <tr>
                        <th>Payment Number</th>
                        <th>Payment Date</th>
                        <th>Invoice Number</th>
                        <th>Claim Number</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map((h, i) => (
                        <tr key={i}>
                          <td className="invl-td-claim">{h.pmtNo}</td>
                          <td className="invl-td-data">{h.pmtDt}</td>
                          <td className="invl-td-data">{h.invoiceNo}</td>
                          <td className="invl-td-data">{h.claimNo}</td>
                          <td className="invl-td-data invl-amount">{Number(h.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="invl-td-data">{h.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="vmodal-footer">
              <button className="vmodal-ok" onClick={() => setHistoryTitle('')}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice-wise drill-down popup (Total Pending / Total Received) ───────── */}
      {detailTitle && (
        <div className="vmodal-overlay" onClick={() => setDetailTitle('')}>
          <div className="vmodal-box" style={{ width: 1100, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div className="vmodal-header">
              <i className="fas fa-file-invoice-dollar"></i>
              <span>{detailTitle}</span>
            </div>
            <div className="vmodal-body">
              {!detailLoading && detailRows.length > 0 && (
                <div className="lsrch-table-toolbar">
                  <label>Search:</label>
                  <input
                    className="lsrch-table-search"
                    type="text"
                    value={detailSearch}
                    onChange={e => setDetailSearch(e.target.value)}
                    placeholder="Filter results..."
                  />
                </div>
              )}
              {detailLoading ? (
                <div className="invl-empty"><i className="fas fa-spinner fa-spin"></i>&nbsp; Loading...</div>
              ) : detailRows.length === 0 ? (
                <div className="invl-empty"><i className="fas fa-info-circle"></i>&nbsp; No invoices found.</div>
              ) : (
                <div className="invl-table-wrap">
                  <table className="invl-table">
                    <thead>
                      <tr>
                        <th>S. No.</th>
                        <th>Claim Number</th>
                        <th>Invoice Number</th>
                        <th>Status</th>
                        <th>Currency</th>
                        <th style={{ textAlign: 'right' }}>Claim Amount</th>
                        <th style={{ textAlign: 'right' }}>Received Amount</th>
                        <th style={{ textAlign: 'right' }}>Shortfall Amount</th>
                        <th style={{ textAlign: 'right' }}>Pending Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDetailRows.length === 0 ? (
                        <tr><td colSpan={9} className="invl-td-data" style={{ textAlign: 'center' }}>No matching invoices.</td></tr>
                      ) : filteredDetailRows.map((d, i) => (
                        <tr key={i}>
                          <td className="invl-td-data">{i + 1}</td>
                          <td className="invl-td-claim">{d.claimNo}</td>
                          <td className="invl-td-data">{d.invoiceNo}</td>
                          <td className="invl-td-data">{d.statusNm}</td>
                          <td className="invl-td-data">{d.currencyCd}</td>
                          <td className="invl-td-data invl-amount">{Number(d.claimAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="invl-td-data invl-amount">{Number(d.previouslyReceived).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="invl-td-data invl-amount">{Number(d.shortfallAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="invl-td-data invl-amount">{Number(d.balanceAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} style={{ fontWeight: 600, textAlign: 'right' }}>Total</td>
                        <td className="invl-amount" style={{ fontWeight: 600 }}>
                          {filteredDetailRows.reduce((sum, d) => sum + Number(d.claimAmount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="invl-amount" style={{ fontWeight: 600 }}>
                          {filteredDetailRows.reduce((sum, d) => sum + Number(d.previouslyReceived || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="invl-amount" style={{ fontWeight: 600 }}>
                          {filteredDetailRows.reduce((sum, d) => sum + Number(d.shortfallAmt || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="invl-amount" style={{ fontWeight: 600 }}>
                          {filteredDetailRows.reduce((sum, d) => sum + Number(d.balanceAmt || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
            <div className="vmodal-footer">
              <button className="vmodal-ok" onClick={() => setDetailTitle('')}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="invl-pg-header">
        <div className="invl-pg-title-group">
          <div className="invl-pg-title">
            <span className="invl-title-icon"><i className="fas fa-hand-holding-usd"></i></span>
            Payment Status
          </div>
          <div className="invl-pg-sub">Search insurer payments and view outstanding / received totals</div>
        </div>
      </div>

      {/* ── Search Filters ──────────────────────────────────────────────────── */}
      <div className="invl-card">
        <div className="invl-card-head">
          <span className="invl-head-title"><i className="fas fa-filter"></i>&nbsp; Status</span>
        </div>
        <div className="invl-card-body">
          <div className="grid-form-two-cols">
            <div className="group-form-medical">
              <label className="label-form-medical">Insurer / Entity</label>
              <select className="input-form-medical" value={filterInsurer} onChange={e => setFilterInsurer(e.target.value)}>
                {ddlInsurer.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
            </div>
            <div className="group-form-medical">
              <label className="label-form-medical">Status</label>
              <select className="input-form-medical" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                {ddlStatus.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="invl-btn invl-btn-primary invl-btn-sm" onClick={handleSearch} disabled={loading}>
              <i className="fas fa-search"></i> Submit
            </button>
            <button className="invl-btn invl-btn-outline invl-btn-sm" onClick={handleRefresh} disabled={loading}>
              <i className="fas fa-redo"></i> Refresh
            </button>
          </div>
        </div>

        {/* ── Payment Summary ───────────────────────────────────────────────── */}
        <div className="acct-summary-grid">
          <div className="acct-summary-tile" style={{ cursor: 'pointer' }} onClick={() => handleShowDetail('PENDING')}>
            <div className="acct-summary-label">Total Amount Pending</div>
            <div className="acct-summary-value">
              {totalsCurrencyCd && <span style={{ fontSize: 13, fontWeight: 600, marginRight: 4 }}>{totalsCurrencyCd}</span>}
              {totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="acct-summary-tile" style={{ cursor: 'pointer' }} onClick={() => handleShowDetail('RECEIVED')}>
            <div className="acct-summary-label">Total Amount Received</div>
            <div className="acct-summary-value">
              {totalsCurrencyCd && <span style={{ fontSize: 13, fontWeight: 600, marginRight: 4 }}>{totalsCurrencyCd}</span>}
              {totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Add New Payment ─────────────────────────────────────────────────── */}
      <div className="invl-card">
        <div
          className="invl-card-head"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setAddPaymentOpen(prev => !prev)}
        >
          <span className="invl-head-title"><i className="fas fa-plus-circle"></i>&nbsp; Add New Payment</span>
          <i className={`fas fa-chevron-${addPaymentOpen ? 'up' : 'down'}`}></i>
        </div>
        {addPaymentOpen && (
        <div className="invl-card-body">
          <div className="grid-form-two-cols">
            <div className="group-form-medical">
              <label className="label-form-medical">Insurer / Entity</label>
              <div className="input-form-medical" style={{ background: '#f5f3fa', color: filterInsurer ? '#333' : '#999' }}>
                {filterInsurer ? (ddlInsurer.find(o => o.value === filterInsurer)?.text ?? filterInsurer) : 'Select an Insurer in the Status section above'}
              </div>
            </div>
            <div className="group-form-medical">
              <label className="label-form-medical">Payment Date <span style={{ color: '#e53e3e' }}>*</span></label>
              <input type="date" className="input-form-medical" value={form.pmtDt} onChange={e => handleFormChange('pmtDt', e.target.value)} />
            </div>
            <div className="group-form-medical">
              <label className="label-form-medical">Payment Reference Number</label>
              <input className="input-form-medical" value={form.pmtRefNo} onChange={e => handleFormChange('pmtRefNo', e.target.value)} />
            </div>
            <div className="group-form-medical">
              <label className="label-form-medical">Bank Name (Credit Bank)</label>
              <select className="input-form-medical" value={form.bankNm} onChange={e => handleFormChange('bankNm', e.target.value)}>
                {ddlBank.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
              </select>
            </div>
            <div className="group-form-medical">
              <label className="label-form-medical">Amount Received <span style={{ color: '#e53e3e' }}>*</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  className="input-form-medical"
                  style={{ flex: '0 0 100px' }}
                  value={form.currencyCd}
                  onChange={e => handleFormChange('currencyCd', e.target.value)}
                >
                  {ddlCurrency.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
                </select>
                <input
                  type="number" min="0" step="0.01"
                  className="input-form-medical"
                  style={{ flex: 1 }}
                  value={form.pmtAmt}
                  onChange={e => handleFormChange('pmtAmt', e.target.value)}
                />
              </div>
            </div>
            <div className="group-form-medical">
              <label className="label-form-medical">Remarks</label>
              <input className="input-form-medical" value={form.remarks} onChange={e => handleFormChange('remarks', e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="invl-btn invl-btn-primary invl-btn-sm" onClick={handleSubmitPayment} disabled={saving}>
              {saving ? <><i className="fas fa-spinner fa-spin"></i> Submitting...</> : <><i className="fas fa-check-circle"></i> Submit</>}
            </button>
          </div>
        </div>
        )}
      </div>

      {/* ── Payments Grid ────────────────────────────────────────────────────── */}
      <div className="invl-card">
        <div className="invl-card-head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="invl-head-title"><i className="fas fa-list"></i>&nbsp; Payment Details</span>
          {filterInsurer && (
            <span style={{ border: '1px solid #ccc', borderRadius: 4, padding: '4px 10px', fontSize: 13, background: '#fff' }}>
              {ddlInsurer.find(o => o.value === filterInsurer)?.text ?? filterInsurer}
            </span>
          )}
        </div>
        <div className="invl-card-body">
          <div className="invl-table-wrap">
            <table className="invl-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>Payment Number</th>
                  <th>Payment Date</th>
                  <th style={{ textAlign: 'right' }}>Amount Received</th>
                  <th style={{ textAlign: 'right' }}>Amount Adjusted</th>
                  <th style={{ textAlign: 'right' }}>Available Amount</th>
                  <th>Bank Name</th>
                  <th style={{ textAlign: 'center' }}>Edit</th>
                  <th>Remarks</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="invl-empty"><i className="fas fa-spinner fa-spin"></i>&nbsp; Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={10} className="invl-empty"><i className="fas fa-info-circle"></i>&nbsp; No records found.</td></tr>
                ) : rows.map((row, i) => (
                  <Fragment key={row.id}>
                    <tr>
                      <td className="invl-td-sno">{i + 1}</td>
                      <td className="invl-td-claim">{row.pmtNo}</td>
                      <td className="invl-td-data">{row.pmtDt}</td>
                      <td className="invl-td-data invl-amount">{Number(row.pmtAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="invl-td-data invl-amount">
                        {Number(row.pmtAdjust) > 0 ? (
                          <button
                            type="button"
                            className="invl-action-btn"
                            style={{ padding: 0, color: '#1a4fc4', textDecoration: 'underline', fontSize: 13 }}
                            onClick={() => handleShowHistory({ pmtNo: row.pmtNo, title: `Amount Adjusted — ${row.pmtNo}` })}
                          >
                            {Number(row.pmtAdjust).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </button>
                        ) : (
                          Number(row.pmtAdjust).toLocaleString('en-IN', { minimumFractionDigits: 2 })
                        )}
                      </td>
                      <td className="invl-td-data invl-amount">{Number(row.remainingAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="invl-td-data">{row.bankNm}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="invl-action-btn"
                          title="Edit"
                          disabled={row.claimCount > 0}
                          style={row.claimCount > 0 ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
                          onClick={() => alert('Edit is not wired up yet.')}
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      </td>
                      <td className="invl-td-data">{row.remarks}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="invl-btn invl-btn-primary invl-btn-sm"
                          disabled={Number(row.remainingAmt) <= 0}
                          onClick={() => handleToggleAction(row)}
                        >
                          <i className={`fas fa-${expandedPmtNo === row.pmtNo ? 'chevron-up' : 'sign-out'}`}></i>
                          &nbsp;{expandedPmtNo === row.pmtNo ? 'Close' : 'Action'}
                        </button>
                      </td>
                    </tr>

                    {expandedPmtNo === row.pmtNo && (
                      <tr>
                        <td colSpan={10} style={{ background: '#fafaff', padding: 16 }}>
                          {reconLoading ? (
                            <div className="invl-empty"><i className="fas fa-spinner fa-spin"></i>&nbsp; Loading pending invoices...</div>
                          ) : reconRows.length === 0 ? (
                            <div className="invl-empty"><i className="fas fa-info-circle"></i>&nbsp; No pending invoices found.</div>
                          ) : (
                          <>
                          <div className="lsrch-table-toolbar">
                            <label>Search:</label>
                            <input
                              className="lsrch-table-search"
                              type="text"
                              value={reconSearch}
                              onChange={e => setReconSearch(e.target.value)}
                              placeholder="Filter results..."
                            />
                          </div>
                          <div className="invl-table-wrap">
                            <table className="invl-table">
                              <thead>
                                <tr style={{ background: '#1f4e78' }}>
                                  <th style={{ color: '#fff' }}>Invoice Number</th>
                                  <th style={{ color: '#fff' }}>Claim Number</th>
                                  <th style={{ textAlign: 'right', color: '#fff' }}>Claim Amount</th>
                                  <th style={{ textAlign: 'right', color: '#fff', width: 80, whiteSpace: 'normal' }}>Previously Received</th>
                                  <th style={{ textAlign: 'right', color: '#fff', width: 80, whiteSpace: 'normal' }}>Claim Remaining Amount</th>
                                  <th style={{ textAlign: 'right', color: '#fff', width: 80, whiteSpace: 'normal' }}>Received Amount</th>
                                  <th style={{ textAlign: 'right', color: '#fff', width: 80, whiteSpace: 'normal' }}>Shortfall Amount</th>
                                  <th style={{ color: '#fff' }}>Status</th>
                                  <th style={{ color: '#fff', minWidth: 220 }}>Remarks</th>
                                  <th style={{ textAlign: 'center', color: '#fff' }}>Select</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredReconRows.length === 0 ? (
                                  <tr><td colSpan={10} className="invl-td-data" style={{ textAlign: 'center' }}>No matching invoices.</td></tr>
                                ) : filteredReconRows.map(r => (
                                  <tr key={r.claimNo}>
                                    <td className="invl-td-claim">{r.invoiceNo}</td>
                                    <td className="invl-td-data">{r.claimNo}</td>
                                    <td className="invl-td-data invl-amount">{r.claimAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="invl-td-data invl-amount">
                                      {r.previouslyReceived > 0 ? (
                                        <button
                                          type="button"
                                          className="invl-action-btn"
                                          style={{ padding: 0, color: '#1a4fc4', textDecoration: 'underline', fontSize: 13 }}
                                          onClick={() => handleShowHistory({ invoiceNo: r.invoiceNo, title: `Previously Received — ${r.invoiceNo}` })}
                                        >
                                          {r.previouslyReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </button>
                                      ) : (
                                        r.previouslyReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })
                                      )}
                                    </td>
                                    <td className="invl-td-data invl-amount">{r.claimRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="invl-td-data invl-amount">
                                      <input
                                        type="text" inputMode="decimal"
                                        style={{ width: 70, textAlign: 'right' }}
                                        className="input-form-medical"
                                        value={r.payableAmt}
                                        onChange={e => handleReconRowChange(r.claimNo, 'payableAmt', e.target.value)}
                                      />
                                    </td>
                                    <td className="invl-td-data invl-amount">{shortfallFor(r).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="invl-td-data">
                                      <select
                                        className="input-form-medical"
                                        style={{ minWidth: 120 }}
                                        disabled={!r.selected}
                                        value={r.statusCd}
                                        onChange={e => handleReconRowChange(r.claimNo, 'statusCd', e.target.value)}
                                      >
                                        {ddlStatus.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
                                      </select>
                                    </td>
                                    <td className="invl-td-data">
                                      <input
                                        className="input-form-medical"
                                        style={{ width: '100%', minWidth: 200 }}
                                        disabled={!r.selected}
                                        value={r.remarks}
                                        onChange={e => handleReconRowChange(r.claimNo, 'remarks', e.target.value)}
                                      />
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <input
                                        type="checkbox"
                                        checked={r.selected}
                                        onChange={e => handleReconRowChange(r.claimNo, 'selected', e.target.checked)}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          </>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>
                              Allocated: {totalAllocated().toFixed(2)} / Voucher Remaining: {Number(row.remainingAmt).toFixed(2)}
                            </div>
                            <button className="invl-btn invl-btn-primary invl-btn-sm" onClick={handleReconSubmit} disabled={reconSaving}>
                              {reconSaving ? <><i className="fas fa-spinner fa-spin"></i> Submitting...</> : <><i className="fas fa-check-circle"></i> Submit Reconciliation</>}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
