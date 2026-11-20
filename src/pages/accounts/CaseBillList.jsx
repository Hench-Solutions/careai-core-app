import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const PAGE_SIZE = 10

const DEMO_ROWS = [
  { id: 1,  claimNo: 'LUK262713276',  memberName: 'Mr. Luke Simon',          insurerNm: 'Dubai Insurance',                      gopNo: 'EHPL/AH/HA262707463-00', hospitalNm: 'Apollo Spectra Hospital',    treatmentCost: '6,00,000',   investigationCost: '0.00',       referralPct: '10%' },
  { id: 2,  claimNo: 'OI262713189',   memberName: 'Mr. Vinay Narayan',        insurerNm: 'Sukoon Insurance',                     gopNo: 'EHPL/AH/OI262707461-00', hospitalNm: 'Kasturba Hospital, Manipal', treatmentCost: '23,580.00',  investigationCost: '0.00',       referralPct: '15%' },
  { id: 3,  claimNo: 'NL252613061',   memberName: 'Mr. AKSHAY SHIBU',         insurerNm: 'NLGI',                                 gopNo: 'EHPL/AH/NL252607365-00', hospitalNm: 'Holy Cross Hospital',        treatmentCost: '1,20,000.00',investigationCost: '1,20,000.00',referralPct: '20%' },
  { id: 4,  claimNo: 'ALI252613016B', memberName: 'Mr. Ibrahim Momin',        insurerNm: 'Alkoot Insurance',                     gopNo: 'EHPL/AH/AL252607313-00', hospitalNm: 'Dubai London Clinic',        treatmentCost: '718.06',     investigationCost: '0.00',       referralPct: '12%' },
  { id: 5,  claimNo: 'NL252612978',   memberName: 'Mrs. NASIYA NAZNEEN',      insurerNm: 'NLGI',                                 gopNo: 'EHPL/AH/NL262707469-00', hospitalNm: 'Leelavathi Hospital',        treatmentCost: '70,719.00',  investigationCost: '0.00',       referralPct: '18%' },
  { id: 6,  claimNo: 'QLM252612963',  memberName: 'Mr. ZAFER NAHAWI',         insurerNm: 'QLM Life & Medical Insurance Company', gopNo: 'EHPL/AH/QL252607285',    hospitalNm: 'Al Tadawi Medical Centre',   treatmentCost: '2,220.00',   investigationCost: '0.00',       referralPct: '10%' },
  { id: 7,  claimNo: 'DI252612847',   memberName: 'Ms. PRIYA KRISHNA',        insurerNm: 'Dubai Insurance',                      gopNo: 'EHPL/AH/DI252607201-00', hospitalNm: 'Aster Medcity',              treatmentCost: '45,000.00',  investigationCost: '5,000.00',   referralPct: '8%'  },
  { id: 8,  claimNo: 'SK252612766',   memberName: 'Mr. RAVI SHANKAR',         insurerNm: 'Sukoon Insurance',                     gopNo: 'EHPL/AH/SK252607180-00', hospitalNm: 'Apollo Hospital',            treatmentCost: '98,500.00',  investigationCost: '12,000.00',  referralPct: '14%' },
  { id: 9,  claimNo: 'AL252612688',   memberName: 'Mrs. FATIMA AL RASHID',    insurerNm: 'Alkoot Insurance',                     gopNo: 'EHPL/AH/AL252607099-00', hospitalNm: 'Mediclinic City Hospital',   treatmentCost: '3,15,000.00',investigationCost: '0.00',       referralPct: '11%' },
  { id: 10, claimNo: 'NL252612601',   memberName: 'Mr. SURESH MENON',         insurerNm: 'NLGI',                                 gopNo: 'EHPL/AH/NL252607044-00', hospitalNm: 'VPS Healthcare',             treatmentCost: '18,750.00',  investigationCost: '3,200.00',   referralPct: '16%' },
  { id: 11, claimNo: 'QL252612534',   memberName: 'Mr. AHMED AL MANSOORI',    insurerNm: 'QLM Life & Medical Insurance Company', gopNo: 'EHPL/AH/QL252606987-00', hospitalNm: 'Burjeel Hospital',           treatmentCost: '55,000.00',  investigationCost: '8,500.00',   referralPct: '13%' },
  { id: 12, claimNo: 'DI252612478',   memberName: 'Mrs. SARA JOHNSON',        insurerNm: 'Dubai Insurance',                      gopNo: 'EHPL/AH/DI252606921-00', hospitalNm: 'Zulekha Hospital',           treatmentCost: '27,400.00',  investigationCost: '0.00',       referralPct: '9%'  },
]

