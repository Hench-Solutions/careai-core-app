import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchProviders } from '../../utils/api'
import ProviderNoteModal from './ProviderNoteModal'

const PAGE_SIZE = 15

const SEARCH_OPTIONS = [
  { value: 'Prv_Nm',  label: 'Provider Name' },
  { value: 'Prv_Cd',  label: 'Provider Code' },
  { value: 'Country', label: 'Country' },
  { value: 'City',    label: 'City / District' },
]

export default function ProviderSearch() {
  const navigate = useNavigate()

  const [searchBy,    setSearchBy]    = useState('Prv_Nm')
  const [searchVal,   setSearchVal]   = useState('')
  const [rows,        setRows]        = useState([])
  const [loading,     setLoading]     = useState(false)
  const [searched,    setSearched]    = useState(false)
  const [error,       setError]       = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [page,        setPage]        = useState(1)
  const [noteModal,   setNoteModal]   = useState({ open: false, prvCd: '', statusCd: null })

  const filteredRows = useMemo(() => {
    if (!tableSearch.trim()) return rows
    const q = tableSearch.toLowerCase()
    return rows.filter(r =>
      r.prvCd?.toLowerCase().includes(q) ||
      r.prvNm?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.country?.toLowerCase().includes(q) ||
      r.city?.toLowerCase().includes(q) ||
      r.statusNm?.toLowerCase().includes(q)
    )
  }, [rows, tableSearch])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pageRows   = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function doSearch(by = searchBy, val = searchVal) {
    setLoading(true)
    setError('')
    setTableSearch('')
    setPage(1)
    try {
      const data = await searchProviders(by, val)
      setRows(data || [])
      setSearched(true)
    } catch {
      setError('Failed to load providers. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleRefresh() {
    setSearchBy('Prv_Nm')
    setSearchVal('')
    setTableSearch('')
    setPage(1)
    setError('')
    doSearch('Prv_Nm', '')
  }

  useEffect(() => { doSearch('Prv_Nm', '') }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = e => { if (e.key === 'Enter') doSearch() }
  const onTableSearch = e => { setTableSearch(e.target.value); setPage(1) }
  const searchByLabel = SEARCH_OPTIONS.find(o => o.value === searchBy)?.label ?? ''

  return (
    <div className="lsrch-page">

      {/* Gradient header banner */}
      <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>Provider Search</h2>
        <button className="btn-gradient" style={{ fontSize: 13, padding: '7px 16px' }}
          onClick={() => navigate('/provider/add')}>
          <i className="fas fa-plus"></i>&nbsp; Add Provider
        </button>
      </div>

      {/* Filter panel */}
      <div className="panel-card lsrch-filter-panel">
        <div className="lsrch-filter-row">
          <div className="lsrch-filter-group">
            <label>Search By:</label>
            <select value={searchBy} onChange={e => setSearchBy(e.target.value)}>
              {SEARCH_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="lsrch-filter-group">
            <label>{searchByLabel}:</label>
            <input type="text" placeholder="Your text to search"
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={onKeyDown} />
          </div>
        </div>

        <hr className="lsrch-divider" />

        <div className="lsrch-btn-row">
          <button className="btn-gradient" onClick={() => doSearch()} disabled={loading}>
            {loading
              ? <><span className="lsrch-spinner"></span>Searching...</>
              : <><i className="fas fa-search"></i> Search</>}
          </button>
          <button className="btn-outline" onClick={handleRefresh}>Refresh</button>
        </div>

        {error && <p className="lsrch-error">{error}</p>}
      </div>

      {/* Results */}
      {searched && (
        <div className="lsrch-results-panel">

          <div className="lsrch-table-toolbar">
            <label>Search:</label>
            <input className="lsrch-table-search" type="text"
              value={tableSearch} onChange={onTableSearch}
              placeholder="Filter results..." />
          </div>

          <div className="lsrch-table-wrapper">
            <table className="lsrch-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Provider Code</th>
                  <th>Provider Name</th>
                  <th>Email</th>
                  <th>Country</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Edit</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr className="lsrch-state-row">
                    <td colSpan={10}>{loading ? 'Loading...' : 'No records found.'}</td>
                  </tr>
                ) : (
                  pageRows.map((r, idx) => (
                    <tr key={r.prvCd}>
                      <td className="lsrch-td-sno">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="lsrch-td-claim">{r.prvCd}</td>
                      <td className="lsrch-td-data">{r.prvNm}</td>
                      <td className="lsrch-td-data">{r.email}</td>
                      <td className="lsrch-td-data">{r.country}</td>
                      <td className="lsrch-td-data">{r.city}</td>
                      <td className="lsrch-td-status">
                        <span className={`lsrch-badge ${
                          r.statusCd === 102 ? 'lsrch-badge-active' :
                          r.statusCd === 101 ? 'lsrch-badge-pending' :
                          'lsrch-badge-default'}`}>
                          {r.statusNm}
                        </span>
                      </td>
                      <td>
                        <button className="lsrch-action-link lsrch-action-notes"
                          title="Provider Notes"
                          onClick={() => setNoteModal({ open: true, prvCd: r.prvCd, statusCd: r.statusCd })}>
                          <i className="fas fa-sticky-note"></i> Note
                        </button>
                      </td>
                      <td>
                        <button className="lsrch-action-link lsrch-action-edit"
                          title="Edit Provider"
                          onClick={() => navigate(`/provider/edit/${r.prvCd}`)}>
                          <i className="fas fa-file-medical"></i> Edit
                        </button>
                      </td>
                      <td>
                        <button className="lsrch-action-link lsrch-action-action"
                          title="Send Contract"
                          onClick={() => navigate(`/provider/action?prvCd=${r.prvCd}`)}>
                          <i className="fas fa-paper-plane"></i> Send
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom bar */}
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
      )}
      {noteModal.open && (
        <ProviderNoteModal
          prvCd={noteModal.prvCd}
          currentStatusCd={noteModal.statusCd}
          onClose={() => setNoteModal({ open: false, prvCd: '', statusCd: null })}
          onSaved={() => doSearch()}
        />
      )}
    </div>
  )
}
