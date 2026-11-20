import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchLeadSearch } from '../../utils/api'
import { authUtils } from '../../utils/auth'
import CaseNotesModal from './CaseNotesModal'
import CaseDocumentModal from './CaseDocumentModal'
import CommunicationLogModal from '../../components/CommunicationLogModal'

const PAGE_SIZE = 15

const SEARCH_OPTIONS = [
  { value: 'Name',      label: 'Member Name' },
  { value: 'Email_Id',  label: 'Email Id' },
  { value: 'Member_Id', label: 'Reference No.' },
]

/* ── Role helpers ─────────────────────────────────────────────────────────
   Group 22 → data-entry / supervisor → Edit column visible
   Group 23 → Case Manager            → Action column visible, own cases only
   Others   → show both (admin / super user)
─────────────────────────────────────────────────────────────────────────── */
function getRoleFlags(user) {
  const gid   = Number(user?.User_Group_Id ?? 0)
  const empCd = user?.Employee_Cd ?? ''
  if (gid === 22) return { showEdit: true,  showAction: false, filterOwn: false, empCd }
  if (gid === 23) return { showEdit: false, showAction: true,  filterOwn: true,  empCd }
  return           { showEdit: true,  showAction: true,  filterOwn: false, empCd }
}

function CategoryBadge({ category }) {
  if (!category || category === 'Normal') return null
  const cls = category === 'Emergency'
    ? 'lsrch-badge lsrch-badge-emergency'
    : 'lsrch-badge lsrch-badge-priority'
  return <span className={cls}>{category}</span>
}

