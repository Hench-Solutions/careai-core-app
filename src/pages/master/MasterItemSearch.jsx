import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { masterItemApi } from '../../utils/api'

const PAGE_SIZE = 20

export default function MasterItemSearch() {
  const navigate = useNavigate()

  const [itemTypes,   setItemTypes]   = useState([])
  const [fItemType,   setFItemType]   = useState('')
  const [fItemNm,     setFItemNm]     = useState('')

  const [allRows,     setAllRows]     = useState([])
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [page,        setPage]        = useState(1)

  useEffect(() => { load() }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  async function load(itemType = '') {
    setLoading(true)
    setError('')
    try {
      const res = await masterItemApi({ mode: 'R', itemType })
      setAllRows(res?.items ?? [])
      setItemTypes(res?.itemTypes ?? [])
    } catch {
      setError('Failed to load master items. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleSearch() {
    load(fItemType)
    setPage(1)
  }

  function handleRefresh() {
    setFItemType(''); setFItemNm('')
    setPage(1)
    load()
  }

  const filteredRows = useMemo(() => {
    if (!fItemNm.trim()) return allRows
    const q = fItemNm.toLowerCase()
    return allRows.filter(r => (r.itemNm ?? '').toLowerCase().includes(q))
  }, [allRows, fItemNm])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pageRows   = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="lsrch-page">

      <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2><i className="fas fa-sitemap" style={{ marginRight: 10 }}></i>View / Manage Master Items</h2>
        <button className="btn-gradient" style={{ fontSize: 13, padding: '7px 16px' }}
          onClick={() => navigate(`/master/master-item/add${fItemType ? `?itemType=${encodeURIComponent(fItemType)}` : ''}`)}>
          <i className="fas fa-plus"></i>&nbsp; Add New
        </button>
      </div>

      {/* Filter panel */}
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div className="lsrch-filter-panel">
          <div className="cbill-filter-grid">
            <div className="cbill-filter-item">
              <label className="cbill-label">Item Type</label>
              <input className="cbill-input" list="item-type-options" placeholder="-- All types --"
                value={fItemType} onChange={e => setFItemType(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
              <datalist id="item-type-options">
                {itemTypes.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="cbill-filter-item">
              <label className="cbill-label">Item Name</label>
              <input className="cbill-input" placeholder="Filter by name..."
                value={fItemNm} onChange={e => setFItemNm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
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

      <div className="lsrch-results-panel">
        {error && <p className="lsrch-error">{error}</p>}

        <div className="lsrch-table-wrapper">
          <table className="lsrch-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Item Type</th>
                <th>Item Code</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Parent Item Code</th>
                <th>Remarks</th>
                <th>User Code</th>
                <th>Active</th>
                <th>Add Child</th>
                <th>Edit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="lsrch-state-row"><td colSpan={11}>Loading…</td></tr>
              ) : pageRows.length === 0 ? (
                <tr className="lsrch-state-row"><td colSpan={11}>No records found.</td></tr>
              ) : (
                pageRows.map((r, idx) => {
                  const isRoot = !r.parentItemCd
                  return (
                    <tr key={r.id}>
                      <td className="lsrch-td-sno">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="lsrch-td-data">{r.itemType}</td>
                      <td className="lsrch-td-claim">{r.itemCd}</td>
                      <td className="lsrch-td-data">{r.itemNm}</td>
                      <td className="lsrch-td-data">{r.itemCatg}</td>
                      <td className="lsrch-td-data">{r.parentItemCd}</td>
                      <td className="lsrch-td-data">{r.itemRemarks}</td>
                      <td className="lsrch-td-data">{r.itemUsrCd}</td>
                      <td>
                        <span className={`lsrch-badge ${r.actvInd === 1 ? 'lsrch-badge-active' : 'lsrch-badge-inactive'}`}>
                          {r.actvInd === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        {isRoot && (
                          <button className="lsrch-action-link lsrch-action-edit"
                            title="Add child under this item"
                            onClick={() => navigate(`/master/master-item/add?itemType=${encodeURIComponent(r.itemType)}&parentItemCd=${encodeURIComponent(r.itemCd)}`)}>
                            <i className="fas fa-plus"></i>
                          </button>
                        )}
                      </td>
                      <td>
                        <button className="lsrch-action-link lsrch-action-edit"
                          onClick={() => navigate(`/master/master-item/edit/${r.id}`)}>
                          <i className="fas fa-edit"></i> Edit
                        </button>
                      </td>
                    </tr>
                  )
                })
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
