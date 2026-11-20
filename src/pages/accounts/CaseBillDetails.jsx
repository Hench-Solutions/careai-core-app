import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

/* ── Static demo data — mirrors Med_Tour casebilldetails data ──────────── */
const DEMO_ROWS = [
  {
    id:               1,
    claimNo:          'LUK262713276',
    memberId:         'LUK001',
    memberName:       'Mr. Luke Simon',
    insurerNm:        'Dubai Insurance',
    gopNo:            'EHPL/AH/HA262707463-00',
    hospitalNm:       'Apollo Spectra Hospital',
    treatmentCost:    '6,00,000',
    investigationCost:'0.00',
    approvalRemarks:  'GOP- CABG',
  },
  {
    id:               2,
    claimNo:          'OI262713189',
    memberId:         'OI001',
    memberName:       'Mr. Vinay Narayan',
    insurerNm:        'Sukoon Insurance',
    gopNo:            'EHPL/AH/OI262707461-00',
    hospitalNm:       'Kasturba Hospital, Manipal',
    treatmentCost:    '23580.00',
    investigationCost:'0.00',
    approvalRemarks:  'GOP- PET scan',
  },
  {
    id:               3,
    claimNo:          'NL252613061',
    memberId:         'NL001',
    memberName:       'Mr. AKSHAY SHIBU',
    insurerNm:        'NLGI',
    gopNo:            'EHPL/AH/NL252607365-00',
    hospitalNm:       'Holy Cross Hospital',
    treatmentCost:    '120000.00',
    investigationCost:'120000.00',
    approvalRemarks:  'GOP for Grafting',
  },
  {
    id:               4,
    claimNo:          'ALI252613016B',
    memberId:         'ALI001',
    memberName:       'Mr. Ibrahim Momin',
    insurerNm:        'Alkoot Insurance',
    gopNo:            'EHPL/AH/AL252607313-00',
    hospitalNm:       'Dubai London Clinic',
    treatmentCost:    '718.06',
    investigationCost:'0.00',
    approvalRemarks:  'GOP - Investigation + IV',
  },
  {
    id:               5,
    claimNo:          'NL252612978',
    memberId:         'NL002',
    memberName:       'Mrs. NASIYA NAZNEEN',
    insurerNm:        'NLGI',
    gopNo:            'EHPL/AH/NL262707469-00',
    hospitalNm:       'Leelavathi Hospital',
    treatmentCost:    '70719.00',
    investigationCost:'0.00',
    approvalRemarks:  'GOP- Delivery (NVD/LSCS)',
  },
  {
    id:               6,
    claimNo:          'QLM252612963',
    memberId:         'QLM001',
    memberName:       'Mr. ZAFER NAHAWI',
    insurerNm:        'QLM Life & Medical Insurance Company',
    gopNo:            'EHPL/AH/QL252607285',
    hospitalNm:       'Al Tadawi Medical Centre',
    treatmentCost:    '2220.00',
    investigationCost:'0.00',
    approvalRemarks:  'GOP - Chiropractic session',
  },
]

const INSURERS = ['-- All --', ...Array.from(new Set(DEMO_ROWS.map(r => r.insurerNm)))]

