import { useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import logo from '../../assets/images/Example.png'

/* ── Helpers ── */
function parseCost(str) { return parseFloat((str ?? '0').replace(/,/g, '')) || 0 }
function parsePct(str)  { return parseFloat((str ?? '0').replace('%', '')) || 0 }
function fmtUSD(n) {
  return 'USD ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ── Gradient SVG for "INVOICE" heading — renders correctly in html2canvas ── */
function InvoiceSVGTitle() {
  return (
    <svg viewBox="0 0 370 64" style={{ height: 56, display: 'block' }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="invTitleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#632da7" />
          <stop offset="20%"  stopColor="#5c31aa" />
          <stop offset="50%"  stopColor="#d1626a" />
          <stop offset="75%"  stopColor="#dd6c69" />
          <stop offset="100%" stopColor="#f28b57" />
        </linearGradient>
      </defs>
      <text x="0" y="52" fontFamily="Outfit, Arial, sans-serif" fontSize="58"
            fontWeight="800" fill="url(#invTitleGrad)" letterSpacing="2">
        INVOICE
      </text>
    </svg>
  )
}

/* ── Gradient bar component — used for section header ── */
function GradBar({ children }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg,#632da7 0%,#5c31aa 20%,#d1626a 50%,#f28b57 100%)',
      color: '#fff', display: 'flex', justifyContent: 'space-between',
      padding: '12px 18px', borderRadius: '8px 8px 0 0',
      fontSize: 13, fontWeight: 600, letterSpacing: '0.5px',
    }}>
      {children}
    </div>
  )
}

