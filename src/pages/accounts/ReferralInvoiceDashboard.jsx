import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchReferralInvoiceDashboard } from '../../utils/api'

function fmtAmt(n) {
  return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Tile({ label, value, color }) {
  return (
    <div className="panel-card" style={{ padding: '14px 16px', minWidth: 130, flex: '1 0 auto' }}>
      <div style={{ fontSize: 11, color: '#888', letterSpacing: 0.4, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || '#2e1d55', marginTop: 4, whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
}

/**
 * ReferralInvoiceDashboard — NEW page ("Billing Run" mockup), reached independently
 * of the existing CaseBillReferral.jsx (that page is untouched). Reuses the existing
 * /v1/Accounts/referral-invoice GET endpoint with mode=D — no new endpoint.
 *
 * Per client's scope for this page specifically:
 * - "Billing Run" is just the Search/refresh action — no persisted run/batch entity.
 * - "Billing Period" maps to the existing Invoice Date From/Upto range.
 * - "Provider Group" is just a provider-name filter (no provider-grouping master exists).
 * - "Currency Scope" is a placeholder for now — provider-level currency source is
 *   still being confirmed by the client separately.
 * - Pending/Settled tiles use MT_ReferralInvoice.Settled_Amt/Settled_Dt now that
 *   those columns exist. Readiness/MOU checks are intentionally not shown here
 *   (client: "not required as of now, can add at a later stage if required").
 * - No approval workflow / Export / Submit-for-approval here — those apply on the
 *   next page ("Screen B"), reached via the Action button, to be built separately.
 */
export default function ReferralInvoiceDashboard() {
  const navigate = useNavigate()

  const [fProviderNm, setFProviderNm] = useState('')
  const [fFromDt,     setFFromDt]     = useState('')
  const [fUptoDt,     setFUptoDt]     = useState('')

  const [summary, setSummary] = useState(null)
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function load() {
    setLoading(true)
    setError('')
    fetchReferralInvoiceDashboard({ fromDt: fFromDt, uptoDt: fUptoDt })
      .then(result => {
        setSummary(result?.summary ?? null)
        setRows(result?.rows ?? [])
      })
      .catch(() => setError('Failed to load the billing dashboard. Please try again.'))
      .finally(() => setLoading(false))
  }

  function handleRefresh() {
    setFProviderNm(''); setFFromDt(''); setFUptoDt('')
    load()
  }

  const filteredRows = fProviderNm.trim()
    ? rows.filter(r => r.prvNm.toLowerCase().includes(fProviderNm.trim().toLowerCase()))
    : rows

  return (
    <div className="lsrch-page">

      {/* ── Header ── */}
      <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Billing Run — Referral Invoice Dashboard</h2>
      </div>

      {/* ── Filters ── */}
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div className="lsrch-filter-panel">
          <div className="cbill-filter-grid">

            <div className="cbill-filter-item">
              <label className="cbill-label">Billing Period From</label>
              <input className="cbill-input" type="date" value={fFromDt} onChange={e => setFFromDt(e.target.value)} />
            </div>

            <div className="cbill-filter-item">
              <label className="cbill-label">Billing Period Upto</label>
              <input className="cbill-input" type="date" value={fUptoDt} onChange={e => setFUptoDt(e.target.value)} />
            </div>

            <div className="cbill-filter-item">
              <label className="cbill-label">Currency Scope</label>
              <select className="cbill-input" disabled title="Provider currency source — to be confirmed">
                <option>All (Multi-currency)</option>
              </select>
            </div>

            <div className="cbill-filter-item">
              <label className="cbill-label">Provider</label>
              <input className="cbill-input" placeholder="Filter by provider name"
                value={fProviderNm} onChange={e => setFProviderNm(e.target.value)} />
            </div>

          </div>

          <div className="cbill-divider" />

          <div className="lsrch-btn-row">
            <button className="btn-gradient" onClick={load}>
              <i className="fas fa-play"></i>&nbsp; Billing Run
            </button>
            <button className="btn-outline" onClick={handleRefresh}>
              <i className="fas fa-sync-alt"></i>&nbsp; Refresh
            </button>
          </div>
        </div>
      </div>

      {error && <p className="lsrch-error">{error}</p>}

      {/* ── Summary tiles ── */}
      {summary && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
          <Tile label="Providers"             value={summary.providerCount} />
          <Tile label="Cases Billed"          value={summary.casesBilled} />
          <Tile label="Invoice Raised"        value={summary.invoiceRaisedCount} color="#2e7d32" />
          <Tile label="Pending"               value={summary.pendingCount} color="#b26a00" />
          <Tile label="Settled"               value={summary.settledCount} />
          <Tile label="Invoice Raised Value"  value={`${fmtAmt(summary.invoiceRaisedValue)} USD`} />
          <Tile label="Total Invoice Value"   value={`${fmtAmt(summary.totalInvoiceValue)} USD`} />
        </div>
      )}
      {/* ── Provider grid ── */}
      <div className="panel-card" style={{ overflowX: 'auto' }}>
        <table className="lsrch-table" style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              <th>Provider</th>
              <th style={{ textAlign: 'center' }}>Cases</th>
              <th style={{ textAlign: 'center' }}>Invoice Raised</th>
              <th style={{ textAlign: 'center' }}>Invoice Pending</th>
              <th>Variance</th>
              <th>Raised Value (Native)</th>
              <th>Raised Value (USD)</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '28px 12px', color: '#888' }}>
                <i className="fas fa-spinner fa-spin"></i>&nbsp; Loading...
              </td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '28px 12px', color: '#888' }}>
                <i className="fas fa-info-circle"></i>&nbsp; No providers with billed cases.
              </td></tr>
            ) : filteredRows.map(r => {
              const variance = r.varianceAmt
              return (
                <tr key={r.prvCd}>
                  <td className="lsrch-td-data">{r.prvNm}</td>
                  <td style={{ textAlign: 'center' }}>{r.casesCount}</td>
                  <td style={{ textAlign: 'center' }}>{r.invoiceRaised}</td>
                  <td style={{ textAlign: 'center' }}>{r.invoicePending}</td>
                  <td style={{ color: variance < 0 ? '#c0392b' : variance > 0 ? '#27ae60' : '#555' }}>
                    {fmtAmt(variance)}
                  </td>
                  <td className="lsrch-td-data cbill-amount">{fmtAmt(r.invoiceRaisedValueNative)} {r.currencyCd}</td>
                  <td className="lsrch-td-data cbill-amount">
                    {r.invoiceRaisedValueUsd == null
                      ? <span title="USD rate unavailable for this currency" style={{ color: '#c0392b' }}><i className="fas fa-exclamation-triangle"></i>&nbsp;—</span>
                      : fmtAmt(r.invoiceRaisedValueUsd)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button
                        className="cbl-invoice-btn"
                        onClick={() => navigate(`/accounts/referral-invoice/generate?prvCd=${encodeURIComponent(r.prvCd)}`)}
                      >
                        <i className="fas fa-file-invoice"></i> Action
                      </button>
                      <button
                        className="cbl-invoice-btn"
                        onClick={() => navigate(`/accounts/referral-invoice/list?prvCd=${encodeURIComponent(r.prvCd)}`)}
                      >
                        <i className="fas fa-list"></i> View Invoices
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
