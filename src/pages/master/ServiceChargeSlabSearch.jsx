import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { serviceChargeSlabApi } from '../../utils/api'

const PAGE_SIZE = 15

const CALC_TYPE_LABEL = {
  FLAT:            'Flat',
  PERCENT:         'Percent',
  PERCENT_CAPPED:  'Percent (Capped)',
}

export default function ServiceChargeSlabSearch() {
  const navigate = useNavigate()

  const [allRows,     setAllRows]     = useState([])
  const [tableSearch, setTableSearch] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [page,        setPage]        = useState(1)

  useEffect(() => { load() }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await serviceChargeSlabApi({ mode: 'R' })
      setAllRows(res?.slabs ?? [])
    } catch {
      setError('Failed to load service charge slabs. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const filteredRows = useMemo(() => {
    if (!tableSearch.trim()) return allRows
    const q = tableSearch.toLowerCase()
    return allRows.filter(r =>
      (r.insurerNm       ?? '').toLowerCase().includes(q) ||
      (r.insurerCd       ?? '').toLowerCase().includes(q) ||
      (r.countryNm       ?? '').toLowerCase().includes(q) ||
      (r.treatmentTypeCd ?? '').toLowerCase().includes(q) ||
      (r.currencyCd      ?? '').toLowerCase().includes(q)
    )
  }, [allRows, tableSearch])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pageRows   = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="lsrch-page">

      <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2><i className="fas fa-percent" style={{ marginRight: 10 }}></i>View / Manage Service Charge Slabs</h2>
        <button className="btn-gradient" style={{ fontSize: 13, padding: '7px 16px' }}
          onClick={() => navigate('/master/service-charge-slab/add')}>
          <i className="fas fa-plus"></i>&nbsp; Add New
        </button>
      </div>

      <div className="lsrch-results-panel">

        <div className="lsrch-table-toolbar">
          <label>Search:</label>
          <input className="lsrch-table-search" type="text"
            value={tableSearch}
            onChange={e => { setTableSearch(e.target.value); setPage(1) }}
            placeholder="Filter by insurer, country, treatment type, currency..." />
        </div>

        {error && <p className="lsrch-error">{error}</p>}

        <div className="lsrch-table-wrapper">
          <table className="lsrch-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Insurer</th>
                <th>Country</th>
                <th>Treatment</th>
                <th>Min Amt</th>
                <th>Max Amt</th>
                <th>Calc Type</th>
                <th>Currency</th>
                <th style={{ width: 100 }}>Status</th>
                <th>Edit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="lsrch-state-row"><td colSpan={10}>Loading…</td></tr>
              ) : pageRows.length === 0 ? (
                <tr className="lsrch-state-row"><td colSpan={10}>No records found.</td></tr>
              ) : (
                pageRows.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="lsrch-td-sno">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="lsrch-td-data">{r.insurerNm || r.insurerCd}</td>
                    <td className="lsrch-td-data">{r.countryNm || 'Default (any)'}</td>
                    <td className="lsrch-td-data">{r.treatmentTypeCd}</td>
                    <td className="lsrch-td-data">{Number(r.minAmt).toLocaleString()}</td>
                    <td className="lsrch-td-data">{r.maxAmt != null ? Number(r.maxAmt).toLocaleString() : 'No limit'}</td>
                    <td className="lsrch-td-data">{CALC_TYPE_LABEL[r.calcType] || r.calcType}</td>
                    <td className="lsrch-td-data">{r.currencyCd}</td>
                    <td>
                      <span className={`lsrch-badge ${r.actvInd === 1 ? 'lsrch-badge-active' : 'lsrch-badge-pending'}`}>
                        {r.actvInd === 1 ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button className="lsrch-action-link lsrch-action-edit"
                        onClick={() => navigate(`/master/service-charge-slab/edit/${r.id}`)}>
                        <i className="fas fa-edit"></i> Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="lsrch-bottom-bar">
          <span>
            {filteredRows.length === 0
              ? 'No records found'
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filteredRows.length)} of ${filteredRows.length} records`}
          </span>

          {totalPages > 1 && (
            <div className="lsrch-pagination">
              <button className="lsrch-page-btn" onClick={() => setPage(1)}          disabled={page === 1}>&laquo;</button>
              <button className="lsrch-page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>&lsaquo;</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) acc.push('…')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === '…'
                    ? <span key={`e${i}`} style={{ padding: '0 4px', color: '#888' }}>…</span>
                    : <button key={p} className={`lsrch-page-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                )}
              <button className="lsrch-page-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>&rsaquo;</button>
              <button className="lsrch-page-btn" onClick={() => setPage(totalPages)}  disabled={page === totalPages}>&raquo;</button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
