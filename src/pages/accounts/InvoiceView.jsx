import { useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import logo from '../../assets/images/Example.png'

function gp(params, key, fallback = '') {
  return params.get(key) || fallback
}

export default function InvoiceView() {
  const navigate     = useNavigate()
  const [params]     = useSearchParams()
  const printAreaRef = useRef(null)

  /* ── Data from URL params (mirrors original JS initPage logic) ── */
  const invNo      = gp(params, 'invNo',    'EHOI262707934')
  const invDate    = gp(params, 'date',     '15-05-2026')
  const corporate  = gp(params, 'insurer',  'Dubai Insurance')
  const corpAddr   = gp(params, 'corpAddr', 'Al Rigga Street, Deira, P.O. Box 3027, Dubai, UAE')
  const diag       = gp(params, 'diag',     'CABG')
  const cpt        = gp(params, 'cpt',      '33510')
  const member     = gp(params, 'member',   'Mr. Luke Simon')
  const policy     = gp(params, 'policy',   'OIG/ME-166801/E/11266562')
  const gop        = gp(params, 'gop',      'EHPL/AH/OI262707452')
  const hospital   = gp(params, 'hospital', 'Apollo Spectra Hospital')
  const currency   = gp(params, 'currency', 'INR')
  const exRate     = gp(params, 'exRate',   '0.03884')

  const treatAmt   = parseFloat(params.get('treatAmt') || 590000)
  const svcFee     = parseFloat(params.get('svcFee')   || 3250.00)
  const total      = treatAmt + svcFee

  const genDate    = new Date().toLocaleString('en-GB')

  /* ── PDF download — mirrors original downloadPDF() ── */
  async function downloadPDF() {
    const { jsPDF } = window.jspdf
    const element   = printAreaRef.current
    if (!element || !jsPDF) { alert('PDF library not loaded yet. Please wait a moment and try again.'); return }
    try {
      const canvas = await window.html2canvas(element, {
        scale: 3, useCORS: true, backgroundColor: '#ffffff', windowWidth: 860,
      })
      const imgData  = canvas.toDataURL('image/png')
      const doc      = new jsPDF('p', 'mm', 'a4')
      const imgProps = doc.getImageProperties(imgData)
      const w        = 210
      const h        = (imgProps.height * w) / imgProps.width
      doc.addImage(imgData, 'PNG', 0, 0, w, h)
      doc.save(`${invNo}.pdf`)
    } catch (err) {
      console.error(err)
      alert('An error occurred while generating the PDF.')
    }
  }

  return (
    <div className="inv-page-wrap">

      {/* ── Button bar ─────────────────────────────────────────────────────── */}
      <div className="inv-btn-bar no-print">
        <button className="inv-ca-btn inv-btn-outline" onClick={() => navigate(-1)}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
        <button className="inv-ca-btn inv-btn-primary" onClick={() => window.print()}>
          <i className="fas fa-print"></i> Print
        </button>
        <button className="inv-ca-btn inv-btn-success" onClick={downloadPDF}>
          <i className="fas fa-download"></i> Download PDF
        </button>
      </div>

      {/* ── Invoice wrapper ─────────────────────────────────────────────────── */}
      <div className="inv-wrap">
        <div ref={printAreaRef} className="inv-print-area">

          {/* ── Header ── */}
          <div className="inv-header">
            <div className="inv-company-info">
              <img src={logo} alt="CareAI Logo" style={{ height: 60, marginBottom: 12 }} />
              <h2 className="inv-company-name">CareAI Technologies</h2>
              <p className="inv-company-addr">
                <strong>ADDRESS:</strong> Level 3, DIFC Innovation One, DIFC,<br />
                Dubai, United Arab Emirates.<br />
                <strong>EMAIL:</strong> info@careaitech.com<br />
                <strong>VAT NO:</strong> 104231896200001
              </p>
            </div>
            <div className="inv-meta-block">
              <h1 className="inv-title-text">INVOICE</h1>
              <div className="inv-meta-box">
                <div className="inv-meta-row">
                  <span className="inv-meta-label">DATE:</span>
                  <span className="inv-meta-value">{invDate}</span>
                </div>
                <div className="inv-meta-row">
                  <span className="inv-meta-label">INVOICE NO:</span>
                  <span className="inv-meta-value inv-meta-highlight">{invNo}</span>
                </div>
                <div className="inv-meta-row">
                  <span className="inv-meta-label">CORPORATE:</span>
                  <span className="inv-meta-value">{corporate}</span>
                </div>
                <div className="inv-meta-addr">
                  <span className="inv-meta-label" style={{ display: 'block', marginBottom: 2 }}>ADDRESS:</span>
                  <span>{corpAddr}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Service Details table ── */}
          <table className="inv-service-table">
            <thead>
              <tr>
                <th className="inv-th-desc">DESCRIPTION OF SERVICES</th>
                <th className="inv-th-amt">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="inv-td-desc">
                  <div className="inv-svc-line"><strong>Medical treatment offered:</strong> <span>{diag}</span></div>
                  <div className="inv-svc-line"><strong>CPT:</strong> <span>{cpt}</span></div>
                  <div className="inv-svc-line"><strong>Policy Holder:</strong> <span>{member}</span></div>
                  <div className="inv-svc-line"><strong>Policy No.:</strong> <span>{policy}</span></div>
                  <div className="inv-svc-line"><strong>GOP No.:</strong> <span>{gop}</span></div>
                  <div className="inv-svc-line"><strong>Hospital:</strong> <span>{hospital}</span></div>
                  <div className="inv-svc-note">(Final Bill and Supporting Documents Attached)</div>
                </td>
                <td className="inv-td-amt">
                  {treatAmt.toFixed(2)} ({currency})
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── Totals section ── */}
          <div className="inv-totals-row">
            <div className="inv-currency-box">
              <div><strong>Base Currency Code:</strong> {currency}</div>
              <div><strong>Exchange Rate:</strong> {exRate}</div>
              <div><strong>Timestamp:</strong> {genDate}</div>
            </div>
            <div className="inv-amounts-col">
              <div className="inv-subtotal-row">
                <span>CareAI Service charges:</span>
                <span className="inv-subtotal-val">{svcFee.toFixed(2)} ({currency})</span>
              </div>
              <div className="inv-subtotal-row">
                <span>Investigation:</span>
                <span className="inv-subtotal-val">0.00</span>
              </div>
              <div className="inv-total-bar">
                <span>TOTAL</span>
                <span>{total.toFixed(2)} ({currency})</span>
              </div>
            </div>
          </div>

          {/* ── Bank Details ── */}
          <div className="inv-bank-section">
            <h4 className="inv-bank-title">🏦 Bank Details</h4>
            <div className="inv-bank-grid">
              <div className="inv-bank-card">
                <strong className="inv-bank-name">WIO BANK</strong>
                <div>Acc: 009586526387</div>
                <div>IBAN: AE440860000009586526387</div>
              </div>
              <div className="inv-bank-card">
                <strong className="inv-bank-name">EMIRATES NBD</strong>
                <div>IBAN: AE350260751130501011683</div>
              </div>
            </div>
          </div>

          <p className="inv-footer-note">
            This is a system-generated invoice. No physical signature or stamp is required.
          </p>

        </div>
      </div>

    </div>
  )
}
