import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchReferralInvoiceList } from '../../utils/api'

const PAGE_SIZE = 10

function fmtAmt(n) {
  return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CaseBillReferral() {
  const navigate = useNavigate()

  /* ── Filter state ── */
  const [fHospitalNm, setFHospitalNm] = useState('')
  const [fFromDt,     setFFromDt]     = useState('')
  const [fUptoDt,     setFUptoDt]     = useState('')

  /* ── Table state ── */
  const [rows,        setRows]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [quickSearch, setQuickSearch] = useState('')
  const [page,        setPage]        = useState(1)

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function load(filters = {}) {
    setLoading(true)
    setError('')
    fetchReferralInvoiceList(filters)
      .then(setRows)
      .catch(() => setError('Failed to load referral case bills. Please try again.'))
      .finally(() => setLoading(false))
  }

  function handleSearch() {
    load({ hospitalNm: fHospitalNm, fromDt: fFromDt, uptoDt: fUptoDt })
    setPage(1)
  }

  function handleRefresh() {
    setFHospitalNm(''); setFFromDt(''); setFUptoDt('')
    setQuickSearch(''); setPage(1)
    load()
  }

  const filtered = useMemo(() => {
    if (!quickSearch.trim()) return rows
    const q = quickSearch.toLowerCase()
    return rows.filter(r => (r.prvNm ?? '').toLowerCase().includes(q))
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
        <h2>Case Bill Referral</h2>
        <button className="btn-outline" onClick={() => navigate('/accounts/referral-invoice/list')}>
          <i className="fas fa-list"></i>&nbsp; View All Referral Invoices
        </button>
      </div>

      {/* ── Search Filters card ── */}
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div className="lsrch-filter-panel">
          <div className="cbill-filter-grid">

            <div className="cbill-filter-item">
              <label className="cbill-label">Hospital Name</label>
              <input className="cbill-input" placeholder="Enter hospital name"
                value={fHospitalNm} onChange={e => setFHospitalNm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>

            <div className="cbill-filter-item">
              <label className="cbill-label">Invoice Date From</label>
              <input className="cbill-input" type="date"
                value={fFromDt} onChange={e => setFFromDt(e.target.value)} />
            </div>

            <div className="cbill-filter-item">
              <label className="cbill-label">Invoice Date Upto</label>
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

      {/* ── Case Bill Referral List card ── */}
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
              <col style={{ width: '6%'  }} />  {/* S.No. */}
              <col style={{ width: '34%' }} />  {/* Hospital Name */}
              <col style={{ width: '16%' }} />  {/* No. of Claims */}
              <col style={{ width: '18%' }} />  {/* Bill Amount */}
              <col style={{ width: '11%' }} />  {/* Referral % */}
              <col style={{ width: '15%' }} />  {/* Generate Invoice */}
            </colgroup>
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Hospital Name</th>
                <th style={{ textAlign: 'center' }}>No. of Claims</th>
                <th>Bill Amount</th>
                <th style={{ textAlign: 'center' }}>Referral %</th>
                <th style={{ textAlign: 'center' }}>Generate Invoice</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '28px 12px', color: '#888' }}>
                    <i className="fas fa-spinner fa-spin"></i>&nbsp; Loading...
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '28px 12px', color: '#888' }}>
                    <i className="fas fa-info-circle"></i>&nbsp; No records found.
                  </td>
                </tr>
              ) : pageRows.map((row, i) => (
                <tr key={row.prvCd}>
                  <td className="lsrch-td-sno">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="lsrch-td-data">{row.prvNm}</td>
                  <td style={{ textAlign: 'center' }}>{row.ctr}</td>
                  <td className="lsrch-td-data cbill-amount">{fmtAmt(row.billAmount)}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: '#632da7' }}>{row.referralPrc}%</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="cbl-invoice-btn"
                      onClick={() => {
                        const p = new URLSearchParams({ prvCd: row.prvCd })
                        if (fFromDt) p.set('fromDt', fFromDt)
                        if (fUptoDt) p.set('uptoDt', fUptoDt)
                        navigate(`/accounts/referral-invoice/list?${p.toString()}`)
                      }}
                    >
                      <i className="fas fa-file-invoice"></i> Generate Invoice
                    </button>
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
    </div>
  )
}