export default function CaseBillDetails() {
  const navigate = useNavigate()

  // Filter state
  const [fClaimNo,    setFClaimNo]    = useState('')
  const [fMemberNm,   setFMemberNm]   = useState('')
  const [fInsurer,    setFInsurer]    = useState('')
  const [fGopNo,      setFGopNo]      = useState('')
  const [fHospitalNm, setFHospitalNm] = useState('')

  // Applied filters (only updated on Search click)
  const [applied, setApplied] = useState(null)

  // Results
  const results = useMemo(() => {
    if (!applied) return DEMO_ROWS
    return DEMO_ROWS.filter(r => {
      if (applied.claimNo    && !r.claimNo.toLowerCase().includes(applied.claimNo.toLowerCase()))    return false
      if (applied.memberNm   && !r.memberName.toLowerCase().includes(applied.memberNm.toLowerCase())) return false
      if (applied.insurer    && applied.insurer !== '-- All --' && r.insurerNm !== applied.insurer)   return false
      if (applied.gopNo      && !r.gopNo.toLowerCase().includes(applied.gopNo.toLowerCase()))         return false
      if (applied.hospitalNm && !r.hospitalNm.toLowerCase().includes(applied.hospitalNm.toLowerCase())) return false
      return true
    })
  }, [applied])

  function handleSearch() {
    setApplied({ claimNo: fClaimNo, memberNm: fMemberNm, insurer: fInsurer, gopNo: fGopNo, hospitalNm: fHospitalNm })
  }

  function handleRefresh() {
    setFClaimNo(''); setFMemberNm(''); setFInsurer(''); setFGopNo(''); setFHospitalNm('')
    setApplied(null)
  }

  return (
    <div className="lsrch-page">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header-banner" style={{ marginBottom: 16 }}>
        <h2>Case Bill List</h2>
      </div>

      {/* ── Filter panel ───────────────────────────────────────────────────── */}
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div className="lsrch-filter-panel">
          <div className="cbill-filter-grid">

            <div className="cbill-filter-item">
              <label className="cbill-label">Treatment ID</label>
              <input
                type="text"
                className="cbill-input"
                placeholder="Treatment ID"
                value={fClaimNo}
                onChange={e => setFClaimNo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div className="cbill-filter-item">
              <label className="cbill-label">Member Name</label>
              <input
                type="text"
                className="cbill-input"
                placeholder="Member Name"
                value={fMemberNm}
                onChange={e => setFMemberNm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div className="cbill-filter-item">
              <label className="cbill-label">Insurer Name</label>
              <select
                className="cbill-input"
                value={fInsurer}
                onChange={e => setFInsurer(e.target.value)}
              >
                {INSURERS.map(ins => (
                  <option key={ins} value={ins === '-- All --' ? '' : ins}>{ins}</option>
                ))}
              </select>
            </div>

            <div className="cbill-filter-item">
              <label className="cbill-label">GOP Number</label>
              <input
                type="text"
                className="cbill-input"
                placeholder="GOP Number"
                value={fGopNo}
                onChange={e => setFGopNo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div className="cbill-filter-item">
              <label className="cbill-label">Hospital Name</label>
              <input
                type="text"
                className="cbill-input"
                placeholder="Hospital Name"
                value={fHospitalNm}
                onChange={e => setFHospitalNm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
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

      {/* ── Results table ──────────────────────────────────────────────────── */}
      <div className="panel-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="lsrch-table cbill-table">
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Treatment ID</th>
                <th>Member Name</th>
                <th>Insurer Name</th>
                <th>GOP Number</th>
                <th>Hospital Name</th>
                <th>Treatment Cost</th>
                <th>Investigation Cost</th>
                <th>Approval Remarks</th>
                <th style={{ textAlign: 'center' }}>View Final GOP</th>
                <th style={{ textAlign: 'center' }}>Proceed</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '28px 12px', color: '#888' }}>
                    <i className="fas fa-info-circle"></i>&nbsp; OOPS! Sorry there is no record found.
                  </td>
                </tr>
              ) : results.map((row, i) => (
                <tr key={row.id}>
                  <td className="lsrch-td-sno">{i + 1}</td>
                  <td className="lsrch-td-claim">{row.claimNo}</td>
                  <td className="lsrch-td-data">{row.memberName}</td>
                  <td className="lsrch-td-data">{row.insurerNm}</td>
                  <td className="lsrch-td-data">{row.gopNo}</td>
                  <td className="lsrch-td-data">{row.hospitalNm}</td>
                  <td className="lsrch-td-data cbill-amount">{row.treatmentCost}</td>
                  <td className="lsrch-td-data cbill-amount">{row.investigationCost}</td>
                  <td className="lsrch-td-data">{row.approvalRemarks}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="cbill-icon-btn" title="View Final GOP">
                      <i className="fas fa-eye fa-lg"></i>
                    </button>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="cbill-icon-btn cbill-proceed-btn"
                      title="Proceed"
                      onClick={() => navigate(`/accounts/casebillentry?claimNo=${encodeURIComponent(row.claimNo)}&memberId=${encodeURIComponent(row.memberId)}`)}
                    >
                      <i className="fas fa-sign-out-alt fa-lg"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', color: '#888', fontSize: 12 }}>
          Showing {results.length} of {DEMO_ROWS.length} records
        </div>
      </div>

    </div>
  )
}
