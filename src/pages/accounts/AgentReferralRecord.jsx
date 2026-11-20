import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const DEMO_ROWS = [
  { sno: 1,  claimNo: 'TID262700068', memberName: 'Michael Carter',    agentName: 'Agent B', diagnosis: 'Type 2 Diabetes Mellitus',        caseManager: 'Priya Sharma', hospitalAmt: '12,000.00', referralAmt: '1,200.00', status: 'Paid' },
  { sno: 2,  claimNo: 'TID262700112', memberName: 'Jennifer Brooks',   agentName: 'Agent A', diagnosis: 'Acute Appendicitis',               caseManager: 'Rahul Mehta',  hospitalAmt: '7,500.00',  referralAmt: '525.00',   status: 'Agent invoice awaiting' },
  { sno: 3,  claimNo: 'TID262700134', memberName: 'David Sullivan',    agentName: 'Agent C', diagnosis: 'Coronary Artery Disease',          caseManager: 'Anjali Desai', hospitalAmt: '18,000.00', referralAmt: '2,160.00', status: 'Payment under process' },
  { sno: 4,  claimNo: 'TID262700157', memberName: 'Emily Rodriguez',   agentName: 'Agent A', diagnosis: 'Pneumonia',                        caseManager: 'Vikram Nair',  hospitalAmt: '5,000.00',  referralAmt: '250.00',   status: 'Paid' },
  { sno: 5,  claimNo: 'TID262700190', memberName: 'Robert Hayes',      agentName: 'Agent C', diagnosis: 'Fractured Femur',                  caseManager: 'Priya Sharma', hospitalAmt: '9,500.00',  referralAmt: '1,425.00', status: 'Payment under process' },
  { sno: 6,  claimNo: 'TID262700213', memberName: 'Ashley Bennett',    agentName: 'Agent B', diagnosis: 'Chronic Kidney Disease',           caseManager: 'Anjali Desai', hospitalAmt: '15,000.00', referralAmt: '1,350.00', status: 'Paid' },
  { sno: 7,  claimNo: 'TID262700245', memberName: 'Christopher Reed',  agentName: 'Agent A', diagnosis: 'Hypertension',                     caseManager: 'Rahul Mehta',  hospitalAmt: '4,200.00',  referralAmt: '546.00',   status: 'Agent invoice awaiting' },
  { sno: 8,  claimNo: 'TID262700278', memberName: 'Laura Mitchell',    agentName: 'Agent C', diagnosis: 'Gallstones (Cholelithiasis)',      caseManager: 'Vikram Nair',  hospitalAmt: '11,000.00', referralAmt: '660.00',   status: 'Paid' },
  { sno: 9,  claimNo: 'TID262700301', memberName: 'James Whitaker',    agentName: 'Agent B', diagnosis: 'Asthma Exacerbation',              caseManager: 'Priya Sharma', hospitalAmt: '6,800.00',  referralAmt: '748.00',   status: 'Payment under process' },
  { sno: 10, claimNo: 'TID262700326', memberName: 'Megan Foster',      agentName: 'Agent A', diagnosis: 'Lumbar Disc Herniation',           caseManager: 'Rahul Mehta',  hospitalAmt: '13,500.00', referralAmt: '1,080.00', status: 'Agent invoice awaiting' },
  { sno: 11, claimNo: 'TID262700349', memberName: 'Daniel Coleman',    agentName: 'Agent C', diagnosis: 'Ischemic Stroke',                  caseManager: 'Anjali Desai', hospitalAmt: '20,000.00', referralAmt: '2,800.00', status: 'Paid' },
  { sno: 12, claimNo: 'TID262700372', memberName: 'Sarah Lindquist',   agentName: 'Agent B', diagnosis: 'Cataract (Bilateral)',             caseManager: 'Vikram Nair',  hospitalAmt: '8,200.00',  referralAmt: '410.00',   status: 'Payment under process' },
  { sno: 13, claimNo: 'TID262700395', memberName: 'Brian Callahan',    agentName: 'Agent A', diagnosis: 'Rheumatoid Arthritis',             caseManager: 'Priya Sharma', hospitalAmt: '10,000.00', referralAmt: '1,000.00', status: 'Paid' },
]

export default function AgentReferralRecord() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return DEMO_ROWS
    const q = search.toLowerCase()
    return DEMO_ROWS.filter(r =>
      r.claimNo.toLowerCase().includes(q) ||
      r.memberName.toLowerCase().includes(q) ||
      r.agentName.toLowerCase().includes(q) ||
      r.diagnosis.toLowerCase().includes(q) ||
      r.caseManager.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    )
  }, [search])

  return (
    <div className="invl-wrap">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="invl-pg-header">
        <div className="invl-pg-title-group">
          <div className="invl-pg-title">
            <span className="invl-title-icon"><i className="fas fa-user-friends"></i></span>
            Agent Referral Record
          </div>
          <div className="invl-pg-sub">View agent referral cases with hospital and referral amounts</div>
        </div>
        <button className="invl-btn invl-btn-outline invl-btn-sm" onClick={() => alert('Downloading Excel...')}>
          <i className="fas fa-download"></i> Export
        </button>
      </div>

      {/* ── Table Card ───────────────────────────────────────────────────────── */}
      <div className="invl-card">
        <div className="invl-card-head">
          <span className="invl-head-title"><i className="fas fa-list"></i>&nbsp; Referral Details</span>
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
                  <th>Treatment ID</th>
                  <th>Member Name</th>
                  <th>Agent Name</th>
                  <th>Diagnosis</th>
                  <th>Case Manager</th>
                  <th style={{ textAlign: 'right' }}>Hospital Amount</th>
                  <th style={{ textAlign: 'right' }}>Referral Amount</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Notes</th>
                  <th style={{ textAlign: 'center' }}>Docs</th>
                  <th style={{ textAlign: 'center' }}>Comm</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="invl-empty">
                      <i className="fas fa-info-circle"></i>&nbsp; No records found.
                    </td>
                  </tr>
                ) : filtered.map(row => (
                  <tr key={row.sno}>
                    <td className="invl-td-sno">{row.sno}</td>
                    <td className="invl-td-claim">{row.claimNo}</td>
                    <td className="invl-td-data">{row.memberName}</td>
                    <td className="invl-td-data">{row.agentName}</td>
                    <td className="invl-td-data">{row.diagnosis}</td>
                    <td className="invl-td-data">{row.caseManager}</td>
                    <td className="invl-td-data invl-amount">{row.hospitalAmt}</td>
                    <td className="invl-td-data invl-amount">{row.referralAmt}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="invl-badge">{row.status}</span>
                    </td>

                    {/* Notes */}
                    <td style={{ textAlign: 'center' }}>
                      <button className="invl-action-btn" title="Notes" onClick={() => alert('Notes')}>
                        <i className="fas fa-sticky-note"></i>
                      </button>
                    </td>

                    {/* Docs */}
                    <td style={{ textAlign: 'center' }}>
                      <button className="invl-action-btn" title="Docs" onClick={() => alert('Docs')}>
                        <i className="fas fa-upload"></i>
                      </button>
                    </td>

                    {/* Comm */}
                    <td style={{ textAlign: 'center' }}>
                      <button className="invl-action-btn" title="Communication" onClick={() => alert('Communication')}>
                        <i className="fas fa-comment-dots"></i>
                      </button>
                    </td>
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
