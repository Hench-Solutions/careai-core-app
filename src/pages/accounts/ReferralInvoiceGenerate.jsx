import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchReferralInvoiceCaseGrid, fetchReferralInvoiceDashboard, saveReferralInvoice } from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'

function fmtAmt(n) {
  return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Tile({ label, value, color }) {
  return (
    <div className="panel-card" style={{ padding: '14px 16px', minWidth: 140 }}>
      <div style={{ fontSize: 11, color: '#888', letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || '#2e1d55', marginTop: 4 }}>{value}</div>
    </div>
  )
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

// Final amount for a row — Hospital Received (manual entry) if provided, else the
// system-calculated amount (Bill Amount × Agreed %).
function finalAmtFor(row) {
  return row.hospitalReceivedAmt !== '' ? round2(row.hospitalReceivedAmt) : row.systemCalcAmt
}

export default function ReferralInvoiceGenerate() {
  const navigate = useNavigate()
  const [params]  = useSearchParams()

  const prvCd = params.get('prvCd') ?? ''
  const qpFromDt = params.get('fromDt') ?? ''
  const qpUptoDt = params.get('uptoDt') ?? ''
  // Present only when opened via "Continue" on a specific saved draft — scopes the
  // grid to that invoice's own claims instead of every pending claim for the provider.
  const qpInvoiceNo = params.get('invoiceNo') ?? ''

  const [prvNm, setPrvNm] = useState(prvCd)

  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [modalMsgs, setModalMsgs] = useState([])
  const [successMsg, setSuccessMsg] = useState('')

  const [rows,       setRows]       = useState([])   // merged case + saved-line state
  const [invoiceNo,  setInvoiceNo]  = useState('')
  const [status,     setStatus]     = useState('')    // '' (no draft yet) | DRAFT | GENERATED
  const [remarks,    setRemarks]    = useState('')

  /* ── Filters (Billing Period) + summary tiles — same shape as the Referral
     Invoice List page. Status dropdown is kept but not wired up yet — pending
     discussion with the client on what it should filter here. ── */
  const [fStatus, setFStatus] = useState('')
  const [fFromDt, setFFromDt] = useState(qpFromDt)
  const [fUptoDt, setFUptoDt] = useState(qpUptoDt)
  const [summary, setSummary] = useState(null)
  const [dashRow, setDashRow] = useState(null)

  const isLocked = status === 'GENERATED'

  useEffect(() => {
    loadCases(qpFromDt, qpUptoDt)
    loadSummary()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function loadSummary() {
    fetchReferralInvoiceDashboard({ prvCd }).then(result => {
      setSummary(result?.summary ?? null)
      // Dashboard row covers every status_cd=329 claim for this provider (not just
      // pending ones), so it still has a currency/value even when the case-grid
      // below is empty (nothing left pending right now). Also gives the native
      // (un-converted) value — this provider-specific page shows native currency,
      // not the USD conversion (that's only on the all-providers Dashboard page).
      setDashRow(result?.rows?.[0] ?? null)
    }).catch(() => {})
  }

  function loadCases(fromDt, uptoDt) {
    if (!prvCd) { setModalMsgs(['Missing provider — go back and choose a hospital first.']); return }

    setLoading(true)
    setError('')
    fetchReferralInvoiceCaseGrid(prvCd, fromDt, uptoDt, qpInvoiceNo)
      .then(result => {
        setPrvNm(result?.prvNm || prvCd)
        const cases = result?.cases ?? []
        const header = result?.header ?? null
        const lines  = result?.lines ?? []
        const lineByClaimNo = Object.fromEntries(lines.map(l => [l.claimNo, l]))

        setRows(cases.map(c => {
          const systemCalcAmt = round2(c.billAmt * (c.agreedPct / 100))
          const saved = lineByClaimNo[c.claimNo]
          return {
            claimNo: c.claimNo,
            memberName: c.memberName,
            memberId: c.memberId,
            treatmentTypeCd: c.treatmentTypeCd,
            invoiceDt: c.invoiceDt,
            billAmt: c.billAmt,
            agreedPct: c.agreedPct,
            systemCalcAmt,
            hospitalReceivedAmt: saved?.hospitalReceivedAmt ?? '',
            currencyCd: c.currencyCd || '',
            selected: true,
          }
        }))

        if (header) {
          setInvoiceNo(header.invoiceNo)
          setStatus(header.status)
          setRemarks(header.remarks)
        } else {
          setInvoiceNo(''); setStatus(''); setRemarks('')
        }
      })
      .catch(() => setError('Failed to load cases for this hospital. Please try again.'))
      .finally(() => setLoading(false))
  }

  function handleSearch() {
    loadCases(fFromDt, fUptoDt)
  }

  function handleRefresh() {
    setFStatus(''); setFFromDt(''); setFUptoDt('')
    loadCases('', '')
    loadSummary()
  }

  function updateRow(claimNo, patch) {
    setRows(prev => prev.map(r => r.claimNo === claimNo ? { ...r, ...patch } : r))
  }

  const selectedRows = rows.filter(r => r.selected)
  const grandTotal   = selectedRows.reduce((s, r) => s + (r.billAmt || 0), 0)
  const currencyCd   = rows.find(r => r.currencyCd)?.currencyCd || dashRow?.currencyCd || '—'

  function handleHospitalCalcChange(claimNo, systemCalcAmt, rawValue) {
    const digitsOnly = rawValue.replace(/[^0-9]/g, '')
    const capped = digitsOnly === '' ? '' : String(Math.min(Number(digitsOnly), Math.floor(systemCalcAmt)))
    updateRow(claimNo, { hospitalReceivedAmt: capped })
  }

  function buildPayload(mode) {
    return {
      mode,
      prvCd,
      fromDt: fFromDt, uptoDt: fUptoDt,
      remarks,
      vatPct: 0,
      lines: selectedRows.map(r => ({
        claimNo: r.claimNo,
        billAmt: r.billAmt,
        agreedPct: r.agreedPct,
        systemCalcAmt: r.systemCalcAmt,
        hospitalReceivedAmt: r.hospitalReceivedAmt === '' ? null : Number(r.hospitalReceivedAmt),
        amountSource: r.hospitalReceivedAmt === '' ? 'SYSTEM' : 'HOSPITAL',
        overrideAmt: null,
        overrideReason: '',
        finalAmt: finalAmtFor(r),
      })),
    }
  }

  function validateForSave() {
    const errs = []
    if (selectedRows.length === 0) errs.push('Select at least one case.')
    return errs
  }

  async function handleGenerate() {
    const errs = validateForSave()
    if (errs.length) { setModalMsgs(errs); return }
    if (!window.confirm('Generate the referral invoice now? Once generated, it cannot be edited and these cases will be locked.')) return

    setSaving(true)
    try {
      const result = await saveReferralInvoice(buildPayload('GENERATE'))
      setStatus(result.status); setInvoiceNo(result.invoiceNo)
      setSuccessMsg(`Referral invoice ${result.invoiceNo} generated successfully.`)
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to generate invoice. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="lsrch-page">
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />

      {successMsg && (
        <div className="vmodal-overlay" onClick={() => setSuccessMsg('')}>
          <div className="vmodal-box" onClick={e => e.stopPropagation()}>
            <div className="vmodal-header" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
              <i className="fas fa-check-circle"></i><span>Success</span>
            </div>
            <div className="vmodal-body">
              <ul className="vmodal-list"><li><i className="fas fa-check"></i>{successMsg}</li></ul>
            </div>
            <div className="vmodal-footer">
              <button className="vmodal-ok" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}
                onClick={() => setSuccessMsg('')}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Referral Invoice — {prvNm}{invoiceNo && ` (${invoiceNo})`}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" onClick={() => navigate(`/accounts/referral-invoice/list?prvCd=${encodeURIComponent(prvCd)}`)}>
            <i className="fas fa-list"></i>&nbsp; View Invoices
          </button>
          <button className="btn-outline" onClick={() => navigate('/accounts/referral-invoice/dashboard')}>
            <i className="fas fa-arrow-left"></i>&nbsp; Back
          </button>
        </div>
      </div>

      {/* ── Search Filters card — Status not wired up yet, pending client discussion ── */}
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div className="lsrch-filter-panel">
          <div className="cbill-filter-grid">

            <div className="cbill-filter-item">
              <label className="cbill-label">Status</label>
              <select className="cbill-input" value={fStatus} onChange={e => setFStatus(e.target.value)}>
                <option value="">All</option>
                <option value="DRAFT">Draft</option>
                <option value="GENERATED">Generated</option>
              </select>
            </div>

            <div className="cbill-filter-item">
              <label className="cbill-label">Created Date From</label>
              <input className="cbill-input" type="date"
                value={fFromDt} onChange={e => setFFromDt(e.target.value)} />
            </div>

            <div className="cbill-filter-item">
              <label className="cbill-label">Created Date Upto</label>
              <input className="cbill-input" type="date"
                value={fUptoDt} onChange={e => setFUptoDt(e.target.value)} />
            </div>

          </div>

          <div className="cbill-divider" />

          <div className="lsrch-btn-row">
            <button className="btn-gradient" onClick={handleSearch}>
              <i className="fas fa-search"></i>&nbsp; Search
            </button>
            <button className="btn-outline" onClick={handleRefresh}>
              <i className="fas fa-sync-alt"></i>&nbsp; Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary tiles ── */}
      {summary && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <Tile label="Cases Billed"         value={summary.casesBilled} />
          <Tile label="Invoice Raised"       value={summary.invoiceRaisedCount} color="#2e7d32" />
          <Tile label="Pending"              value={summary.pendingCount} color="#b26a00" />
          <Tile label="Settled"              value={summary.settledCount} />
          <Tile label="Currency"             value={currencyCd} />
          <Tile label="Invoice Raised Value" value={`${fmtAmt(dashRow?.invoiceRaisedValueNative)} ${currencyCd}`} />
          <Tile label="Total Invoice Value"  value={`${fmtAmt(dashRow?.totalInvoiceValueNative)} ${currencyCd}`} />
        </div>
      )}

      {isLocked && (
        <p className="lsrch-error" style={{ background: '#eef7ee', color: '#2e7d32', padding: '10px 14px', borderRadius: 6 }}>
          <i className="fas fa-lock"></i>&nbsp; This referral invoice has been generated and is now locked (read-only).
        </p>
      )}

      {loading && <p style={{ padding: '12px 0' }}><i className="fas fa-spinner fa-spin"></i>&nbsp; Loading...</p>}
      {error && <p className="lsrch-error">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="panel-card" style={{ padding: '28px 12px', textAlign: 'center', color: '#888' }}>
          <i className="fas fa-info-circle"></i>&nbsp; No claim pending for invoice.
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Case grid */}
          <div className="panel-card" style={{ marginBottom: 16, overflowX: 'auto' }}>
            <table className="lsrch-table" style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th>Case / Claim ID</th>
                  <th>Patient</th>
                  <th>Type</th>
                  <th>Treatment Date</th>
                  <th>Bill Amount</th>
                  <th>Agreed %</th>
                  <th>System Calculated</th>
                  <th>Hospital Calculation</th>
                  <th>Variance</th>
                  <th>Final Amount</th>
                  <th style={{ textAlign: 'center' }}>Select</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const hasHosp = r.hospitalReceivedAmt !== ''
                  const variance = hasHosp ? round2(r.hospitalReceivedAmt - r.systemCalcAmt) : null
                  return (
                    <tr key={r.claimNo}>
                      <td className="lsrch-td-claim">{r.claimNo}</td>
                      <td className="lsrch-td-data">{r.memberName} {r.memberId && `(${r.memberId})`}</td>
                      <td className="lsrch-td-data">{r.treatmentTypeCd}</td>
                      <td className="lsrch-td-data">{r.invoiceDt}</td>
                      <td className="lsrch-td-data cbill-amount">{fmtAmt(r.billAmt)}</td>
                      <td className="lsrch-td-data">{r.agreedPct}</td>
                      <td className="lsrch-td-data cbill-amount">{fmtAmt(r.systemCalcAmt)}</td>
                      <td>
                        <input className="prv-input" style={{ width: 110 }} inputMode="numeric"
                          placeholder="not received" value={r.hospitalReceivedAmt}
                          disabled={isLocked}
                          onChange={e => handleHospitalCalcChange(r.claimNo, r.systemCalcAmt, e.target.value)} />
                      </td>
                      <td style={{ color: variance == null ? '#888' : variance < 0 ? '#c0392b' : variance > 0 ? '#27ae60' : '#555' }}>
                        {variance == null ? '—' : fmtAmt(variance)}
                      </td>
                      <td className="lsrch-td-data cbill-amount" style={{ fontWeight: 700 }}>{fmtAmt(finalAmtFor(r))}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={r.selected} disabled={isLocked}
                          onChange={e => updateRow(r.claimNo, { selected: e.target.checked })} />
                      </td>
                    </tr>
                  )
                })}
                <tr style={{ fontWeight: 700, background: '#f7f5fb' }}>
                  <td colSpan={10}>Grand Total — {selectedRows.length} of {rows.length} cases selected</td>
                  <td className="cbill-amount" style={{ textAlign: 'center' }}>{fmtAmt(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Remarks + actions */}
          <div className="panel-card" style={{ padding: 16 }}>
            <label className="cbill-label">Remarks / Terms (prints on invoice)</label>
            <textarea className="prv-input" rows={3} style={{ width: '100%', resize: 'vertical' }}
              value={remarks} disabled={isLocked} onChange={e => setRemarks(e.target.value)} />
          </div>

          {!isLocked && (
            <div style={{ display: 'flex', gap: 12, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn-outline" onClick={() => navigate('/accounts/case-bill-referral')}>Cancel</button>
              <button className="btn-gradient" onClick={handleGenerate} disabled={saving}>
                <i className="fas fa-file-invoice"></i>&nbsp; {saving ? 'Working...' : 'Generate Invoice'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