const INSURERS = ['--Select--', ...Array.from(new Set(DEMO_ROWS.map(r => r.insurerNm)))]

export default function CaseBillList() {
  const navigate = useNavigate()

  /* ── Filter state ── */
  const [fClaimNo,    setFClaimNo]    = useState('')
  const [fMemberNm,   setFMemberNm]   = useState('')
  const [fInsurer,    setFInsurer]    = useState('')
  const [fGopNo,      setFGopNo]      = useState('')
  const [fHospitalNm, setFHospitalNm] = useState('')
  const [applied,     setApplied]     = useState(null)

  /* ── Table state ── */
  const [quickSearch, setQuickSearch] = useState('')
  const [page,        setPage]        = useState(1)

  /* ── Filter apply ── */
  const filtered = useMemo(() => {
    const base = applied ? DEMO_ROWS.filter(r => {
      if (applied.claimNo    && !r.claimNo.toLowerCase().includes(applied.claimNo.toLowerCase()))       return false
      if (applied.memberNm   && !r.memberName.toLowerCase().includes(applied.memberNm.toLowerCase()))   return false
      if (applied.insurer    && r.insurerNm !== applied.insurer)                                         return false
      if (applied.gopNo      && !r.gopNo.toLowerCase().includes(applied.gopNo.toLowerCase()))            return false
      if (applied.hospitalNm && !r.hospitalNm.toLowerCase().includes(applied.hospitalNm.toLowerCase())) return false
      return true
    }) : DEMO_ROWS

    if (!quickSearch.trim()) return base
    const q = quickSearch.toLowerCase()
    return base.filter(r =>
      r.claimNo.toLowerCase().includes(q)     ||
      r.memberName.toLowerCase().includes(q)  ||
      r.insurerNm.toLowerCase().includes(q)   ||
      r.gopNo.toLowerCase().includes(q)        ||
      r.hospitalNm.toLowerCase().includes(q)
    )
  }, [applied, quickSearch])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleSearch() {
    setApplied({ claimNo: fClaimNo, memberNm: fMemberNm, insurer: fInsurer, gopNo: fGopNo, hospitalNm: fHospitalNm })
    setPage(1)
  }

  function handleRefresh() {
    setFClaimNo(''); setFMemberNm(''); setFInsurer(''); setFGopNo(''); setFHospitalNm('')
    setApplied(null); setQuickSearch(''); setPage(1)
  }

  /* ── Pagination helpers ── */
  function pageNums() {
    const all = Array.from({ length: totalPages }, (_, i) => i + 1)
    if (totalPages <= 7) return all
    const near = all.filter(p => p <= 5 || Math.abs(p - page) <= 1)
    const deduped = [...new Set([...near.slice(0, 5)])]
    return deduped
  }

  return (
    <div className="lsrch-page">

      {/* ── Header ── */}
      <div className="page-header-banner" style={{ marginBottom: 16 }}>
        <h2>Case Bill List</h2>
      </div>

      {/* ── Search Filters card ── */}
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div className="lsrch-filter-panel">
          <div className="cbill-filter-grid">

            <div className="cbill-filter-item">
              <label className="cbill-label">Treatment ID</label>
              <input className="cbill-input" placeholder="Enter Treatment ID"
                value={fClaimNo} onChange={e => setFClaimNo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>

            <div className="cbill-filter-item">
              <label className="cbill-label">Member Name</label>
              <input className="cbill-input" placeholder="Enter member name"
                value={fMemberNm} onChange={e => setFMemberNm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>

            <div className="cbill-filter-item">
              <label className="cbill-label">Insurer Name</label>
              <select className="cbill-input" value={fInsurer} onChange={e => setFInsurer(e.target.value)}>
                {INSURERS.map(ins => (
                  <option key={ins} value={ins === '--Select--' ? '' : ins}>{ins}</option>
                ))}
              </select>
            </div>

            <div className="cbill-filter-item">
              <label className="cbill-label">GOP Number</label>
              <input className="cbill-input" placeholder="Enter GOP number"
                value={fGopNo} onChange={e => setFGopNo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>

            <div className="cbill-filter-item">
              <label className="cbill-label">Hospital Name</label>
              <input className="cbill-input" placeholder="Enter hospital name"
                value={fHospitalNm} onChange={e => setFHospitalNm(e.target.value)}
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

      {/* ── Case Bill List card ── */}
      <div className="panel-card">

        {/* Quick search bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#7a6690' }}>Search:</span>
            <input
              className="lsrch-table-search"
              placeholder="Quick search..."
              value={quickSearch}
              onChange={e => { setQuickSearch(e.target.value); setPage(1) }}
            />
          </div>
        </div>

        <div>
          <table className="lsrch-table cbill-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '4%'  }} />  {/* S.No. */}
              <col style={{ width: '10%' }} />  {/* Claim Number */}
              <col style={{ width: '11%' }} />  {/* Member Name */}
              <col style={{ width: '13%' }} />  {/* Insurer Name */}
              <col style={{ width: '14%' }} />  {/* GOP Number */}
              <col style={{ width: '13%' }} />  {/* Hospital Name */}
              <col style={{ width: '9%'  }} />  {/* Treatment Cost */}
              <col style={{ width: '9%'  }} />  {/* Investigation Cost */}
              <col style={{ width: '6%'  }} />  {/* Referral % */}
              <col style={{ width: '11%' }} />  {/* Generate Invoice */}
            </colgroup>
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
                <th style={{ textAlign: 'center' }}>Referral %</th>
                <th style={{ textAlign: 'center' }}>Generate Invoice</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '28px 12px', color: '#888' }}>
                    <i className="fas fa-info-circle"></i>&nbsp; No records found.
                  </td>
                </tr>
              ) : pageRows.map((row, i) => (
                <tr key={row.id}>
                  <td className="lsrch-td-sno">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="lsrch-td-claim">{row.claimNo}</td>
                  <td className="lsrch-td-data">{row.memberName}</td>
                  <td className="lsrch-td-data">{row.insurerNm}</td>
                  <td className="lsrch-td-data">{row.gopNo}</td>
                  <td className="lsrch-td-data">{row.hospitalNm}</td>
                  <td className="lsrch-td-data cbill-amount">{row.treatmentCost}</td>
                  <td className="lsrch-td-data cbill-amount">{row.investigationCost}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: '#632da7' }}>{row.referralPct}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="cbl-invoice-btn"
                      onClick={() => {
                      const p = new URLSearchParams({
                        claimNo:     row.claimNo,
                        member:      row.memberName,
                        hospital:    row.hospitalNm,
                        insurer:     row.insurerNm,
                        gopNo:       row.gopNo,
                        treatAmt:    row.treatmentCost,
                        invCost:     row.investigationCost,
                        refPct:      row.referralPct,
                      })
                      navigate(`/accounts/invoicegenerate?${p.toString()}`)
                    }}
                    >
                      <i className="fas fa-file-invoice"></i> Generate Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="lsrch-bottom-bar" style={{ padding: '10px 16px' }}>
          <span style={{ fontSize: 12, color: '#888' }}>
            {filtered.length === 0
              ? 'No records found'
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} records`}
          </span>

          {totalPages > 1 && (
            <div className="lsrch-pagination">
              {pageNums().map(p => (
                <button key={p}
                  className={`lsrch-page-btn${page === p ? ' active' : ''}`}
                  onClick={() => setPage(p)}>{p}</button>
              ))}
              {totalPages > 5 && page < totalPages - 2 && (
                <span style={{ padding: '0 4px', color: '#888', fontSize: 12 }}>... {totalPages}</span>
              )}
              {page < totalPages && (
                <button className="lsrch-page-btn" onClick={() => setPage(p => Math.min(p + 1, totalPages))}>Next</button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
