import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchPages } from '../../utils/api'

const PAGE_SIZE = 15

const LEVEL_CONFIG = {
  1: { mode: 'G', title: 'Manage Pages',         addLabel: 'Add Page' },
  2: { mode: 'S', title: 'Manage Sub Pages',      addLabel: 'Add Sub Page' },
  3: { mode: 'T', title: 'Manage Tertiary Pages', addLabel: 'Add Tertiary Page' }
}

export default function ManagePages({ level }) {
  const navigate    = useNavigate()
  const { parentId, subParentId } = useParams()

  // parentId used to query:  L2 uses parentId, L3 uses subParentId
  const queryParentId = level === 3 ? subParentId : parentId

  const cfg = LEVEL_CONFIG[level]

  const [rows,        setRows]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [page,        setPage]        = useState(1)

  function load() {
    setLoading(true)
    setError('')
    fetchPages(cfg.mode, queryParentId ?? null)
      .then(data => setRows(data || []))
      .catch(() => setError('Failed to load pages. Please try again.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [level, queryParentId])

  const filteredRows = useMemo(() => {
    if (!tableSearch.trim()) return rows
    const q = tableSearch.toLowerCase()
    return rows.filter(r =>
      r.pageTitle?.toLowerCase().includes(q) ||
      r.pageUrl?.toLowerCase().includes(q) ||
      r.actvInd?.toLowerCase().includes(q)
    )
  }, [rows, tableSearch])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pageRows   = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Navigation helpers
  function addUrl() {
    if (level === 1) return '/pagemanage/pages/add'
    if (level === 2) return `/pagemanage/pages/${parentId}/sub/add`
    return `/pagemanage/pages/${parentId}/sub/${subParentId}/tertiary/add`
  }
  function editUrl(id) {
    if (level === 1) return `/pagemanage/pages/edit/${id}`
    if (level === 2) return `/pagemanage/pages/${parentId}/sub/edit/${id}`
    return `/pagemanage/pages/${parentId}/sub/${subParentId}/tertiary/edit/${id}`
  }
  function backUrl() {
    if (level === 1) return null
    if (level === 2) return '/pagemanage/pages'
    return `/pagemanage/pages/${parentId}/sub`
  }
  function drillUrl(id) {
    if (level === 1) return `/pagemanage/pages/${id}/sub`
    if (level === 2) return `/pagemanage/pages/${parentId}/sub/${id}/tertiary`
    return null
  }

  const drillLabel  = level === 1 ? 'Sub Pages'      : level === 2 ? 'Tertiary Pages' : null
  const drillCount  = level === 1 ? 'subPageTotal'   : 'terPageTotal'

  return (
    <div className="lsrch-page">

      {/* Header */}
      <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {backUrl() && (
            <button className="btn-outline" style={{ fontSize: 12, padding: '5px 12px' }}
              onClick={() => navigate(backUrl())}>
              <i className="fas fa-arrow-left"></i>
            </button>
          )}
          <h2>{cfg.title}</h2>
        </div>
        <button className="btn-gradient" style={{ fontSize: 13, padding: '7px 16px' }}
          onClick={() => navigate(addUrl())}>
          <i className="fas fa-plus"></i>&nbsp; {cfg.addLabel}
        </button>
      </div>

      <div className="lsrch-results-panel" style={{ marginTop: 0 }}>

        {/* Toolbar */}
        <div className="lsrch-table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>Search:</label>
            <input className="lsrch-table-search" type="text"
              value={tableSearch}
              onChange={e => { setTableSearch(e.target.value); setPage(1) }}
              placeholder="Filter pages..." />
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
                <th>Page Title</th>
                <th>Page URL</th>
                <th style={{ width: 90 }}>Status</th>
                <th style={{ width: 70 }}>Order</th>
                <th style={{ width: 115 }}>Created Date</th>
                {drillLabel && <th style={{ width: 130 }}>{drillLabel}</th>}
                <th style={{ width: 70 }}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="lsrch-state-row">
                  <td colSpan={drillLabel ? 8 : 7}>
                    <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Loading...
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr className="lsrch-state-row">
                  <td colSpan={drillLabel ? 8 : 7}>No records found.</td>
                </tr>
              ) : pageRows.map((r, idx) => (
                <tr key={r.id}>
                  <td className="lsrch-td-sno">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                  <td className="lsrch-td-data" style={{ fontWeight: 500, color: '#2e1d55' }}>{r.pageTitle}</td>
                  <td className="lsrch-td-data" style={{ fontSize: 12, color: '#555' }}>{r.pageUrl}</td>
                  <td>
                    <span className={`lsrch-badge ${r.actvInd === 'Active' ? 'lsrch-badge-active' : 'lsrch-badge-pending'}`}>
                      {r.actvInd === 'Active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="lsrch-td-sno">{r.pageOrder}</td>
                  <td className="lsrch-td-data">{r.crtdDt}</td>
                  {drillLabel && (
                    <td>
                      <button className="lsrch-action-link" title={drillLabel}
                        onClick={() => navigate(drillUrl(r.id))}>
                        <i className="fas fa-layer-group"></i> {r[drillCount] ?? 0}
                      </button>
                    </td>
                  )}
                  <td>
                    <button className="lsrch-action-link lsrch-action-edit" title="Edit"
                      onClick={() => navigate(editUrl(r.id))}>
                      <i className="fas fa-edit"></i> Edit
                    </button>
                  </td>
                </tr>
              ))}
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
