import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchReferralInvoiceHeaderList, fetchReferralInvoiceDashboard, fetchReferralInvoiceDetail, saveReferralInvoice } from '../../utils/api'

const PAGE_SIZE = 10

function fmtAmt(n) {
  return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function buildPrintHtml(detail, row) {
  const rows = (detail?.cases ?? []).map(c => {
    const line = (detail?.lines ?? []).find(l => l.claimNo === c.claimNo)
    const systemCalcAmt = round2(c.billAmt * (c.agreedPct / 100))
    return { ...c, finalAmt: line?.finalAmt ?? systemCalcAmt, hospitalReceivedAmt: line?.hospitalReceivedAmt ?? '' }
  })
  const grandTotal = rows.reduce((s, r) => s + (r.billAmt || 0), 0)
  const rowsHtml = rows.map(r => `
    <tr>
      <td>${r.claimNo}</td>
      <td>${r.memberName}${r.memberId ? ` (${r.memberId})` : ''}</td>
      <td>${r.treatmentTypeCd}</td>
      <td>${r.invoiceDt}</td>
      <td style="text-align:right">${fmtAmt(r.billAmt)}</td>
      <td style="text-align:right">${r.agreedPct}</td>
      <td style="text-align:right">${r.hospitalReceivedAmt === '' ? 'not received' : fmtAmt(r.hospitalReceivedAmt)}</td>
      <td style="text-align:right"><b>${fmtAmt(r.finalAmt)}</b></td>
    </tr>`).join('')

  return `<!doctype html><html><head><title>Referral Invoice — ${row.prvNm}${row.invoiceNo ? ` (${row.invoiceNo})` : ''}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
      h2 { margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #ddd; padding: 8px 10px; font-size: 13px; }
      th { background: #2e1d55; color: #fff; text-align: left; }
      tfoot td { font-weight: 700; background: #f7f5fb; }
      .remarks { margin-top: 20px; white-space: pre-wrap; }
    </style></head>
    <body>
      <h2>Referral Invoice — ${row.prvNm}${row.invoiceNo ? ` (${row.invoiceNo})` : ''}</h2>
      <div>Status: ${row.status}</div>
      <table>
        <thead><tr>
          <th>Case / Claim ID</th><th>Patient</th><th>Type</th><th>Treatment Date</th>
          <th>Bill Amount</th><th>Agreed %</th><th>Hospital Received</th><th>Final Amount</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td colspan="7">Grand Total — ${rows.length} case${rows.length === 1 ? '' : 's'}</td><td>${fmtAmt(grandTotal)}</td></tr></tfoot>
      </table>
      <div class="remarks"><b>Remarks / Terms:</b><br/>${detail?.header?.remarks || '—'}</div>
      <script>window.onload = () => { window.print() }</script>
    </body></html>`
}

function SettlementPopup({ row, onClose, onSaved }) {
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const [settledAmt, setSettledAmt] = useState('')
  const [settledDt,  setSettledDt]  = useState('')
  const [lineRows,   setLineRows]   = useState([])

  useEffect(() => {
    fetchReferralInvoiceDetail(row.id)
      .then(result => {
        const cases = result?.cases ?? []
        const lines = result?.lines ?? []
        const lineByClaimNo = Object.fromEntries(lines.map(l => [l.claimNo, l]))

        setLineRows(cases.map(c => {
          const line = lineByClaimNo[c.claimNo]
          // Status_Cd is the source of truth for "already settled" — Settled_Amt
          // defaults to 0.00 (not NULL) on an un-settled line, so the amount alone
          // can't tell a real 0 settlement apart from "never settled".
          const alreadySettled = (line?.statusCd ?? 101) !== 101
          return {
            claimNo: c.claimNo,
            memberName: c.memberName,
            memberId: c.memberId,
            treatmentTypeCd: c.treatmentTypeCd,
            invoiceDt: c.invoiceDt,
            billAmt: c.billAmt,
            agreedPct: c.agreedPct,
            systemCalcAmt: round2(c.billAmt * (c.agreedPct / 100)),
            hospitalReceivedAmt: line?.hospitalReceivedAmt ?? '',
            finalAmt: line?.finalAmt ?? round2(c.billAmt * (c.agreedPct / 100)),
            settledAmt: alreadySettled ? (line?.settledAmt ?? '') : '',
            alreadySettled,
          }
        }))

        const header = result?.header
        setSettledDt(header?.settledDt || '')
      })
      .catch(() => setError('Failed to load this referral invoice. Please try again.'))
      .finally(() => setLoading(false))
  }, [row.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateLine(claimNo, patch) {
    setLineRows(prev => prev.map(r => r.claimNo === claimNo ? { ...r, ...patch } : r))
  }

  // Waterfall-distributes the entered Settled Amount across the claims, in
  // order, each capped at its own Final Amount — the amount being compared
  // while distributing, per the client's instruction.
  function distributeSettledAmt(totalStr) {
    let remaining = Number(totalStr) || 0
    setLineRows(prev => prev.map(r => {
      if (r.alreadySettled) return r   // locked — this amount isn't redistributed here
      const alloc = Math.max(0, Math.min(remaining, r.finalAmt))
      remaining -= alloc
      return { ...r, settledAmt: alloc === 0 ? '' : round2(alloc) }
    }))
  }

  function handleSave() {
    if (!settledDt) { setError('Settled Date is required.'); return }
    setSaving(true)
    setError('')
    saveReferralInvoice({
      Mode: 'SETTLE',
      Id: row.id,
      SettledAmt: Number(settledAmt) || 0,
      SettledDt: settledDt,
      Lines: lineRows.map(r => ({ ClaimNo: r.claimNo, SettledAmt: r.settledAmt === '' ? null : Number(r.settledAmt) })),
    })
      .then(() => onSaved())
      .catch(() => setError('Failed to save settlement. Please try again.'))
      .finally(() => setSaving(false))
  }

  const finalTotal = lineRows.reduce((s, r) => s + (r.finalAmt || 0), 0)
  const settledTotal = lineRows.reduce((s, r) => s + (Number(r.settledAmt) || 0), 0)
  const isFullySettled = !loading && lineRows.length > 0 && lineRows.every(r => r.alreadySettled)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div className="panel-card" style={{ width: 'min(1100px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Settlement — {row.prvNm} {row.invoiceNo && `(${row.invoiceNo})`}</h3>

        {loading ? (
          <p><i className="fas fa-spinner fa-spin"></i>&nbsp; Loading...</p>
        ) : (
          <>
            {isFullySettled && (
              <p className="lsrch-error" style={{ background: '#eef7ee', color: '#2e7d32', padding: '10px 14px', borderRadius: 6 }}>
                <i className="fas fa-check-circle"></i>&nbsp; All claims on this invoice are already settled — no further changes allowed.
              </p>
            )}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <div>
                <label className="cbill-label">Settled Amount</label>
                <input className="cbill-input" type="number" style={{ width: 180 }} placeholder="Enter amount"
                  value={settledAmt} disabled={isFullySettled}
                  onChange={e => { setSettledAmt(e.target.value); distributeSettledAmt(e.target.value) }} />
              </div>
              <div>
                <label className="cbill-label">Settled Date</label>
                <input className="cbill-input" type="date" style={{ width: 180 }}
                  value={settledDt} disabled={isFullySettled} onChange={e => setSettledDt(e.target.value)} />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="lsrch-table" style={{ minWidth: 1000 }}>
                <thead>
                  <tr>
                    <th>Case / Claim ID</th>
                    <th>Patient</th>
                    <th>Type</th>
                    <th>Treatment Date</th>
                    <th>Agreed %</th>
                    <th>Final Amount</th>
                    <th>Settled Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineRows.map(r => (
                    <tr key={r.claimNo}>
                      <td className="lsrch-td-claim">{r.claimNo}</td>
                      <td className="lsrch-td-data">{r.memberName} {r.memberId && `(${r.memberId})`}</td>
                      <td className="lsrch-td-data">{r.treatmentTypeCd}</td>
                      <td className="lsrch-td-data">{r.invoiceDt}</td>
                      <td className="lsrch-td-data">{r.agreedPct}</td>
                      <td className="lsrch-td-data cbill-amount" style={{ fontWeight: 700 }}>{fmtAmt(r.finalAmt)}</td>
                      <td>
                        <input className="prv-input" style={{ width: 110 }} inputMode="decimal"
                          value={r.settledAmt} disabled={r.alreadySettled}
                          title={r.alreadySettled ? 'Already settled — cannot be changed' : undefined}
                          onChange={e => {
                            const raw = e.target.value
                            const capped = raw === '' ? '' : String(Math.min(Number(raw) || 0, r.finalAmt))
                            updateLine(r.claimNo, { settledAmt: capped })
                          }} />
                      </td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, background: '#f7f5fb' }}>
                    <td colSpan={4}>Grand Total — {lineRows.length} case{lineRows.length === 1 ? '' : 's'}</td>
                    <td></td>
                    <td className="cbill-amount">{fmtAmt(finalTotal)}</td>
                    <td className="cbill-amount">{fmtAmt(settledTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {error && <p className="lsrch-error">{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-gradient" onClick={handleSave} disabled={saving || loading || isFullySettled}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Tile({ label, value, color }) {
  return (
    <div className="panel-card" style={{ padding: '14px 16px', minWidth: 140 }}>
      <div style={{ fontSize: 11, color: '#888', letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || '#2e1d55', marginTop: 4 }}>{value}</div>
    </div>
  )
}

const STATUS_STYLES = {
  GENERATED:          { bg: '#eef7ee', color: '#2e7d32', label: 'Generated' },
  PARTIALLY_SETTLED:  { bg: '#fff4e5', color: '#b26a00', label: 'Partially Settled' },
  SETTLED:            { bg: '#e8f0fe', color: '#1a56c4', label: 'Settled' },
  DRAFT:              { bg: '#fff4e5', color: '#b26a00', label: 'Draft' },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { bg: '#f1f1f1', color: '#555', label: status || '—' }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  )
}

/**
 * ReferralInvoiceList — lists every saved MT_ReferralInvoice header (Draft or
 * Generated, any provider). Reuses the existing /v1/Accounts/referral-invoice
 * GET endpoint with mode=H — no new endpoint.
 * DRAFT rows → "Continue" reopens referral-invoice/generate for that provider
 *              (that page already re-loads the open draft's own saved lines).
 * GENERATED rows → "View"/"Update Settlement" opens a settlement popup (case
 *              grid + header/per-line Settled Amount); "Print" opens a print view.
 */
export default function ReferralInvoiceList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prvCd = searchParams.get('prvCd') || ''
  const qpFromDt = searchParams.get('fromDt') || ''
  const qpUptoDt = searchParams.get('uptoDt') || ''

  /* ── Filter state ── */
  const [fStatus,     setFStatus]     = useState('')
  const [fFromDt,     setFFromDt]     = useState(qpFromDt)
  const [fUptoDt,     setFUptoDt]     = useState(qpUptoDt)

  /* ── Table state ── */
  const [rows,        setRows]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [quickSearch, setQuickSearch] = useState('')
  const [page,        setPage]        = useState(1)

  const [summary,     setSummary]     = useState(null)
  const [dashRow,     setDashRow]     = useState(null)
  const [settleRow,   setSettleRow]   = useState(null)

  useEffect(() => {
    load({ prvCd, fromDt: qpFromDt, uptoDt: qpUptoDt })
    loadSummary()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function load(filters = {}) {
    setLoading(true)
    setError('')
    fetchReferralInvoiceHeaderList({ prvCd, ...filters })
      .then(setRows)
      .catch(() => setError('Failed to load referral invoices. Please try again.'))
      .finally(() => setLoading(false))
  }

  function loadSummary() {
    fetchReferralInvoiceDashboard({ prvCd }).then(result => {
      setSummary(result?.summary ?? null)
      // Provider-specific page — show that provider's own-currency (native) value,
      // not the USD conversion (that's only for the all-providers Dashboard page).
      setDashRow(result?.rows?.[0] ?? null)
    }).catch(() => {})
  }

  function handleSearch() {
    load({ status: fStatus, fromDt: fFromDt, uptoDt: fUptoDt })
    setPage(1)
  }

  function handleRefresh() {
    setFStatus(''); setFFromDt(''); setFUptoDt('')
    setQuickSearch(''); setPage(1)
    load()
  }

  const filtered = useMemo(() => {
    if (!quickSearch.trim()) return rows
    const q = quickSearch.toLowerCase()
    return rows.filter(r =>
      (r.prvNm ?? '').toLowerCase().includes(q) ||
      (r.invoiceNo ?? '').toLowerCase().includes(q)
    )
  }, [rows, quickSearch])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function pageNums() {
    const all = Array.from({ length: totalPages }, (_, i) => i + 1)
    if (totalPages <= 7) return all
    const near = all.filter(p => p <= 5 || Math.abs(p - page) <= 1)
    return [...new Set([...near.slice(0, 5)])]
  }

  return (
    <div className="lsrch-page">

      {/* ── Header ── */}
      <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>
          Referral Invoices — Draft &amp; Generated
          {prvCd && rows[0]?.prvNm && <span style={{ fontWeight: 400 }}> — {rows[0].prvNm}</span>}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {prvCd && (
            <button
              className="btn-gradient"
              onClick={() => {
                const p = new URLSearchParams({ prvCd })
                if (qpFromDt) p.set('fromDt', qpFromDt)
                if (qpUptoDt) p.set('uptoDt', qpUptoDt)
                navigate(`/accounts/referral-invoice/generate?${p.toString()}`)
              }}
            >
              <i className="fas fa-file-invoice"></i>&nbsp; Generate Invoice
            </button>
          )}
          <button className="btn-outline" onClick={() => navigate('/accounts/referral-invoice/dashboard')}>
            <i className="fas fa-arrow-left"></i>&nbsp; Back
          </button>
        </div>
      </div>

      {/* ── Search Filters card ── */}
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div className="lsrch-filter-panel">
          <div className="cbill-filter-grid">

            <div className="cbill-filter-item">
              <label className="cbill-label">Status</label>
              <select className="cbill-input" value={fStatus} onChange={e => setFStatus(e.target.value)}>
                <option value="">All</option>
                <option value="DRAFT">Draft</option>
                <option value="GENERATED">Generated</option>
                <option value="PARTIALLY_SETTLED">Partially Settled</option>
                <option value="SETTLED">Settled</option>
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
          {!prvCd && <Tile label="Providers" value={summary.providerCount} />}
          <Tile label="Cases Billed"         value={summary.casesBilled} />
          <Tile label="Invoice Raised"       value={summary.invoiceRaisedCount} color="#2e7d32" />
          <Tile label="Pending"              value={summary.pendingCount} color="#b26a00" />
          <Tile label="Settled"              value={summary.settledCount} />
          {prvCd && dashRow ? (
            <>
              <Tile label="Currency"             value={dashRow.currencyCd || '—'} />
              <Tile label="Invoice Raised Value" value={`${fmtAmt(dashRow.invoiceRaisedValueNative)} ${dashRow.currencyCd || ''}`} />
              <Tile label="Total Invoice Value"  value={`${fmtAmt(dashRow.totalInvoiceValueNative)} ${dashRow.currencyCd || ''}`} />
            </>
          ) : (
            <>
              <Tile label="Invoice Raised Value" value={`${fmtAmt(summary.invoiceRaisedValue)} USD`} />
              <Tile label="Total Invoice Value"  value={`${fmtAmt(summary.totalInvoiceValue)} USD`} />
            </>
          )}
        </div>
      )}

      {/* ── Referral Invoice List card ── */}
      <div className="panel-card">

        {/* Quick search bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#7a6690' }}>Search:</span>
            <input
              className="lsrch-table-search"
              placeholder="Quick search..."
              value={quickSearch}
              onChange={e => { setQuickSearch(e.target.value); setPage(1) }}
            />
          </div>
        </div>

        {error && <p className="lsrch-error" style={{ margin: '0 16px 8px' }}>{error}</p>}

        <div>
          <table className="lsrch-table cbill-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '5%'  }} />  {/* S.No. */}
              <col style={{ width: '20%' }} />  {/* Hospital Name */}
              <col style={{ width: '12%' }} />  {/* Invoice No */}
              <col style={{ width: '11%' }} />  {/* Invoice Date */}
              <col style={{ width: '9%'  }} />  {/* Status */}
              <col style={{ width: '12%' }} />  {/* Invoice Amt */}
              <col style={{ width: '12%' }} />  {/* Settled Amount */}
              <col style={{ width: '12%' }} />  {/* Shortfall Amount */}
              <col style={{ width: '11%' }} />  {/* Action */}
            </colgroup>
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Hospital Name</th>
                <th>Invoice No.</th>
                <th>Invoice Date</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th>Invoice Amt</th>
                <th>Settled Amount</th>
                <th>Shortfall Amount</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '28px 12px', color: '#888' }}>
                    <i className="fas fa-spinner fa-spin"></i>&nbsp; Loading...
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '28px 12px', color: '#888' }}>
                    <i className="fas fa-info-circle"></i>&nbsp; No records found.
                  </td>
                </tr>
              ) : pageRows.map((row, i) => (
                <tr key={row.id}>
                  <td className="lsrch-td-sno">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="lsrch-td-data">{row.prvNm}</td>
                  <td className="lsrch-td-data">{row.invoiceNo || '—'}</td>
                  <td className="lsrch-td-data">{row.invoiceDt || '—'}</td>
                  <td style={{ textAlign: 'center' }}><StatusBadge status={row.status} /></td>
                  <td className="lsrch-td-data cbill-amount">{fmtAmt(row.invoiceAmt)}</td>
                  <td className="lsrch-td-data cbill-amount">{fmtAmt(row.settledAmt)}</td>
                  <td className="lsrch-td-data cbill-amount">
                    {row.status === 'PARTIALLY_SETTLED'
                      ? <span style={{ color: '#c0392b' }}>{fmtAmt(row.shortfallAmt)}</span>
                      : row.status === 'SETTLED'
                      ? <span style={{ color: '#888' }}>—</span>
                      : fmtAmt(0)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {row.status === 'DRAFT' ? (
                      <button
                        className="cbl-invoice-btn"
                        onClick={() => navigate(`/accounts/referral-invoice/generate?prvCd=${encodeURIComponent(row.prvCd)}&invoiceNo=${encodeURIComponent(row.invoiceNo)}`)}
                      >
                        <i className="fas fa-pen"></i> Continue
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button
                          className="cbl-icon-btn"
                          title={row.settledAmt ? 'Update Settlement' : 'View / Settle'}
                          onClick={() => setSettleRow(row)}
                        >
                          <i className={row.settledAmt ? 'fas fa-hand-holding-usd' : 'fas fa-eye'}></i>
                        </button>
                        <button
                          className="cbl-icon-btn cbl-icon-btn-secondary"
                          title="Print"
                          onClick={() => {
                            fetchReferralInvoiceDetail(row.id).then(detail => {
                              const w = window.open('', '_blank')
                              w.document.write(buildPrintHtml(detail, row))
                              w.document.close()
                            })
                          }}
                        >
                          <i className="fas fa-print"></i>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="lsrch-bottom-bar" style={{ padding: '10px 16px' }}>
          <span style={{ fontSize: 12, color: '#888' }}>
            {filtered.length === 0
              ? 'No records found'
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} records`}
          </span>

          {totalPages > 1 && (
            <div className="lsrch-pagination">
              {pageNums().map(p => (
                <button key={p}
                  className={`lsrch-page-btn${page === p ? ' active' : ''}`}
                  onClick={() => setPage(p)}>{p}</button>
              ))}
              {totalPages > 5 && page < totalPages - 2 && (
                <span style={{ padding: '0 4px', color: '#888', fontSize: 12 }}>... {totalPages}</span>
              )}
              {page < totalPages && (
                <button className="lsrch-page-btn" onClick={() => setPage(p => Math.min(p + 1, totalPages))}>Next</button>
              )}
            </div>
          )}
        </div>

      </div>

      {settleRow && (
        <SettlementPopup
          row={settleRow}
          onClose={() => setSettleRow(null)}
          onSaved={() => { setSettleRow(null); load(); loadSummary() }}
        />
      )}
    </div>
  )
}
