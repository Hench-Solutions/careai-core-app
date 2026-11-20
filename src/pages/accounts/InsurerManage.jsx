import { useState, useMemo } from 'react'

/* ── Demo data ────────────────────────────────────────────────────────────── */
const SEED = [
  { id: 1,  code: 'INS90000001', name: 'Dubai Insurance',    prefix: 'DI', currency: 'AED', exchangeRate: '18.50', agreementStart: '24-04-2026', agreementEnd: '24-04-2027', email: 'approvals@dubins.ae',                      address: 'Dubai Insurance Company P.O. Box 3027 Dubai, UAE' },
  { id: 2,  code: 'INS90000002', name: 'TMMC',               prefix: 'TM', currency: 'AED', exchangeRate: '0.00',  agreementStart: '23-04-2026', agreementEnd: '23-04-2027', email: 'huma.sethi@arabiaholdings.ae',               address: '17th St, Suite No. 601, Al Salemiya Tower, Riggat Al Buteen, Deira, Dubai, UAE' },
  { id: 3,  code: 'INS90000003', name: 'Pentacare',          prefix: 'PC', currency: 'AED', exchangeRate: '0.00',  agreementStart: '22-04-2026', agreementEnd: '22-04-2028', email: 'huma.sethi@arabiaholdings.ae',               address: 'P.O.Box 185408 - Dubai, United Arab Emirates' },
  { id: 4,  code: 'INS90000004', name: 'Amity Insurance',    prefix: 'AI', currency: 'AED', exchangeRate: '0.00',  agreementStart: '21-04-2026', agreementEnd: '21-04-2026', email: 'jimmy.chacko@amity.ae',                      address: 'PO Box 118833, Suite M01, Business Point Building, Port Saeed, Dubai, UAE' },
  { id: 5,  code: 'INS90000005', name: 'Whealth TMMC',       prefix: 'WI', currency: 'AED', exchangeRate: '0.00',  agreementStart: '20-04-2026', agreementEnd: '20-04-2027', email: 'jobel.gumnad@whealth-international.org',     address: 'Mezzanine Floor, Office # M-02, Commercial Bank of Dubai Bldg, Al Quoz Industrial 3, PO Box 26565, Dubai, UAE' },
  { id: 6,  code: 'INS90000006', name: 'Global Assistance',  prefix: 'GA', currency: 'USD', exchangeRate: '0.00',  agreementStart: '19-04-2026', agreementEnd: '19-04-2028', email: 'callcentrum@globalassistance.cz',             address: '6th floor, Kazandjian Bldg, 211-213 Street 64, Horsh Tabet, Metn, Lebanon' },
  { id: 7,  code: 'INS90000007', name: 'Methaq Insurance',   prefix: 'MQ', currency: 'AED', exchangeRate: '0.00',  agreementStart: '19-04-2026', agreementEnd: '19-04-2027', email: '—',                                          address: 'Plot No.126-129, Nouf Tower, Opp Business Village, Port Saeed, Deira, Dubai, UAE' },
  { id: 8,  code: 'INS90000008', name: 'NLGI',               prefix: 'NL', currency: 'AED', exchangeRate: '0.00',  agreementStart: '19-04-2026', agreementEnd: '19-04-2027', email: '—',                                          address: '—' },
  { id: 9,  code: 'INS90000009', name: 'Takaful Insurance',  prefix: 'TK', currency: 'AED', exchangeRate: '0.00',  agreementStart: '18-08-2026', agreementEnd: '18-08-2028', email: 's.mahmood@takafulemarat.com',                address: 'Sheikh Zayed Road, Near FAB Metro Station, Dubai, UAE' },
  { id: 10, code: 'INS90000010', name: 'Aafiya',             prefix: 'AA', currency: 'AED', exchangeRate: '18.50', agreementStart: '17-08-2026', agreementEnd: '17-08-2027', email: 'approvals@aafiya.ae',                        address: 'Office # 1101A, Al Saqr Business Tower, 91 Sheikh Zayed Rd, DIFC, Dubai, UAE' },
]