export default function InvoiceGenerate() {
  const navigate     = useNavigate()
  const [params]     = useSearchParams()
  const printAreaRef = useRef(null)

  /* ── Data from URL params (all passed by CaseBillList) ── */
  const claimNo     = params.get('claimNo')  ?? ''
  const member      = params.get('member')   ?? '—'
  const hospital    = params.get('hospital') ?? '—'
  const insurer     = params.get('insurer')  ?? '—'
  const gopNo       = params.get('gopNo')    ?? ''
  const treatAmtStr = params.get('treatAmt') ?? '0'
  const invCostStr  = params.get('invCost')  ?? '0'
  const refPctStr   = params.get('refPct')   ?? '0%'

  /* ── Calculations ── */
  const treatAmt    = parseCost(treatAmtStr)
  const invCost     = parseCost(invCostStr)
  const totalCost   = treatAmt + invCost
  const refPct      = parsePct(refPctStr)
  const finalPayout = (totalCost * refPct) / 100

  /* ── Invoice meta ── */
  const today     = new Date()
  const invDate   = today.toLocaleDateString('en-GB').replace(/\//g, '-')
  const timestamp = today.toLocaleString('en-GB')
  const invNo     = 'EHOI' + claimNo.replace(/[^0-9]/g, '').slice(0, 9)

  const C = {
    pri:     '#632da7',
    muted:   '#7a6690',
    border:  '#e2d9f0',
    tblHead: '#f3effe',
    grad:    'linear-gradient(135deg,#632da7 0%,#5c31aa 20%,#d1626a 50%,#f28b57 100%)',
  }

  /* ── PDF download — waits for fonts, uses fixed 860px container ── */
  async function downloadPDF() {
    const btn  = document.getElementById('invg-dl-btn')
    const orig = btn.innerHTML
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>&nbsp;Generating…'
    btn.disabled  = true
    try {
      const { jsPDF } = window.jspdf
      const el = printAreaRef.current
      if (!el || !jsPDF) { alert('PDF library not loaded. Please wait and try again.'); return }

      // Wait for all fonts to be ready before capture
      await document.fonts.ready

      const canvas = await window.html2canvas(el, {
        scale:           2.5,
        useCORS:         true,
        backgroundColor: '#ffffff',
        windowWidth:     860,
        logging:         false,
        onclone: (clonedDoc) => {
          // Ensure the cloned element is full width for capture
          const clonedEl = clonedDoc.getElementById('invg-print-area')
          if (clonedEl) { clonedEl.style.width = '860px'; clonedEl.style.maxWidth = '860px' }
        },
      })

      const imgData  = canvas.toDataURL('image/png')
      const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfW     = 210
      const pdfH     = 297
      const imgProps = doc.getImageProperties(imgData)
      const imgH     = (imgProps.height * pdfW) / imgProps.width

      if (imgH <= pdfH) {
        doc.addImage(imgData, 'PNG', 0, 0, pdfW, imgH)
      } else {
        let pg = 0, rem = imgH
        while (rem > 0) {
          if (pg > 0) doc.addPage()
          doc.addImage(imgData, 'PNG', 0, -(pg * pdfH), pdfW, imgH)
          rem -= pdfH; pg++
        }
      }
      doc.save(`${invNo}.pdf`)
    } catch (err) {
      alert('PDF generation failed: ' + err.message)
    } finally {
      btn.innerHTML = orig
      btn.disabled  = false
    }
  }

  /* ── Print ── */
  function printInvoice() {
    const content = printAreaRef.current.innerHTML
    const win = window.open('', '_blank', 'width=920,height=720')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Invoice ${invNo}</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Outfit:wght@700;800&display=swap" rel="stylesheet">
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;color:#1A2332;background:#fff;padding:30px;}
        @media print{body{padding:8mm;}}
      </style>
    </head><body>${content}</body></html>`)
    win.document.close()
    win.onload = () => { win.focus(); win.print() }
  }

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Button bar ── */}
      <div style={{
        display: 'flex', gap: 12, justifyContent: 'center', padding: 16,
        borderBottom: `1px solid ${C.border}`, borderRadius: '12px 12px 0 0', background: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <button className="inv-ca-btn inv-btn-outline" onClick={() => navigate(-1)}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
        <button className="inv-ca-btn inv-btn-primary" onClick={printInvoice}>
          <i className="fas fa-print"></i> Print
        </button>
        <button id="invg-dl-btn" className="inv-ca-btn inv-btn-success" onClick={downloadPDF}>
          <i className="fas fa-download"></i> Download PDF
        </button>
        <button className="inv-ca-btn" style={{ background: 'linear-gradient(135deg,#0ea5e9,#2563eb)', color: '#fff', boxShadow: '0 2px 6px rgba(37,99,235,0.35)' }}>
          <i className="fas fa-paper-plane"></i> Send Invoice
        </button>
      </div>

      {/* ── Invoice card ── */}
      <div style={{ background: '#fff', borderRadius: '0 0 12px 12px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>

        {/* Print / PDF capture area */}
        <div id="invg-print-area" ref={printAreaRef}
          style={{ width: '100%', maxWidth: 860, margin: '0 auto', padding: '40px 48px', background: '#fff' }}>

          {/* ── Company header ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                        marginBottom: 32, borderBottom: `2px solid ${C.border}`, paddingBottom: 28 }}>

            {/* Left — logo + address */}
            <div style={{ flex: 1 }}>
              <img src={logo} alt="CareAI" style={{ height: 58, marginBottom: 14, display: 'block' }} />
              <div style={{ fontFamily: "'Outfit', sans-serif", color: C.pri, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                CareAI Technologies
              </div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.95 }}>
                <strong>ADDRESS:</strong> Level 3, DIFC Innovation One, DIFC,<br />
                Dubai, United Arab Emirates.<br />
                <strong>EMAIL:</strong> info@careaitech.com<br />
                <strong>VAT NO:</strong> 104231896200001
              </div>
            </div>

            {/* Right — INVOICE title + meta box */}
            <div style={{ textAlign: 'right', minWidth: 260 }}>
              <InvoiceSVGTitle />
              <div style={{
                marginTop: 14, border: `1px solid ${C.border}`, borderRadius: 10,
                padding: '14px 16px', textAlign: 'left', fontSize: 11, background: '#fff',
              }}>
                <Row label="DATE:"       value={invDate} />
                <Row label="INVOICE NO:" value={invNo}   highlight />
                <div style={{ marginTop: 6, borderTop: '1px solid #eee', paddingTop: 6, lineHeight: 1.5 }}>
                  <span style={{ color: C.muted, display: 'block', marginBottom: 2, fontSize: 10 }}>HOSPITAL:</span>
                  <span style={{ fontWeight: 600 }}>{hospital}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Description of Services ── */}
          <GradBar><span>DESCRIPTION OF SERVICES</span><span>AMOUNT</span></GradBar>

          <div style={{ border: `1px solid ${C.border}`, borderTop: 'none',
                        borderRadius: '0 0 8px 8px', padding: '18px 20px', background: '#fff' }}>

            {/* Patient info card */}
            <div style={{
              background: C.tblHead, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '16px 20px', marginBottom: 18,
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 32px',
            }}>
              <InfoCell label="Patient Name"  value={member}   />
              <InfoCell label="Hospital"      value={hospital} />
              <InfoCell label="Treatment ID"  value={claimNo}  />
            </div>

            <p style={{ fontSize: 11, fontStyle: 'italic', color: C.muted, marginBottom: 18 }}>
              (Final Bill and Supporting Documents Attached)
            </p>

            <div style={{ borderTop: '1px dashed #ddd', marginBottom: 14 }} />

            {/* Amount breakdown */}
            <AmtRow label="Treatment Amount"    value={fmtUSD(treatAmt)} />
            {invCost > 0 && <AmtRow label="Investigation Cost" value={fmtUSD(invCost)} />}
            {invCost > 0 && (
              <AmtRow label="Total Cost (Treatment + Investigation)" value={fmtUSD(totalCost)} muted />
            )}
            <AmtRow label="Referral Payout" value={refPctStr} />

            {/* Final payout highlight */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '11px 16px', marginTop: 10,
              background: C.tblHead, borderRadius: 7,
              fontSize: 13, color: C.pri, fontWeight: 700,
              border: `1px solid ${C.border}`,
            }}>
              <span>Final Payout &nbsp;<span style={{ fontWeight: 400, fontSize: 11, color: C.muted }}>
                ({refPctStr} of {fmtUSD(totalCost)})
              </span></span>
              <span style={{ fontSize: 15 }}>{fmtUSD(finalPayout)}</span>
            </div>
          </div>

          {/* ── Currency info + Total bar ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 28 }}>
            <div style={{
              background: C.tblHead, padding: '16px 20px', borderRadius: 10,
              fontSize: 11, lineHeight: 2.1, border: `1px solid ${C.border}`,
            }}>
              <div><strong>Base Currency Code:</strong>&nbsp; USD</div>
              <div><strong>Exchange Rate:</strong>&nbsp; 0.00</div>
              <div><strong>Timestamp:</strong>&nbsp; {timestamp}</div>
            </div>
            <div style={{ minWidth: 260 }}>
              <div style={{
                background: C.grad, color: '#fff',
                padding: '16px 24px', borderRadius: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 20, fontWeight: 800, fontFamily: "'Outfit', sans-serif",
                boxShadow: '0 4px 16px rgba(99,45,167,0.25)',
              }}>
                <span>TOTAL</span>
                <span>{fmtUSD(finalPayout)}</span>
              </div>
            </div>
          </div>

          {/* ── Bank Details ── */}
          <div style={{ marginTop: 36, borderTop: `2px solid ${C.border}`, paddingTop: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🏦 Bank Details</div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24,
              fontSize: 11, background: '#f9f7fc', padding: '18px 22px', borderRadius: 10,
              border: `1px solid ${C.border}`,
            }}>
              <div>
                <div style={{ color: C.pri, fontWeight: 700, marginBottom: 5 }}>WIO BANK</div>
                <div style={{ lineHeight: 1.8 }}>
                  Acc: 009586526387<br />
                  IBAN: AE440860000009586526387
                </div>
              </div>
              <div>
                <div style={{ color: C.pri, fontWeight: 700, marginBottom: 5 }}>EMIRATES NBD</div>
                <div style={{ lineHeight: 1.8 }}>
                  IBAN: AE350260751130501011683
                </div>
              </div>
            </div>
          </div>

          <p style={{ textAlign: 'center', marginTop: 28, fontSize: 11, color: C.muted, letterSpacing: '0.2px' }}>
            This is a system-generated invoice. No physical signature or stamp is required.
          </p>

        </div>
      </div>
    </div>
  )
}

/* ── Small helper components ── */
function Row({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, gap: 12 }}>
      <span style={{ color: '#7a6690', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontWeight: 700, color: highlight ? '#632da7' : undefined, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function InfoCell({ label, value }) {
  return (
    <div style={{ fontSize: 12 }}>
      <span style={{ color: '#7a6690', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 3 }}>
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  )
}

function AmtRow({ label, value, muted }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 4px', fontSize: 13, color: muted ? '#7a6690' : undefined }}>
      <span><strong>{label}</strong></span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  )
}
