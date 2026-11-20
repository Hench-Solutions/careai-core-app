import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchMisDashboard, downloadMisDashboardTile } from '../../utils/api'

// Icon per known tile key, falling back to a generic one — purely cosmetic,
// a dashboard with tile keys we haven't seen still renders fine.
const TILE_ICONS = {
  MEMBER: 'fas fa-user-plus',
  CLAIM:  'fas fa-briefcase-medical'
}
const TILE_ICON_CLASSES = ['purple', 'green', 'orange', 'blue']

/**
 * Generic MIS dashboard page — one load = one SP execution (meta + tiles +
 * every detail dataset). Tile count/labels come entirely from the SP's
 * Tiles result-set — nothing dashboard-specific is hardcoded here. Clicking
 * a tile filters its dataset client-side (same cache-then-filter behaviour
 * as the legacy Status-Wise MIS page); download re-runs the same filter on
 * the server only to produce the .xlsx, never to re-show the page.
 */
export default function MisDashboard() {
  const [searchParams] = useSearchParams()
  const reportCode = searchParams.get('reportCode') || ''

  const [fFromDt,   setFFromDt]   = useState('')
  const [fToDt,     setFToDt]     = useState('')
  const [fClaimNo,  setFClaimNo]  = useState('')
  const [fMemberId, setFMemberId] = useState('')

  const [meta,       setMeta]       = useState(null)
  const [tiles,      setTiles]      = useState([])
  const [datasets,   setDatasets]   = useState([])
  const [activeTile, setActiveTile] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')

  useEffect(() => { load() }, [reportCode]) // eslint-disable-line react-hooks/exhaustive-deps

  function load() {
    if (!reportCode) { setError('No dashboard selected.'); setLoading(false); return }
    setLoading(true)
    setError('')
    setActiveTile(null)
    fetchMisDashboard(reportCode, { fromDt: fFromDt, toDt: fToDt, claimNo: fClaimNo, memberId: fMemberId })
      .then(result => {
        setMeta(result.meta)
        setTiles(result.tiles || [])
        setDatasets(result.datasets || [])
      })
      .catch(err => setError(err.message || 'Failed to load the dashboard. Please try again.'))
      .finally(() => setLoading(false))
  }

  function handleTileClick(tile) {
    setActiveTile(tile)
  }

  async function handleDownload(tile) {
    try {
      await downloadMisDashboardTile(reportCode, {
        datasetIndex: tile.datasetIndex,
        filterColumn: tile.filterColumn || '',
        filterValue: tile.filterColumn ? tile.tileKey : '',
        fromDt: fFromDt, toDt: fToDt, claimNo: fClaimNo, memberId: fMemberId
      })
    } catch {
      setError('Failed to download. Please try again.')
    }
  }

  const activeRows = activeTile && datasets[activeTile.datasetIndex]
    ? (activeTile.filterColumn
        ? datasets[activeTile.datasetIndex].filter(r => String(r[activeTile.filterColumn]) === String(activeTile.tileKey))
        : datasets[activeTile.datasetIndex])
    : []
  const activeColumns = activeRows.length > 0 ? Object.keys(activeRows[0]) : []

  return (
    <div className="lsrch-page">

      <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>{meta?.dashboardTitle || 'MIS Dashboard'}</h2>
      </div>

      {/*
        Filter panel (date/claimNo/memberId + Search) hidden for now per request —
        meta still carries showDateFilter/etc. and load() still accepts these
        filters, so re-enabling this block later needs no other change.
      */}

      {error && <div className="panel-card" style={{ color: '#b00020', marginBottom: 16 }}>{error}</div>}

      {!loading && tiles.length > 0 && (
        <div className="stat-cards-grid" style={{ marginBottom: 16 }}>
          {tiles.map((tile, i) => (
            <div
              key={tile.tileKey}
              className="stat-card"
              onClick={() => handleTileClick(tile)}
              style={{ cursor: 'pointer', outline: activeTile?.tileKey === tile.tileKey ? '2px solid #6a3dd0' : 'none' }}
            >
              <div className={`stat-card-icon ${TILE_ICON_CLASSES[i % TILE_ICON_CLASSES.length]}`}>
                <i className={TILE_ICONS[tile.tileKey] || 'fas fa-chart-bar'}></i>
              </div>
              <div className="stat-card-info">
                <div className="stat-card-value">{tile.tileValue}</div>
                <div className="stat-card-label">{tile.tileLabel}</div>
                <div className="stat-card-trend" style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6a3dd0', cursor: 'pointer' }} onClick={() => handleTileClick(tile)}>View Details</span>
                  <i className="fas fa-download" style={{ cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); handleDownload(tile) }} title="Download"></i>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && <div className="panel-card" style={{ padding: 20, textAlign: 'center' }}>Loading dashboard…</div>}

      {!loading && activeTile && (
        <div className="panel-card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{activeTile.tileLabel}</div>
          {activeRows.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>No records found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="lsrch-table">
                <thead>
                  <tr>{activeColumns.map(col => <th key={col}>{col}</th>)}</tr>
                </thead>
                <tbody>
                  {activeRows.map((row, i) => (
                    <tr key={i}>{activeColumns.map(col => <td key={col}>{String(row[col] ?? '')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
