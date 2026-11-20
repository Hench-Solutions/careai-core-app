import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getProvider, getCompanyAgreements, sendProviderContract, fetchDropdown } from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'

export default function ProviderAction() {
  const navigate   = useNavigate()
  const [params]   = useSearchParams()
  const prvCd      = params.get('prvCd') ?? ''

  const [provider,  setProvider]  = useState(null)
  const [companies, setCompanies] = useState([])
  const [compCd,    setCompCd]    = useState('')
  const [senderEmail,    setSenderEmail]    = useState('')
  const [senderEmailPwd, setSenderEmailPwd] = useState('')
  const [eventCode,      setEventCode]      = useState('')

  const COMPANY_EVENT_MAP = { C001: '122', C002: '121' }
  const [files,     setFiles]     = useState([])
  const [selected,  setSelected]  = useState([])   // array of file ids/paths
  const [loading,    setLoading]   = useState(true)
  const [sending,    setSending]   = useState(false)
  const [modalMsgs,  setModalMsgs] = useState([])
  const [successMsg, setSuccessMsg] = useState('')
  const [confirmCfg, setConfirmCfg] = useState(null)   // { message, onOk }

  // ── Load provider + company dropdown ─────────────────────────────────────
  useEffect(() => {
    if (!prvCd) { setLoading(false); return }
    Promise.all([
      getProvider(prvCd),
      fetchDropdown('drpComp'),
    ])
      .then(([prvData, compData]) => {
        setProvider(prvData)
        setCompanies(compData || [])
      })
      .catch(() => setModalMsgs(['Failed to load provider details.']))
      .finally(() => setLoading(false))
  }, [prvCd])

  // ── Company change → load files ───────────────────────────────────────────
  async function handleCompanyChange(cd) {
    setCompCd(cd)
    setSelected([])
    setSenderEmail('')
    setSenderEmailPwd('')
    setEventCode(COMPANY_EVENT_MAP[cd] || '')
    if (!cd) { setFiles([]); return }
    try {
      const data = await getCompanyAgreements(cd)
      const rows = data || []
      setFiles(rows)
      if (rows.length > 0) {
        setSenderEmail(rows[0].senderEmailId || '')
        setSenderEmailPwd(rows[0].senderEmailPwd || '')
      }
    } catch {
      setFiles([])
    }
  }

  // ── Toggle checkbox ───────────────────────────────────────────────────────
  function toggleSelect(filePath) {
    setSelected(prev =>
      prev.includes(filePath) ? prev.filter(x => x !== filePath) : [...prev, filePath]
    )
  }

  // ── Approve & Send ────────────────────────────────────────────────────────
  function handleApprove() {
    if (selected.length === 0) {
      setModalMsgs(['Please select at least one file to send.'])
      return
    }
    setConfirmCfg({
      message: 'Are you sure you want to approve and send the contract to the provider?',
      onOk: doSend
    })
  }

  async function doSend() {
    setConfirmCfg(null)
    setSending(true)
    try {
      await sendProviderContract({ prvCd, compCd, filePaths: selected, senderEmail, senderEmailPwd, eventCode })
      setSuccessMsg('Contract sent successfully!')
    } catch (err) {
      setModalMsgs([err?.message || 'Failed to send contract. Please try again.'])
    } finally {
      setSending(false)
    }
  }

  // ── Page header ───────────────────────────────────────────────────────────
  const header = (
    <div className="common-header">
      <div className="common-header-content">
        <div className="common-header-title-wrapper">
          <h2 className="common-header-title">
            Provider Action — Send MOU / Contract
            {prvCd && <span style={{ fontWeight: 400, fontSize: 14, marginLeft: 10, color: '#a89ec2' }}>{prvCd}</span>}
          </h2>
        </div>
        <button className="lead-action-back" onClick={() => navigate('/provider/search')}>Back</button>
      </div>
    </div>
  )

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="quotation-container">
      {header}
      <div className="lead-action-loading"><i className="fas fa-spinner fa-spin"></i> Loading…</div>
    </div>
  )

  const p = provider || {}

  return (
    <div className="quotation-container">
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />
      <SuccessModal message={successMsg} onClose={() => navigate('/provider/search')} />
      {confirmCfg && <ConfirmModal message={confirmCfg.message} onOk={confirmCfg.onOk} onCancel={() => setConfirmCfg(null)} />}
      {header}

      <div className="pa-wrap">

        {/* ── Provider Information ── */}
        <PaCard icon={<HospitalIcon />} title="Provider Information">
          <div className="pa-g3">
            <div className="pa-field">
              <label className="pa-lbl">Provider Name <em>*</em></label>
              <div className="pa-val">{p.prvNm}</div>
            </div>
            <div className="pa-field pa-s2">
              <label className="pa-lbl">Provider Address</label>
              <div className="pa-val">{p.prvAddr}</div>
            </div>
            <div className="pa-field">
              <label className="pa-lbl">Pin Code</label>
              <div className="pa-val">{p.pinCd}</div>
            </div>
            <div className="pa-field">
              <label className="pa-lbl">Location</label>
              <div className="pa-val">{p.location}</div>
            </div>
            <div className="pa-field">
              <label className="pa-lbl">Country <em>*</em></label>
              <div className="pa-val">{p.countryNm}</div>
            </div>
            <div className="pa-field">
              <label className="pa-lbl">State <em>*</em></label>
              <div className="pa-val">{p.stateNm}</div>
            </div>
            <div className="pa-field">
              <label className="pa-lbl">District</label>
              <div className="pa-val">{p.districtNm}</div>
            </div>
          </div>
        </PaCard>

        {/* ── Contact Details ── */}
        <PaCard icon={<MailIcon />} title="Contact Details">
          <div className="pa-g3">
            <div className="pa-field">
              <label className="pa-lbl">Primary Person Name</label>
              <div className="pa-val">{p.primaryPersonNm}</div>
            </div>
            <div className="pa-field">
              <label className="pa-lbl">Primary Mobile No</label>
              <div className="pa-val">{p.primaryMobileNo}</div>
            </div>
            <div className="pa-field">
              <label className="pa-lbl">Secondary Person Name</label>
              <div className="pa-val">{p.secondaryPersonNm}</div>
            </div>
            <div className="pa-field">
              <label className="pa-lbl">Secondary Mobile No</label>
              <div className="pa-val">{p.secondaryMobileNo}</div>
            </div>
            <div className="pa-field">
              <label className="pa-lbl">Landline No</label>
              <div className="pa-val">{p.landlineNo}</div>
            </div>
            <div className="pa-field">
              <label className="pa-lbl">Email <em>*</em></label>
              <div className="pa-val">{p.email}</div>
            </div>
          </div>
        </PaCard>

        {/* ── MOU / Contract Files ── */}
        <PaCard icon={<DocIcon />} title="MOU / Contract Files">
          <div className="pa-g3">
            <div className="pa-field pa-s3">

              {/* Company + Sender Email row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div className="pa-field">
                  <label className="pa-lbl">Select Company</label>
                  <div className="pa-val" style={{ padding: 0, background: 'transparent', border: 'none' }}>
                    <select
                      value={compCd}
                      onChange={e => handleCompanyChange(e.target.value)}
                      style={{ width: '100%', fontSize: 13, color: '#2e1d55', background: '#f8f9fa', border: '1px solid #e8e2f5', borderRadius: 9, padding: '7px 11px', fontFamily: 'inherit' }}>
                      <option value="">-- Select Company --</option>
                      {companies.map(c => (
                        <option key={c.value} value={c.value}>{c.text}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="pa-field">
                  <label className="pa-lbl">Sender Email Id</label>
                  <div className="pa-val">{senderEmail}</div>
                </div>
              </div>

              {/* File list */}
              <div className="pa-mou-list">
                {files.length === 0 && compCd && (
                  <div className="pa-no-files">No files found for selected company.</div>
                )}
                {files.map(f => (
                  <div key={f.id} className="pa-mou-row">
                    <input
                      type="checkbox"
                      id={`chk-${f.id}`}
                      checked={selected.includes(f.filePath)}
                      onChange={() => toggleSelect(f.filePath)}
                    />
                    <div className="pa-mou-icon">
                      <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'none', stroke: '#fff', strokeWidth: 2 }}>
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </div>
                    <span className={`pa-badge ${f.documentType === 'MOU' ? 'pa-badge-mou' : 'pa-badge-ctr'}`}
                          style={{ marginLeft: 'auto' }}>
                      {f.documentType || f.documentNm}
                    </span>
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* Footer inside MOU card */}
          <div className="pa-footer">
            <button className="pa-btn-back" onClick={() => navigate('/provider/search')}>
              &#8592; Back
            </button>
            <button className="pa-btn-approve" onClick={handleApprove} disabled={sending}>
              {sending
                ? <><i className="fas fa-spinner fa-spin"></i>&nbsp;Sending…</>
                : <>Approve &amp; Send Contract</>}
            </button>
          </div>
        </PaCard>

      </div>

    </div>
  )
}

