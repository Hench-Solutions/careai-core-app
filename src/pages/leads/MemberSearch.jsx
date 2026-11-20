import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchMembers } from '../../utils/api'

export default function MemberSearch() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ name: '', emailId: '', mobileNo: '', nationalId: '' })
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const set = (key, val) => setFilters(f => ({ ...f, [key]: val }))

  const handleSearch = async () => {
    const { name, emailId, mobileNo, nationalId } = filters
    if (!name.trim() && !emailId.trim() && !mobileNo.trim() && !nationalId.trim()) {
      setError('Please enter at least one search value.'); return
    }
    setError('')
    setLoading(true)
    try {
      const data = await searchMembers({
        name:       name.trim(),
        emailId:    emailId.trim(),
        mobileNo:   mobileNo.trim(),
        nationalId: nationalId.trim(),
      })
      setResults(data)
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = e => { if (e.key === 'Enter') handleSearch() }

  const handleSelect = member => {
    navigate('/lead', { state: { member } })
  }

  const handleNewLead = () => {
    navigate('/lead')
  }

  return (
    <div className="page-wrapper">
      <div className="page-card">

        {/* Page Header */}
        <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2><i className="fas fa-users" style={{ marginRight: 10 }}></i>Search Member / Patient</h2>
          <button className="btn-gradient" style={{ fontSize: 13, padding: '7px 16px' }} onClick={handleNewLead}>
            <i className="fas fa-plus"></i>&nbsp; New Lead (No Member)
          </button>
        </div>

        {/* Search Filters */}
        <div className="ms-modal-filters" style={{ padding: '16px 20px', borderBottom: '1px solid #eee' }}>
          <div className="ms-filter-field">
            <label>Name</label>
            <input placeholder="Enter name" value={filters.name}
              onChange={e => set('name', e.target.value)} onKeyDown={handleKeyDown} />
          </div>
          <div className="ms-filter-field">
            <label>Email ID</label>
            <input placeholder="Enter email ID" value={filters.emailId}
              onChange={e => set('emailId', e.target.value)} onKeyDown={handleKeyDown} />
          </div>
          <div className="ms-filter-field">
            <label>Mobile No</label>
            <input placeholder="Enter mobile no" value={filters.mobileNo}
              onChange={e => set('mobileNo', e.target.value)} onKeyDown={handleKeyDown} />
          </div>
          <div className="ms-filter-field">
            <label>National ID</label>
            <input placeholder="Enter national ID" value={filters.nationalId}
              onChange={e => set('nationalId', e.target.value)} onKeyDown={handleKeyDown} />
          </div>
          <div className="ms-filter-search">
            <button className="ms-search-btn" onClick={handleSearch} disabled={loading}>
              {loading
                ? <><i className="fas fa-spinner fa-spin"></i> Searching...</>
                : <><i className="fas fa-search"></i> Search</>}
            </button>
          </div>
        </div>

        {error && <div className="ms-modal-error" style={{ margin: '10px 20px' }}>{error}</div>}

        {/* Results Table */}
        <div className="ms-modal-table-wrap" style={{ padding: '0 20px 20px' }}>
          <table className="ms-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Member ID</th>
                <th>Full Name</th>
                <th>Mobile No</th>
                <th>Email Address</th>
                <th>National ID</th>
                <th>Select</th>
              </tr>
            </thead>
            <tbody>
              {results === null && (
                <tr><td colSpan={7} className="ms-table-empty">Enter search criteria and click Search</td></tr>
              )}
              {results !== null && results.length === 0 && (
                <tr><td colSpan={7} className="ms-table-empty">No records found</td></tr>
              )}
              {results !== null && results.map((row, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{row.memberId   || '—'}</td>
                  <td>{row.fullName   || '—'}</td>
                  <td>{row.mobileNo   || '—'}</td>
                  <td>{row.email      || '—'}</td>
                  <td>{row.nationalId || '—'}</td>
                  <td>
                    <button className="ms-select-btn" title="Proceed to Lead"
                      onClick={() => handleSelect(row)}>
                      <i className="fas fa-arrow-right"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
