import { useState, useEffect, useRef } from 'react'
import { codeSearch } from '../utils/api'

/**
 * CodeSearchModal — reusable ICD / CPT / DRG search popup.
 * Mirrors SearchICD.aspx / SearchCPT.aspx / SearchDRG.aspx from Med_Tour.
 *
 * Props:
 *   type          'ICD' | 'CPT' | 'DRG'
 *   defaultSearch  initial search term (pre-filled from parent field value)
 *   onSelect(cd, nm)  called when user picks a row
 *   onClose()         called to dismiss without selecting
 */
export default function CodeSearchModal({ type, defaultSearch = '', onSelect, onClose }) {
  const [query,    setQuery]    = useState(defaultSearch)
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef(null)

  const titles = { ICD: 'ICD Code Search', CPT: 'CPT Code Search', DRG: 'DRG Code Search' }
  const codeLbl = { ICD: 'ICD Code', CPT: 'CPT Code', DRG: 'DRG Code' }
  const descLbl = { ICD: 'ICD Description', CPT: 'CPT Description', DRG: 'DRG Description' }

  // Auto-search on open if defaultSearch provided
  useEffect(() => {
    inputRef.current?.focus()
    if (defaultSearch.trim()) runSearch(defaultSearch.trim())
  }, [])

  async function runSearch(q) {
    if (!q.trim()) return
    setLoading(true)
    setSearched(true)
    const items = await codeSearch(type, q)
    setResults(items)
    setLoading(false)
  }

  function handleSearch() { runSearch(query) }

  function handleKeyDown(e) {
    if (e.key === 'Enter') runSearch(query)
  }

  function handleSelect(item) {
    onSelect(item.cd, item.nm)
    onClose()
  }

  return (
    <div className="csm-overlay" onClick={onClose}>
      <div className="csm-box" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="csm-header">
          <span><i className="fas fa-search"></i>&nbsp; {titles[type]}</span>
          <button className="csm-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>

        {/* Search bar */}
        <div className="csm-search-bar">
          <input
            ref={inputRef}
            className="csm-input"
            placeholder={`Search by ${codeLbl[type]} or ${descLbl[type]}...`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="csm-search-btn" onClick={handleSearch} disabled={loading}>
            {loading
              ? <i className="fas fa-spinner fa-spin"></i>
              : <><i className="fas fa-search"></i> Search</>
            }
          </button>
        </div>

        {/* Results */}
        <div className="csm-results">
          {!searched && (
            <p className="csm-hint">Enter a search term and press Search.</p>
          )}
          {searched && !loading && results.length === 0 && (
            <p className="csm-hint">No records found.</p>
          )}
          {results.length > 0 && (
            <table className="csm-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>{codeLbl[type]}</th>
                  <th>{descLbl[type]}</th>
                  <th style={{ width: 70 }}>Select</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item, i) => (
                  <tr key={i} className="csm-row" onClick={() => handleSelect(item)}>
                    <td>{i + 1}</td>
                    <td><strong>{item.cd}</strong></td>
                    <td>{item.nm}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="csm-select-btn"
                        onClick={e => { e.stopPropagation(); handleSelect(item) }}
                        title="Select"
                      >
                        <i className="fas fa-check"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}