// ── Success Modal ────────────────────────────────────────────────────────────
function SuccessModal({ message, onClose }) {
  if (!message) return null
  return (
    <div className="vmodal-overlay" onClick={onClose}>
      <div className="vmodal-box" onClick={e => e.stopPropagation()}>
        <div className="vmodal-header" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
          <i className="fas fa-check-circle"></i>
          <span>Success</span>
        </div>
        <div className="vmodal-body">
          <ul className="vmodal-list">
            <li>
              <i className="fas fa-circle-dot" style={{ color: '#11998e' }}></i>
              {message}
            </li>
          </ul>
        </div>
        <div className="vmodal-footer">
          <button className="vmodal-ok" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }} onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  )
}

// ── Collapsible card (pa-* pattern) ─────────────────────────────────────────
function PaCard({ icon, title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="pa-card">
      <div className="pa-card-head" onClick={() => setOpen(o => !o)}>
        <div className="pa-card-title">
          <div className="pa-card-icon">{icon}</div>
          {title}
        </div>
        <span className="pa-chev" style={{ transform: open ? '' : 'rotate(-90deg)' }}>&#8964;</span>
      </div>
      {open && <div className="pa-card-body">{children}</div>}
    </div>
  )
}

// ── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ message, onOk, onCancel }) {
  return (
    <div className="csm-overlay" onClick={onCancel}>
      <div className="confirm-modal-box" onClick={e => e.stopPropagation()}>
        <div className="confirm-modal-body">
          <i className="fas fa-question-circle confirm-modal-icon"></i>
          <p>{message}</p>
        </div>
        <div className="confirm-modal-footer">
          <button className="confirm-btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="confirm-btn-ok"     onClick={onOk}>OK</button>
        </div>
      </div>
    </div>
  )
}

// ── SVG icons ────────────────────────────────────────────────────────────────
function HospitalIcon() {
  return (
    <svg viewBox="0 0 20 20" style={{ width: 15, height: 15, fill: '#fff' }}>
      <path d="M10 2C7.2 2 5 4.2 5 7c0 3.9 5 11 5 11s5-7.1 5-11c0-2.8-2.2-5-5-5zm0 6.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
    </svg>
  )
}
function MailIcon() {
  return (
    <svg viewBox="0 0 20 20" style={{ width: 15, height: 15, fill: '#fff' }}>
      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884zM18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
    </svg>
  )
}
function DocIcon() {
  return (
    <svg viewBox="0 0 20 20" style={{ width: 15, height: 15, fill: '#fff' }}>
      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/>
    </svg>
  )
}
