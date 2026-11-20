import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const DEMO_ROWS = [
  {
    id: 1, claimNo: 'TK262713361',   memberName: 'Mr. Luke Simon',         insurerNm: 'Dubai Insurance',
    invoiceNo: 'EHOI262707934',      invoiceDate: '15-05-2026',            treatmentCost: '590,000.00',
    serviceFees: '3,250.00',
  },
  {
    id: 2, claimNo: 'NGI262713344',  memberName: 'Ms. B/O Jahnavi',        insurerNm: 'National General Insurance Company',
    invoiceNo: 'EHNGI262707905',     invoiceDate: '30-04-2026 11:41 am',   treatmentCost: '67,317.00',
    serviceFees: '3,000.00',
  },
  {
    id: 3, claimNo: 'HAM262713169C', memberName: 'Mr. Ali Raza',           insurerNm: 'Al Hamraa Insurance Company',
    invoiceNo: 'EHHAM262707894',     invoiceDate: '28-04-2026 4:36 pm',    treatmentCost: '500.00',
    serviceFees: '0.00',
  },
  {
    id: 4, claimNo: 'FF262713338',   memberName: 'Sugathadasa Anik Ryan',  insurerNm: 'Fairfirst Insurance',
    invoiceNo: 'EHFF262707885',      invoiceDate: '28-04-2026 11:15 am',   treatmentCost: '3,216.20',
    serviceFees: '0.00',
  },
  {
    id: 5, claimNo: 'OI262713318B',  memberName: 'Baby of Dimple Joshi',   insurerNm: 'Sukoon Insurance',
    invoiceNo: 'EHOI262707934',      invoiceDate: '05-05-2026 6:11 pm',    treatmentCost: '12,040.00',
    serviceFees: '3,250.00',
  },
]

export default function InvoiceList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return DEMO_ROWS
    const q = search.toLowerCase()
    return DEMO_ROWS.filter(r =>
      r.claimNo.toLowerCase().includes(q) ||
      r.memberName.toLowerCase().includes(q) ||
      r.insurerNm.toLowerCase().includes(q) ||
      r.invoiceNo.toLowerCase().includes(q)
    )
  }, [search])

  return (
    <div className="invl-wrap">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="invl-pg-header">
        <div className="invl-pg-title-group">
          <div className="invl-pg-title">
            <span className="invl-title-icon"><i className="fas fa-file-invoice"></i></span>
            Invoice List
          </div>
          <div className="invl-pg-sub">View and manage all generated invoices for processed claims</div>
        </div>
        <button className="invl-btn invl-btn-outline invl-btn-sm" onClick={() => alert('Downloading Excel...')}>
          <i className="fas fa-download"></i> Export
        </button>
      </div>

      {/* ── Invoice Table Card ───────────────────────────────────────────────── */}
      <div className="invl-card">
        <div className="invl-card-head">
          <span className="invl-head-title"><i className="fas fa-list"></i>&nbsp; Invoice Details</span>
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
                  <th>Insurer Name</th>
                  <th>Invoice Number</th>
                  <th>Invoice Date</th>
                  <th style={{ textAlign: 'right' }}>Cost of Treatment</th>
                  <th style={{ textAlign: 'right' }}>Service Fees</th>
                  <th style={{ textAlign: 'center' }}>ICD/CPT/DRG</th>
                  <th style={{ textAlign: 'center' }}>View Final GOP</th>
                  <th style={{ textAlign: 'center' }}>View Invoice</th>
                  <th style={{ textAlign: 'center' }}>Final Auth Letter</th>
                  <th style={{ textAlign: 'center' }}>Final Approval</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="invl-empty">
                      <i className="fas fa-info-circle"></i>&nbsp; No records found.
                    </td>
                  </tr>
                ) : filtered.map((row, i) => (
                  <tr key={row.id}>
                    <td className="invl-td-sno">{i + 1}</td>
                    <td className="invl-td-claim">{row.claimNo}</td>
                    <td className="invl-td-data">{row.memberName}</td>
                    <td className="invl-td-data">{row.insurerNm}</td>
                    <td className="invl-td-data">
                      <span className="invl-badge">{row.invoiceNo}</span>
                    </td>
                    <td className="invl-td-data">{row.invoiceDate}</td>
                    <td className="invl-td-data invl-amount">{row.treatmentCost}</td>
                    <td className="invl-td-data invl-amount">{row.serviceFees}</td>

                    {/* ICD/CPT/DRG */}
                    <td style={{ textAlign: 'center' }}>
                      <button className="invl-action-btn" title="View ICD/CPT/DRG" onClick={() => alert('View ICD/CPT/DRG')}>
                        <i className="fas fa-upload"></i>
                      </button>
                    </td>

                    {/* View Final GOP */}
                    <td style={{ textAlign: 'center' }}>
                      <button className="invl-action-btn" title="View Final GOP" onClick={() => alert('View Final GOP')}>
                        <i className="fas fa-eye"></i>
                      </button>
                    </td>

                    {/* View Invoice */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="invl-btn invl-btn-success invl-btn-sm"
                        onClick={() => navigate(`/accounts/invoice?invNo=${encodeURIComponent(row.invoiceNo)}&claimNo=${encodeURIComponent(row.claimNo)}&member=${encodeURIComponent(row.memberName)}&insurer=${encodeURIComponent(row.insurerNm)}`)}
                      >
                        <i className="fas fa-eye"></i> View
                      </button>
                    </td>

                    {/* Final Auth Letter */}
                    <td style={{ textAlign: 'center' }}>
                      <button className="invl-action-btn" title="Final Auth Letter" onClick={() => alert('Final Auth Letter')}>
                        <i className="fas fa-file-alt"></i>
                      </button>
                    </td>

                    {/* Final Approval */}
                    <td style={{ textAlign: 'center' }}>
                      <button className="invl-action-btn" title="Final Approval Request" onClick={() => alert('Final Approval Request')}>
                        <i className="fas fa-file-signature"></i>
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
