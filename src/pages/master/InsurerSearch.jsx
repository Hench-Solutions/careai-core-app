import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchInsurers, saveInsurer } from '../../utils/api'

function ConfirmModal({ message, onOk, onCancel }) {
  return (
    <div className="csm-overlay" onClick={onCancel}>
      <div className="confirm-modal-box" onClick={e => e.stopPropagation()}>
        <div className="confirm-modal-body">
          <i className="fas fa-question-circle confirm-modal-icon"></i>
          <p>{message}</p>
        </div>
        <div className="confirm-modal-footer">
          <button className="confirm-btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="confirm-btn-ok"     onClick={onOk}>OK</button>
        </div>
      </div>
    </div>
  )
}

const PAGE_SIZE = 15

const SEARCH_OPTIONS = [
  { value: 'insurer_Nm',   label: 'Insurer Name'   },
  { value: 'insurer_Cd',   label: 'Insurer Code'   },
  { value: 'prefix_Code',  label: 'Prefix Code'    },
  { value: 'email_Id',     label: 'Email'          },
]

export default function InsurerSearch() {
  const navigate = useNavigate()

  const [deleting,    setDeleting]    = useState('')
  const [confirmCd,   setConfirmCd]   = useState('')
  const [allRows,     setAllRows]     = useState([])
  const [searchBy,    setSearchBy]    = useState('insurer_Nm')
  const [searchVal,   setSearchVal]   = useState('')
  const [rows,        setRows]        = useState([])
  const [loading,     setLoading]     = useState(false)
  const [searched,    setSearched]    = useState(false)
  const [error,       setError]       = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [page,        setPage]        = useState(1)

  useEffect(() => { doSearch(true) }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmDelete() {
    const insurerCd = confirmCd
    setConfirmCd('')
    setDeleting(insurerCd)
    try {
      await saveInsurer({ mode: 'D', insurerCd })
      setRows(prev => prev.filter(r => r.insurer_Cd !== insurerCd))
      setAllRows(prev => prev.filter(r => r.insurer_Cd !== insurerCd))
    } catch {
      setError('Failed to delete insurer. Please try again.')
    } finally {
      setDeleting('')
    }
  }

  async function doSearch(initial = false) {
    setLoading(true)
    setError('')
    setTableSearch('')
    setPage(1)
    try {
      const filters = initial ? {} : buildFilters()
      const data = await fetchInsurers(filters)
      setAllRows(data || [])
      setRows(data || [])
      setSearched(true)
    } catch {
      setError('Failed to load insurers. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function buildFilters() {
    const val = searchVal.trim()
    if (!val) return {}
    return {
      insurerCd:  searchBy === 'insurer_Cd'  ? val : '',
      insurerNm:  searchBy === 'insurer_Nm'  ? val : '',
      prefixCode: searchBy === 'prefix_Code' ? val : '',
      email:      searchBy === 'email_Id'    ? val : '',
    }
  }

  function handleRefresh() {
    setSearchBy('insurer_Nm')
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
      r.insurer_Cd?.toLowerCase().includes(q) ||
      r.insurer_Nm?.toLowerCase().includes(q) ||
      r.ins_Prefix_Cd?.toLowerCase().includes(q) ||
      r.email_Id?.toLowerCase().includes(q)
    )
  }, [rows, tableSearch])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pageRows   = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const fmtDate = v => {
    if (!v) return ''
    const d = new Date(v)
    if (isNaN(d)) return v
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
  }

  const onKeyDown     = e => { if (e.key === 'Enter') doSearch() }
  const onTableSearch = e => { setTableSearch(e.target.value); setPage(1) }
  const searchByLabel = SEARCH_OPTIONS.find(o => o.value === searchBy)?.label ?? ''

  return (
    <div className="lsrch-page">

      {confirmCd && (
        <ConfirmModal
          message={`Are you sure you want to delete insurer ${confirmCd}? This action cannot be undone.`}
          onOk={confirmDelete}
          onCancel={() => setConfirmCd('')}
        />
      )}

      <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2><i className="fas fa-shield-alt" style={{ marginRight: 10 }}></i>View / Manage Insurer</h2>
        <button className="btn-gradient" style={{ fontSize: 13, padding: '7px 16px' }}
          onClick={() => navigate('/master/insurer/add')}>
          <i className="fas fa-plus"></i>&nbsp; Add New
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
                  <th>Insurer Code</th>
                  <th>Insurer Name</th>
                  <th>Prefix Code</th>
                  <th>Currency Code</th>
                  <th>Exchange Rate</th>
                  <th>Address</th>
                  <th>Agreement Signed Date</th>
                  <th>Agreement End Date</th>
                  <th>Email Id</th>
                  <th>Status</th>
                  <th>Edit</th>
                  <th>Delete</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr className="lsrch-state-row">
                    <td colSpan={13}>{loading ? 'Loading...' : 'No records found.'}</td>
                  </tr>
                ) : (
                  pageRows.map((r, idx) => (
                    <tr key={r.insurer_Cd}>
                      <td className="lsrch-td-sno">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="lsrch-td-claim">{r.insurer_Cd}</td>
                      <td className="lsrch-td-data">{r.insurer_Nm}</td>
                      <td className="lsrch-td-data">{r.ins_Prefix_Cd}</td>
                      <td className="lsrch-td-data">{r.currency_Cd}</td>
                      <td className="lsrch-td-data">{r.exchange_Rt}</td>
                      <td className="lsrch-td-data">{r.address}</td>
                      <td className="lsrch-td-data">{fmtDate(r.agreement_StartDt)}</td>
                      <td className="lsrch-td-data">{fmtDate(r.agreement_EndDt)}</td>
                      <td className="lsrch-td-data">{r.email_Id}</td>
                      <td className="lsrch-td-status">
                        <span className={`lsrch-badge ${r.actv_Ind === 1 ? 'lsrch-badge-active' : 'lsrch-badge-pending'}`}>
                          {r.actv_Ind === 1 ? 'Active' : 'De-Active'}
                        </span>
                      </td>
                      <td>
                        <button className="lsrch-action-link lsrch-action-edit"
                          onClick={() => navigate(`/master/insurer/edit/${r.insurer_Cd}`)}>
                          <i className="fas fa-edit"></i> Edit
                        </button>
                      </td>
                      <td>
                        <button className="lsrch-action-link" style={{ color: '#e74c3c' }}
                          disabled={deleting === r.insurer_Cd}
                          onClick={() => setConfirmCd(r.insurer_Cd)}>
                          {deleting === r.insurer_Cd
                            ? <i className="fas fa-spinner fa-spin"></i>
                            : <i className="fas fa-trash"></i>}
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
