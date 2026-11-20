import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAgents } from '../../utils/api'

const PAGE_SIZE = 15

const SEARCH_OPTIONS = [
  { value: 'agent_Nm',   label: 'Agent Name'  },
  { value: 'agent_Cd',   label: 'Agent Code'  },
  { value: 'email_Id',   label: 'Email'       },
  { value: 'mobile_No',  label: 'Mobile'      },
]

export default function AgentSearch() {
  const navigate = useNavigate()

  const [allRows,      setAllRows]      = useState([])
  const [searchBy,     setSearchBy]     = useState('agent_Nm')
  const [searchVal,    setSearchVal]    = useState('')
  const [rows,         setRows]         = useState([])
  const [loading,      setLoading]      = useState(false)
  const [searched,     setSearched]     = useState(false)
  const [error,        setError]        = useState('')
  const [tableSearch,  setTableSearch]  = useState('')
  const [page,         setPage]         = useState(1)

  // Load all agents on mount
  useEffect(() => { doSearch(true) }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  async function doSearch(initial = false) {
    setLoading(true)
    setError('')
    setTableSearch('')
    setPage(1)
    try {
      const filters = initial ? {} : buildFilters()
      const data = await fetchAgents(filters)
      setAllRows(data || [])
      setRows(data || [])
      setSearched(true)
    } catch {
      setError('Failed to load agents. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function buildFilters() {
    const val = searchVal.trim()
    if (!val) return {}
    return {
      agentCd:   searchBy === 'agent_Cd'  ? val : '',
      agentNm:   searchBy === 'agent_Nm'  ? val : '',
      email:     searchBy === 'email_Id'  ? val : '',
      mobile:    searchBy === 'mobile_No' ? val : '',
    }
  }

  function handleRefresh() {
    setSearchBy('agent_Nm')
    setSearchVal('')
    setTableSearch('')
    setPage(1)
    setError('')
    doSearch(true)
  }

  const filteredRows = useMemo(() => {
    if (!tableSearch.trim()) return rows
    const q = tableSearch.toLowerCase()
    return rows.filter(r =>
      r.agent_Cd?.toLowerCase().includes(q) ||
      r.agent_Nm?.toLowerCase().includes(q) ||
      r.email_Id?.toLowerCase().includes(q) ||
      r.mobile_No?.toLowerCase().includes(q)
    )
  }, [rows, tableSearch])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pageRows   = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const onKeyDown     = e => { if (e.key === 'Enter') doSearch() }
  const onTableSearch = e => { setTableSearch(e.target.value); setPage(1) }
  const searchByLabel = SEARCH_OPTIONS.find(o => o.value === searchBy)?.label ?? ''

  return (
    <div className="lsrch-page">

      {/* Gradient header banner */}
      <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>Agent Search</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-gradient" style={{ fontSize: 13, padding: '7px 16px' }}
            onClick={() => navigate('/agent/add-individual')}>
            <i className="fas fa-user-plus"></i>&nbsp; Add Individual Agent
          </button>
          <button className="btn-gradient" style={{ fontSize: 13, padding: '7px 16px' }}
            onClick={() => navigate('/agent/add-company')}>
            <i className="fas fa-building"></i>&nbsp; Add Company Agent
          </button>
        </div>
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
                  <th>Agent Code</th>
                  <th>Agent Name</th>
                  <th>Type</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>Edit</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr className="lsrch-state-row">
                    <td colSpan={7}>{loading ? 'Loading...' : 'No records found.'}</td>
                  </tr>
                ) : (
                  pageRows.map((r, idx) => (
                    <tr key={r.agent_Cd}>
                      <td className="lsrch-td-sno">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="lsrch-td-claim">{r.agent_Cd}</td>
                      <td className="lsrch-td-data">{r.agent_Nm}</td>
                      <td className="lsrch-td-status">
                        <span className={`lsrch-badge ${r.agent_Type === 'I' ? 'lsrch-badge-active' : 'lsrch-badge-pending'}`}>
                          {r.agent_Type === 'I' ? 'Individual' : r.agent_Type === 'C' ? 'Company' : r.agent_Type}
                        </span>
                      </td>
                      <td className="lsrch-td-data">{r.mobile_No}</td>
                      <td className="lsrch-td-data">{r.email_Id}</td>
                      <td>
                        <button className="lsrch-action-link lsrch-action-edit"
                          onClick={() => navigate(
                            r.agent_Type === 'I'
                              ? `/agent/edit-individual/${r.agent_Cd}`
                              : `/agent/edit-company/${r.agent_Cd}`
                          )}>
                          <i className="fas fa-file-medical"></i> Edit
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

    </div>
  )
}
