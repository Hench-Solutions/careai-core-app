import { useState } from 'react'
import { searchMembers } from '../utils/api'

/**
 * SearchMemberModal — reusable member/patient search popup.
 *
 * Props:
 *   onClose()         — called when modal is dismissed
 *   onSelect(member)  — called with the selected member row
 *                       { memberId, fullName, mobileNo, email, nationalId }
 */
export default function SearchMemberModal({ onClose, onSelect }) {
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

  return (
    <div className="csm-overlay" onClick={onClose}>
      <div className="ms-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="ms-modal-header">
          <span><i className="fas fa-search"></i> Search Member / Patient</span>
          <button className="ms-modal-close" onClick={onClose}>&times;</button>
        </div>

        {/* Search filters — separate field per option */}
        <div className="ms-modal-filters">
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

        {error && <div className="ms-modal-error">{error}</div>}

        {/* Results table */}
        <div className="ms-modal-table-wrap">
          <table className="ms-table">
            <thead>
              <tr>
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
                <tr><td colSpan={6} className="ms-table-empty">Enter search criteria and click Search</td></tr>
              )}
              {results !== null && results.length === 0 && (
                <tr><td colSpan={6} className="ms-table-empty">No records found</td></tr>
              )}
              {results !== null && results.map((row, i) => (
                <tr key={i}>
                  <td>{row.memberId   || '—'}</td>
                  <td>{row.fullName   || '—'}</td>
                  <td>{row.mobileNo   || '—'}</td>
                  <td>{row.email      || '—'}</td>
                  <td>{row.nationalId || '—'}</td>
                  <td>
                    <button className="ms-select-btn" title="Select"
                      onClick={() => { onSelect(row); onClose() }}>
                      <i className="fas fa-check"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer note */}
        <div className="ms-modal-footer-note">
          Select a member to automatically fill the patient registration details.
        </div>

      </div>
    </div>
  )
}