export default function LeadSearch() {
  const navigate = useNavigate()
  const user     = authUtils.getUser()
  const role     = getRoleFlags(user)

  const [searchBy,     setSearchBy]     = useState('Name')
  const [searchVal,    setSearchVal]    = useState('')
  const [rows,         setRows]         = useState([])
  const [loading,      setLoading]      = useState(false)
  const [searched,     setSearched]     = useState(false)
  const [error,        setError]        = useState('')
  const [tableSearch,  setTableSearch]  = useState('')
  const [page,         setPage]         = useState(1)
  const [notesTarget,  setNotesTarget]  = useState(null)  // { claimNo, memberId }
  const [docsTarget,   setDocsTarget]   = useState(null)  // { claimNo, memberId }
  const [commTarget,   setCommTarget]   = useState(null)  // { claimNo }

  /* ── Case-manager own-case filter then DataTables live search ── */
  const filteredRows = useMemo(() => {
    let data = role.filterOwn
      ? rows.filter(r => r.caseManagerCd === role.empCd)
      : rows

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase()
      data = data.filter(r =>
        r.claimNo?.toLowerCase().includes(q) ||
        r.memberName?.toLowerCase().includes(q) ||
        r.source?.toLowerCase().includes(q) ||
        r.treatmentType?.toLowerCase().includes(q) ||
        r.caseManager?.toLowerCase().includes(q) ||
        r.statusNm?.toLowerCase().includes(q)
      )
    }
    return data
  }, [rows, tableSearch, role])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const pageRows   = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const colSpan = 9 + (role.showEdit ? 2 : 0) + (role.showAction ? 1 : 0)

  /* ── Search ─────────────────────────────────────────────────── */
  const doSearch = useCallback(async () => {
    setLoading(true)
    setError('')
    setTableSearch('')
    setPage(1)
    try {
      const data = await fetchLeadSearch(searchBy, searchVal)
      setRows(data)
      setSearched(true)
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [searchBy, searchVal])

  /* ── Refresh ────────────────────────────────────────────────── */
  const doRefresh = () => {
    setSearchBy('Name')
    setSearchVal('')
    setTableSearch('')
    setPage(1)
    setError('')
    setLoading(true)
    fetchLeadSearch('Name', '').then(data => {
      setRows(data)
      setSearched(true)
    }).catch(() => setError('Search failed. Please try again.')).finally(() => setLoading(false))
  }

  // Load all leads on mount
  useEffect(() => { doSearch() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = e => { if (e.key === 'Enter') doSearch() }

  /* ── Reset to page 1 on tableSearch change ───────────────────── */
  const onTableSearch = e => { setTableSearch(e.target.value); setPage(1) }

  const searchByLabel = SEARCH_OPTIONS.find(o => o.value === searchBy)?.label ?? ''

  return (
    <div className="lsrch-page">
      {notesTarget && (
        <CaseNotesModal
          claimNo={notesTarget.claimNo}
          memberId={notesTarget.memberId}
          currentStatusCd={notesTarget.statusCd}
          onClose={() => setNotesTarget(null)}
          onStatusChanged={() => { doSearch(); setNotesTarget(null) }}
        />
      )}
      {docsTarget && (
        <CaseDocumentModal
          claimNo={docsTarget.claimNo}
          memberId={docsTarget.memberId}
          onClose={() => setDocsTarget(null)}
        />
      )}
      {commTarget && (
        <CommunicationLogModal
          claimNo={commTarget.claimNo}
          onClose={() => setCommTarget(null)}
        />
      )}

      {/* ── Gradient header banner ── */}
      <div className="page-header-banner">
        <h2>Search Lead</h2>
      </div>

      {/* ── Filter panel ── */}
      <div className="panel-card lsrch-filter-panel">

        <div className="lsrch-filter-row">
          {/* Search By */}
          <div className="lsrch-filter-group">
            <label>Search By:</label>
            <select value={searchBy} onChange={e => setSearchBy(e.target.value)}>
              {SEARCH_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Dynamic search value label + input */}
          <div className="lsrch-filter-group">
            <label>{searchByLabel}:</label>
            <input
              type="text"
              placeholder="Your text to search"
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
        </div>

        <hr className="lsrch-divider" />

        <div className="lsrch-btn-row">
          <button className="btn-gradient" onClick={doSearch} disabled={loading}>
            {loading
              ? <><span className="lsrch-spinner"></span>Searching...</>
              : <><i className="fas fa-search"></i> Search</>}
          </button>
          <button className="btn-outline" onClick={doRefresh}>
            Refresh
          </button>
        </div>

        {error && <p className="lsrch-error">{error}</p>}
      </div>

      {/* ── Results ── */}
      {searched && (
        <div className="lsrch-results-panel">

          {/* DataTables-style toolbar */}
          <div className="lsrch-table-toolbar">
            <label>Search:</label>
            <input
              className="lsrch-table-search"
              type="text"
              value={tableSearch}
              onChange={onTableSearch}
              placeholder="Filter results..."
            />
          </div>

          <div className="lsrch-table-wrapper">
            <table className="lsrch-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Treatment ID</th>
                  <th>Member Name</th>
                  <th>Source Name</th>
                  <th>Payee</th>
                  <th>Diagnosis</th>
                  <th>Case Manager</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Docs</th>
                  <th>Comm.</th>
                  {role.showEdit   && <th>Edit</th>}
                  {role.showEdit   && <th>Subset</th>}
                  {role.showAction && <th>Action</th>}
                </tr>
              </thead>

              <tbody>
                {pageRows.length === 0 ? (
                  <tr className="lsrch-state-row">
                    <td colSpan={colSpan}>
                      {loading ? 'Loading...' : 'No records found.'}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row, idx) => (
                    <tr key={row.claimNo}>
                      <td className="lsrch-td-sno">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="lsrch-td-claim">{row.claimNo}</td>
                      <td className="lsrch-td-data">
                        {row.memberName}
                        <CategoryBadge category={row.memberCategory} />
                      </td>
                      <td className="lsrch-td-data">{row.source}</td>
                      <td className="lsrch-td-data">{row.payee}</td>
                      <td className="lsrch-td-data">{row.treatmentType}</td>
                      <td className="lsrch-td-data">{row.caseManager}</td>
                      <td className="lsrch-td-status">{row.statusNm}</td>
                      <td>
                        <button
                          className="lsrch-action-link lsrch-action-notes"
                          title="Case Notes"
                          onClick={() => setNotesTarget({ claimNo: row.claimNo, memberId: row.memberId, statusCd: row.statusCd })}
                        >
                          <i className="fas fa-copy"></i>
                        </button>
                      </td>
                      <td>
                        <button
                          className="lsrch-action-link lsrch-action-notes"
                          title="Case Documents"
                          onClick={() => setDocsTarget({ claimNo: row.claimNo, memberId: row.memberId })}
                        >
                          <i className="fas fa-file-alt"></i>
                        </button>
                      </td>
                      <td>
                        <button
                          className="lsrch-action-link lsrch-action-notes"
                          title="Communication Log"
                          onClick={() => setCommTarget({ claimNo: row.claimNo })}
                        >
                          <i className="fas fa-envelope-open-text"></i>
                        </button>
                      </td>
                      {role.showEdit && (
                        <td>
                          <button
                            className="lsrch-action-link lsrch-action-edit"
                            title="Edit Lead"
                            onClick={() => navigate(`/lead/edit/${row.claimNo}`)}
                          >
                            <i className="fas fa-file-medical"></i> Edit
                          </button>
                        </td>
                      )}
                      {role.showEdit && (
                        <td>
                          {row.isRootClaim && (
                            <button
                              className="lsrch-action-link lsrch-action-edit"
                              title="Create Subset Claim"
                              onClick={() => navigate(`/lead/subset/${row.claimNo}`)}
                            >
                              <i className="fas fa-code-branch"></i> Subset
                            </button>
                          )}
                        </td>
                      )}
                      {role.showAction && (
                        <td>
                          <button
                            className="lsrch-action-link lsrch-action-action"
                            title="Open Lead Screen"
                            onClick={() => navigate(`/leads/actions?claimNo=${row.claimNo}`)}
                          >
                            <i className="fas fa-user-pen"></i> Action
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom bar: record count + pagination */}
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
