import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchEmployees } from '../../utils/api'

const PAGE_SIZE = 15

export default function EmployeeSearch() {
  const navigate = useNavigate()

  const [rows,        setRows]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [page,        setPage]        = useState(1)

  function load() {
    setLoading(true)
    setError('')
    fetchEmployees()
      .then(data => setRows(data || []))
      .catch(() => setError('Failed to load employees. Please try again.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filteredRows = useMemo(() => {
    if (!tableSearch.trim()) return rows
    const q = tableSearch.toLowerCase()
    return rows.filter(r =>
      r.fullNm?.toLowerCase().includes(q)      ||
      r.employeeCd?.toLowerCase().includes(q)  ||
      r.userNm?.toLowerCase().includes(q)      ||
      r.emailId?.toLowerCase().includes(q)     ||
      r.mobileNo?.toLowerCase().includes(q)    ||
      r.userGroupNm?.toLowerCase().includes(q)
    )
  }, [rows, tableSearch])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pageRows   = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const onTableSearch = e => { setTableSearch(e.target.value); setPage(1) }

  return (
    <div className="lsrch-page">

      <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>Manage Employees</h2>
        <button className="btn-gradient" style={{ fontSize: 13, padding: '7px 16px' }}
          onClick={() => navigate('/admin/employees/add')}>
          <i className="fas fa-plus"></i>&nbsp; Add New
        </button>
      </div>

      <div className="lsrch-results-panel" style={{ marginTop: 0 }}>

        <div className="lsrch-table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>Search:</label>
            <input className="lsrch-table-search" type="text"
              value={tableSearch} onChange={onTableSearch}
              placeholder="Filter employees..." />
          </div>
          <button className="btn-outline" style={{ fontSize: 12, padding: '5px 14px' }}
            onClick={() => { setTableSearch(''); setPage(1); load() }}>
            <i className="fas fa-sync-alt"></i> Refresh
          </button>
        </div>

        {error && <p className="lsrch-error" style={{ margin: '8px 14px 0' }}>{error}</p>}

        <div className="lsrch-table-wrapper">
          <table className="lsrch-table">
            <thead>
              <tr>
                <th style={{ width: 55 }}>S.No</th>
                <th>Name</th>
                <th style={{ width: 80 }}>Gender</th>
                <th style={{ width: 110 }}>Date of Birth</th>
                <th>Username</th>
                <th>Email</th>
                <th style={{ width: 120 }}>Contact No.</th>
                <th>Group</th>
                <th style={{ width: 80 }}>Status</th>
                <th style={{ width: 70 }}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="lsrch-state-row">
                  <td colSpan={10}>
                    <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Loading...
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr className="lsrch-state-row">
                  <td colSpan={10}>No records found.</td>
                </tr>
              ) : pageRows.map((r, idx) => (
                <tr key={r.id}>
                  <td className="lsrch-td-sno">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                  <td className="lsrch-td-data" style={{ fontWeight: 500, color: '#2e1d55' }}>{r.fullNm}</td>
                  <td className="lsrch-td-data">{r.gender}</td>
                  <td className="lsrch-td-data">{r.dob}</td>
                  <td className="lsrch-td-data">{r.userNm}</td>
                  <td className="lsrch-td-data">{r.emailId}</td>
                  <td className="lsrch-td-data">{r.mobileNo}</td>
                  <td className="lsrch-td-data">{r.userGroupNm}</td>
                  <td>
                    <span className={`lsrch-badge ${r.actvInd === 1 ? 'lsrch-badge-active' : 'lsrch-badge-pending'}`}>
                      {r.actvInd === 1 ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button className="lsrch-action-link lsrch-action-edit" title="Edit Employee"
                      onClick={() => navigate(`/admin/employees/edit/${r.id}`, { state: { employeeCd: r.employeeCd } })}>
                      <i className="fas fa-edit"></i> Edit
                    </button>
                  </td>
                </tr>
              ))}
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
                .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push('…'); acc.push(p); return acc }, [])
                .map((p, i) => p === '…'
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
