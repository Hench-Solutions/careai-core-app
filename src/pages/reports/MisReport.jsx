import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchMisReport, downloadMisReport } from '../../utils/api'

/**
 * Generic MIS report page — reached via Page Master menu entries, each pointing
 * here with its own ?reportCode=. Title, which filters to show, and the result
 * columns all come from the SP (USP_Get_MISReport) response — nothing about a
 * specific report is hardcoded here, so adding a new report needs no frontend
 * change, only a new IF block in the SP.
 */
export default function MisReport() {
  const [searchParams] = useSearchParams()
  const reportCode = searchParams.get('reportCode') || ''

  const [fFromDt,   setFFromDt]   = useState('')
  const [fToDt,     setFToDt]     = useState('')
  const [fClaimNo,  setFClaimNo]  = useState('')
  const [fMemberId, setFMemberId] = useState('')

  const [meta,    setMeta]    = useState(null)
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => { load() }, [reportCode]) // eslint-disable-line react-hooks/exhaustive-deps

  function load() {
    if (!reportCode) { setError('No report selected.'); setLoading(false); return }
    setLoading(true)
    setError('')
    fetchMisReport(reportCode, { fromDt: fFromDt, toDt: fToDt, claimNo: fClaimNo, memberId: fMemberId })
      .then(result => {
        setMeta(result.meta)
        setRows(result.rows || [])
      })
      .catch(err => setError(err.message || 'Failed to load the report. Please try again.'))
      .finally(() => setLoading(false))
  }

  async function handleDownload() {
    try {
      await downloadMisReport(reportCode, { fromDt: fFromDt, toDt: fToDt, claimNo: fClaimNo, memberId: fMemberId })
    } catch {
      setError('Failed to download the report. Please try again.')
    }
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : []

  return (
    <div className="lsrch-page">

      <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>{meta?.reportTitle || 'MIS Report'}</h2>
      </div>

      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div className="lsrch-filter-panel">
          <div className="cbill-filter-grid">

            {meta?.showDateFilter && (
              <>
                <div className="cbill-filter-item">
                  <label className="cbill-label">From Date</label>
                  <input className="cbill-input" type="date" value={fFromDt} onChange={e => setFFromDt(e.target.value)} />
                </div>
                <div className="cbill-filter-item">
                  <label className="cbill-label">To Date</label>
                  <input className="cbill-input" type="date" value={fToDt} onChange={e => setFToDt(e.target.value)} />
                </div>
              </>
            )}

            {meta?.showClaimNoFilter && (
              <div className="cbill-filter-item">
                <label className="cbill-label">Claim No</label>
                <input className="cbill-input" value={fClaimNo} onChange={e => setFClaimNo(e.target.value)} />
              </div>
            )}

            {meta?.showMemberIdFilter && (
              <div className="cbill-filter-item">
                <label className="cbill-label">Member Id</label>
                <input className="cbill-input" value={fMemberId} onChange={e => setFMemberId(e.target.value)} />
              </div>
            )}

          </div>

          <div className="cbill-divider" />

          <div className="lsrch-btn-row">
            <button className="btn-gradient" onClick={load} disabled={loading}>
              <i className="fas fa-search"></i>&nbsp; {loading ? 'Loading…' : 'Search'}
            </button>
            <button className="btn-outline" onClick={handleDownload} disabled={loading || rows.length === 0}>
              <i className="fas fa-download"></i>&nbsp; Download
            </button>
          </div>
        </div>
      </div>

      {error && <div className="panel-card" style={{ color: '#b00020', marginBottom: 16 }}>{error}</div>}

      <div className="panel-card">
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center' }}>Loading report — this may take a moment for large date ranges…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>No records found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="lsrch-table">
              <thead>
                <tr>
                  {columns.map(col => <th key={col}>{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {columns.map(col => <td key={col}>{String(row[col] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