function emptyForm() {
  return {
    name: '', prefix: '', currency: '', agreementStart: '', agreementEnd: '',
    insurerType: '', isRateApply: 'no', agreementTermYear: '',
    address: '', pinCode: '', country: '', state: '', district: '', city: '',
    email: '', mobile: '', personName: '', personMobile: '', businessType: '', fax: '',
  }
}

const REQUIRED = ['name', 'prefix', 'agreementTermYear', 'address', 'email', 'fax']

/* ── Address tooltip cell ─────────────────────────────────────────────────── */
function AddressCell({ text }) {
  const [show, setShow] = useState(false)
  if (!text || text === '—') return <td className="agt-td-date">—</td>
  return (
    <td style={{ position: 'relative', maxWidth: 180 }}>
      <div
        style={{ maxWidth: 180, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', fontSize: 12.5, lineHeight: 1.45, cursor: 'default' }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {text}
      </div>
      {show && (
        <div style={{ position: 'absolute', left: 0, top: '100%', zIndex: 999, background: '#1A1035', color: '#fff', fontSize: 12, lineHeight: 1.5, padding: '8px 10px', borderRadius: 6, whiteSpace: 'normal', width: 260, boxShadow: '0 4px 16px rgba(107,63,160,0.12)', pointerEvents: 'none' }}>
          {text}
        </div>
      )}
    </td>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   LIST VIEW
══════════════════════════════════════════════════════════════════════════ */
function ListView({ insurers, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return insurers
    const q = search.toLowerCase()
    return insurers.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      r.prefix.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q)
    )
  }, [insurers, search])

  return (
    <>
      <div className="agt-page-header">
        <div className="agt-breadcrumb">
          <span className="agt-breadcrumb-active">Manage Insurer</span>
        </div>
        <button className="agt-btn-primary" onClick={onAdd}>
          <i className="fas fa-plus"></i> Add New
        </button>
      </div>

      <div className="agt-main">
        <div className="agt-toolbar">
          <div className="agt-search-wrap">
            <i className="fas fa-search agt-search-icon"></i>
            <input
              className="agt-search-input"
              type="text"
              placeholder="Search insurers…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="agt-table-card">
          <table style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: 48 }}>S.No.</th>
                <th>Insurer Code</th>
                <th>Insurer Name</th>
                <th>Prefix Code</th>
                <th>Currency Code</th>
                <th>Exchange Rate</th>
                <th>Address</th>
                <th>Agreement Signed Date</th>
                <th>Agreement End Date</th>
                <th>Email Id</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 24, color: '#9080b0' }}>
                    <i className="fas fa-info-circle"></i>&nbsp; No insurers found.
                  </td>
                </tr>
              ) : filtered.map((r, i) => (
                <tr key={r.id}>
                  <td className="agt-sno-cell">{i + 1}</td>
                  <td><span className="agt-td-code">{r.code}</span></td>
                  <td className="agt-td-name">{r.name}</td>
                  <td><span className="ins-prefix-badge">{r.prefix}</span></td>
                  <td>{r.currency}</td>
                  <td>{r.exchangeRate}</td>
                  <AddressCell text={r.address} />
                  <td className="agt-td-date">{r.agreementStart}</td>
                  <td className="agt-td-date">{r.agreementEnd}</td>
                  <td className="agt-td-email" style={{ fontSize: 12 }}>{r.email}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button className="agt-action-btn edit" title="Edit" onClick={() => onEdit(r)}>
                        <i className="fas fa-pencil-alt"></i>
                      </button>
                      <button className="agt-action-btn del" title="Delete"
                        onClick={() => { if (window.confirm(`Delete insurer "${r.name}"?`)) onDelete(r.id) }}>
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="agt-pagination">
            <button className="agt-page-btn nav">‹ Previous</button>
            {[1,2,3,4,5].map(n => (
              <button key={n} className={`agt-page-btn${n === 1 ? ' active' : ''}`}>{n}</button>
            ))}
            <button className="agt-page-btn">…</button>
            <button className="agt-page-btn">11</button>
            <button className="agt-page-btn nav">Next ›</button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   FORM VIEW
══════════════════════════════════════════════════════════════════════════ */
function FormView({ initial, onBack, onSubmit }) {
  const [form,   setForm]   = useState(initial || emptyForm())
  const [errors, setErrors] = useState({})

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: '' })) }

  function handleSubmit() {
    const e = {}
    REQUIRED.forEach(k => { if (!form[k]?.trim()) e[k] = 'This field is required.' })
    setErrors(e)
    if (Object.keys(e).length) return
    onSubmit(form)
  }

  const isEdit = !!initial

  return (
    <>
      <div className="agt-page-header">
        <div className="agt-breadcrumb">
          <span>Insurer</span>
          <span className="agt-breadcrumb-sep">›</span>
          <span className="agt-breadcrumb-active">{isEdit ? 'Edit Insurer' : 'Add New Insurer'}</span>
        </div>
        <button className="agt-btn-secondary" onClick={onBack}>← Back to List</button>
      </div>

      <div className="agt-main">
        <div className="agt-form-card">
          <div className="agt-form-section-head">
            <div className="agt-grad-bar"></div>
            <span className="agt-form-section-title">Insurer Information</span>
          </div>

          <div className="agt-form-grid">

            <Field label="Insurer Name" required error={errors.name}>
              <input className={`agt-cb-input${errors.name ? ' agt-input-err' : ''}`} type="text"
                placeholder="Enter insurer name" value={form.name} onChange={e => set('name', e.target.value)} />
            </Field>

            <Field label="Insurer Prefix Code" required error={errors.prefix}>
              <input className={`agt-cb-input${errors.prefix ? ' agt-input-err' : ''}`} type="text"
                placeholder="e.g. DI, TM, PC" value={form.prefix} onChange={e => set('prefix', e.target.value)} />
            </Field>

            <Field label="Currency Code">
              <select className="agt-cb-select" value={form.currency} onChange={e => set('currency', e.target.value)}>
                <option value="">— Select —</option>
                {['AED','USD','EUR','GBP','INR'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>

            <Field label="Agreement Signed Date">
              <input className="agt-cb-input" type="date" value={form.agreementStart} onChange={e => set('agreementStart', e.target.value)} />
            </Field>

            <Field label="Agreement End Date">
              <input className="agt-cb-input" type="date" value={form.agreementEnd} onChange={e => set('agreementEnd', e.target.value)} />
            </Field>

            <Field label="Insurer Type">
              <select className="agt-cb-select" value={form.insurerType} onChange={e => set('insurerType', e.target.value)}>
                <option value="">— Select —</option>
                {['Health Insurance','Life Insurance','General Insurance','Takaful'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>

            <Field label="Is Rate Apply">
              <div className="agt-radio-group">
                {['yes','no'].map(v => (
                  <label key={v} className="agt-radio-label">
                    <input type="radio" name="insRate" value={v}
                      checked={form.isRateApply === v} onChange={() => set('isRateApply', v)} />
                    {v === 'yes' ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Agreement Term Year" required error={errors.agreementTermYear}>
              <input className={`agt-cb-input${errors.agreementTermYear ? ' agt-input-err' : ''}`} type="number"
                placeholder="e.g. 1, 2, 3" value={form.agreementTermYear} onChange={e => set('agreementTermYear', e.target.value)} />
            </Field>

            <Field label="Address" required full error={errors.address}>
              <textarea className={`agt-cb-textarea${errors.address ? ' agt-input-err' : ''}`}
                placeholder="Enter full address…" value={form.address} onChange={e => set('address', e.target.value)} />
            </Field>

            <Field label="Pin Code">
              <input className="agt-cb-input" type="text" placeholder="Postal / ZIP code"
                value={form.pinCode} onChange={e => set('pinCode', e.target.value)} />
            </Field>

            <Field label="Country">
              <select className="agt-cb-select" value={form.country} onChange={e => set('country', e.target.value)}>
                <option value="">— Select —</option>
                {['United Arab Emirates','India','Saudi Arabia','Oman','Kuwait'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>

            <Field label="State">
              <select className="agt-cb-select" value={form.state} onChange={e => set('state', e.target.value)}>
                <option value="">— Select —</option>
              </select>
            </Field>

            <Field label="District">
              <select className="agt-cb-select" value={form.district} onChange={e => set('district', e.target.value)}>
                <option value="">— Select —</option>
              </select>
            </Field>

            <Field label="City">
              <select className="agt-cb-select" value={form.city} onChange={e => set('city', e.target.value)}>
                <option value="">— Select —</option>
              </select>
            </Field>

            <Field label="Email Id" required error={errors.email}>
              <input className={`agt-cb-input${errors.email ? ' agt-input-err' : ''}`} type="email"
                placeholder="contact@insurer.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </Field>

            <Field label="Mobile No">
              <input className="agt-cb-input" type="tel" placeholder="+971 XX XXX XXXX"
                value={form.mobile} onChange={e => set('mobile', e.target.value)} />
            </Field>

            <Field label="Person Name">
              <input className="agt-cb-input" type="text" placeholder="Contact person name"
                value={form.personName} onChange={e => set('personName', e.target.value)} />
            </Field>

            <Field label="Person Mobile Number">
              <input className="agt-cb-input" type="tel" placeholder="+971 XX XXX XXXX"
                value={form.personMobile} onChange={e => set('personMobile', e.target.value)} />
            </Field>

            <Field label="Business Type">
              <input className="agt-cb-input" type="text" placeholder="e.g. TPA, Direct, Broker"
                value={form.businessType} onChange={e => set('businessType', e.target.value)} />
            </Field>

            <Field label="FAX Number" required error={errors.fax}>
              <input className={`agt-cb-input${errors.fax ? ' agt-input-err' : ''}`} type="text"
                placeholder="+971 X XXX XXXX" value={form.fax} onChange={e => set('fax', e.target.value)} />
            </Field>

          </div>

          <hr className="agt-form-divider" />

          <div className="agt-form-footer">
            <button className="agt-btn-primary" style={{ minWidth: 110 }} onClick={handleSubmit}>
              <i className="fas fa-check"></i> {isEdit ? 'Update' : 'Submit'}
            </button>
            <button className="agt-btn-secondary" style={{ minWidth: 90 }} onClick={onBack}>
              Back
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ label, required, full, error, children }) {
  return (
    <div className={`agt-form-field${full ? ' full' : ''}`}>
      <label className="agt-form-label">
        {label}{required && <span className="agt-req"> *</span>}
      </label>
      {children}
      {error && <span className="agt-field-err">{error}</span>}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════════════════════════ */
export default function InsurerManage() {
  const [insurers, setInsurers] = useState(SEED)
  const [view,     setView]     = useState('list')
  const [editing,  setEditing]  = useState(null)

  function openAdd()         { setEditing(null); setView('form') }
  function openEdit(insurer) { setEditing(insurer); setView('form') }
  function backToList()      { setView('list'); setEditing(null) }

  function handleDelete(id) { setInsurers(prev => prev.filter(r => r.id !== id)) }

  function handleSubmit(form) {
    if (editing) {
      setInsurers(prev => prev.map(r => r.id === editing.id ? { ...r, ...form } : r))
      window.alert('Insurer updated successfully!')
    } else {
      setInsurers(prev => [...prev, { ...form, id: Date.now(), code: `INS9${String(Date.now()).slice(-7)}` }])
      window.alert('Insurer added successfully!')
    }
    backToList()
  }

  return (
    <div className="agt-page">
      {view === 'list'
        ? <ListView insurers={insurers} onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete} />
        : <FormView initial={editing} onBack={backToList} onSubmit={handleSubmit} />
      }
    </div>
  )
}
