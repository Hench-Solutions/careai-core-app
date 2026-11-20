import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const DEMO_ROWS = [
  { sno: 1,  insurerNm: 'Dubai Insurance Company',        claimNo: 'CL78178178', claimAmt: '750,000.00',   adjustAmt: '750,000.00',   remainAmt: '0.00' },
  { sno: 2,  insurerNm: 'Sukoon Insurance',                claimNo: 'CL78178204', claimAmt: '1,250,000.00', adjustAmt: '0.00',         remainAmt: '1,250,000.00' },
  { sno: 3,  insurerNm: 'Daman',                           claimNo: 'CL78178231', claimAmt: '520,000.00',   adjustAmt: '520,000.00',   remainAmt: '0.00' },
  { sno: 4,  insurerNm: 'National General Insurance',      claimNo: 'CL78178256', claimAmt: '980,000.00',   adjustAmt: '400,000.00',   remainAmt: '580,000.00' },
  { sno: 5,  insurerNm: 'Dubai Insurance Company',        claimNo: 'CL78178283', claimAmt: '1,450,000.00', adjustAmt: '0.00',         remainAmt: '1,450,000.00' },
  { sno: 6,  insurerNm: 'Daman',                           claimNo: 'CL78178310', claimAmt: '615,000.00',   adjustAmt: '615,000.00',   remainAmt: '0.00' },
  { sno: 7,  insurerNm: 'Sukoon Insurance',                claimNo: 'CL78178342', claimAmt: '1,100,000.00', adjustAmt: '500,000.00',   remainAmt: '600,000.00' },
  { sno: 8,  insurerNm: 'National General Insurance',      claimNo: 'CL78178367', claimAmt: '860,000.00',   adjustAmt: '0.00',         remainAmt: '860,000.00' },
  { sno: 9,  insurerNm: 'Daman',                           claimNo: 'CL78178395', claimAmt: '1,320,000.00', adjustAmt: '1,320,000.00', remainAmt: '0.00' },
  { sno: 10, insurerNm: 'Dubai Insurance Company',        claimNo: 'CL78178418', claimAmt: '505,000.00',   adjustAmt: '250,000.00',   remainAmt: '255,000.00' },
  { sno: 11, insurerNm: 'Sukoon Insurance',                claimNo: 'CL78178446', claimAmt: '1,180,000.00', adjustAmt: '0.00',         remainAmt: '1,180,000.00' },
  { sno: 12, insurerNm: 'National General Insurance',      claimNo: 'CL78178473', claimAmt: '690,000.00',   adjustAmt: '690,000.00',   remainAmt: '0.00' },
  { sno: 13, insurerNm: 'Sukoon Insurance',                claimNo: 'CL78178501', claimAmt: '1,500,000.00', adjustAmt: '750,000.00',   remainAmt: '750,000.00' },
  { sno: 14, insurerNm: 'Daman',                           claimNo: 'CL78178529', claimAmt: '925,000.00',   adjustAmt: '0.00',         remainAmt: '925,000.00' },
  { sno: 15, insurerNm: 'Dubai Insurance Company',        claimNo: 'CL78178554', claimAmt: '1,045,000.00', adjustAmt: '1,045,000.00', remainAmt: '0.00' },
  { sno: 16, insurerNm: 'National General Insurance',      claimNo: 'CL78178582', claimAmt: '575,000.00',   adjustAmt: '300,000.00',   remainAmt: '275,000.00' },
]

export default function InsurancePaymentSettlement() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return DEMO_ROWS
    const q = search.toLowerCase()
    return DEMO_ROWS.filter(r =>
      r.insurerNm.toLowerCase().includes(q) ||
      r.claimNo.toLowerCase().includes(q)
    )
  }, [search])

  return (
    <div className="invl-wrap">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="invl-pg-header">
        <div className="invl-pg-title-group">
          <div className="invl-pg-title">
            <span className="invl-title-icon"><i className="fas fa-hand-holding-usd"></i></span>
            Insurance Payment Settlement
          </div>
          <div className="invl-pg-sub">View insurer-wise claim payments, adjustments and remaining balances</div>
        </div>
        <button className="invl-btn invl-btn-outline invl-btn-sm" onClick={() => alert('Downloading Excel...')}>
          <i className="fas fa-download"></i> Export
        </button>
      </div>

      {/* ── Table Card ───────────────────────────────────────────────────────── */}
      <div className="invl-card">
        <div className="invl-card-head">
          <span className="invl-head-title"><i className="fas fa-list"></i>&nbsp; Settlement Details</span>
        </div>
        <div className="invl-card-body">

          {/* Search bar */}
          <div className="invl-search-bar">
            <span>Search:</span>
            <input
              className="invl-input"
              placeholder="Quick search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Table */}
          <div className="invl-table-wrap">
            <table className="invl-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>Insurance Name</th>
                  <th>Claim Number</th>
                  <th style={{ textAlign: 'right' }}>Claim Amount</th>
                  <th style={{ textAlign: 'right' }}>Adjustment Amount</th>
                  <th style={{ textAlign: 'right' }}>Remaining Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="invl-empty">
                      <i className="fas fa-info-circle"></i>&nbsp; No records found.
                    </td>
                  </tr>
                ) : filtered.map(row => (
                  <tr key={row.sno}>
                    <td className="invl-td-sno">{row.sno}</td>
                    <td className="invl-td-data">{row.insurerNm}</td>
                    <td className="invl-td-claim">{row.claimNo}</td>
                    <td className="invl-td-data invl-amount">{row.claimAmt}</td>
                    <td className="invl-td-data invl-amount">{row.adjustAmt}</td>
                    <td className="invl-td-data invl-amount">{row.remainAmt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="invl-pagination">
            {[1, 2, 3].map(n => (
              <button key={n} className={`invl-pg-btn${n === 1 ? ' active' : ''}`}>{n}</button>
            ))}
            <button className="invl-pg-btn">Next</button>
          </div>
        </div>
      </div>

      {/* ── Bottom Button Row ────────────────────────────────────────────────── */}
      <div className="invl-btn-row">
        <button className="invl-btn invl-btn-outline" onClick={() => navigate(-1)}>
          <i className="fas fa-arrow-left"></i> Back to Case Details
        </button>
        <button className="invl-btn invl-btn-primary" onClick={() => navigate('/leads/search')}>
          <i className="fas fa-home"></i> Back to Case List
        </button>
      </div>

    </div>
  )
}
