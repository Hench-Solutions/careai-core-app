import { useState, useMemo } from 'react'

/* ── Demo data ────────────────────────────────────────────────────────────── */
const SEED = [
  { id: 1,  name: 'Mr. Aman Negi',          gender: 'Male', dob: '29-01-2000', agentCode: 'EH10177', email: 'aman.negi@eexpedisehealth.com',              contact: '7428090281', status: 'Active'   },
  { id: 2,  name: 'Mr. Sahil Sharma',        gender: 'Male', dob: '07-07-1997', agentCode: 'EH10184', email: 'sahil.sharma@prosperaglobalsolutions.com',    contact: '7428489803', status: 'Active'   },
  { id: 3,  name: 'Mr. Vineet OV',           gender: 'Male', dob: '27-02-1990', agentCode: 'EH10190', email: 'vineet.ov@evantio.com',                       contact: '565227288',  status: 'Active'   },
  { id: 4,  name: 'Mr. Shivam Singh',        gender: 'Male', dob: '27-10-1998', agentCode: 'EH10183', email: 'shivam.singh@eexpedisehealth.com',             contact: '9411888463', status: 'Active'   },
  { id: 5,  name: 'Mr. Takaful Insurance',   gender: 'Male', dob: '15-09-2023', agentCode: 'EH10201', email: 'takaful@insurance.com',                       contact: '9999999999', status: 'Active'   },
  { id: 6,  name: 'Mr. AlSagr Agent',        gender: 'Male', dob: '15-09-2023', agentCode: 'EH10202', email: 'alsagr@insurance.com',                        contact: '9999999999', status: 'Active'   },
  { id: 7,  name: 'Mr. Varun Bambha',        gender: 'Male', dob: '21-11-1999', agentCode: 'EH10187', email: 'varun.bambha@eexpedisehealth.com',             contact: '7428089168', status: 'Active'   },
  { id: 8,  name: 'Mr. Doha Takaful Admin',  gender: 'Male', dob: '27-10-2023', agentCode: 'EH10205', email: 'dtakaful.admin@gmail.com',                    contact: '9999999999', status: 'Active'   },
  { id: 9,  name: 'Mr. Amit Chopra',         gender: 'Male', dob: '01-11-1993', agentCode: 'EH10189', email: 'amit.chopra@prosperaglobalsolutions.com',      contact: '9903807420', status: 'Active'   },
  { id: 10, name: 'Mr. Rahul Lewis',         gender: 'Male', dob: '21-09-1998', agentCode: 'EH10194', email: 'rahul.lewis@eexpedisehealth.com',              contact: '565227288',  status: 'Active'   },
]

function emptyForm() {
  return {
    name: '', agentCode: '', gender: '', dob: '', email: '', contact: '',
    altContact: '', agentType: '', joiningDate: '', licenseNo: '', licenseExpiry: '',
    commissionApplicable: 'no', commissionRate: '', businessType: '',
    address: '', pinCode: '', country: '', state: '', district: '', city: '',
    panNo: '', gstNo: '', status: 'Active',
  }
}

const REQUIRED = ['name', 'agentCode', 'gender', 'dob', 'email', 'contact', 'address']

/* ══════════════════════════════════════════════════════════════════════════
   LIST VIEW
══════════════════════════════════════════════════════════════════════════ */
function ListView({ agents, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return agents
    const q = search.toLowerCase()
    return agents.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.agentCode.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.contact.includes(q)
    )
  }, [agents, search])

  return (
    <>
      {/* Header bar */}
      <div className="agt-page-header">
        <div className="agt-breadcrumb">
          <span className="agt-breadcrumb-active">Manage Agents</span>
        </div>
        <button className="agt-btn-primary" onClick={onAdd}>
          <i className="fas fa-plus"></i> Add New
        </button>
      </div>

      <div className="agt-main">
        {/* Search toolbar */}
        <div className="agt-toolbar">
          <label style={{ fontSize: 13, color: 'var(--agt-muted)' }}>Search:</label>
          <div className="agt-search-wrap">
            <i className="fas fa-search agt-search-icon"></i>
            <input
              className="agt-search-input"
              type="text"
              placeholder="Search agents…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="agt-table-card">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: 48 }}>S.No</th>
                <th>Name</th>
                <th>Gender</th>
                <th>Date Of Birth</th>
                <th>Agent Code</th>
                <th>Email Id</th>
                <th>Contact Number</th>
                <th style={{ textAlign: 'center' }}>Edit</th>
                <th style={{ textAlign: 'center' }}>Delete</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: '#9080b0' }}>
                    <i className="fas fa-info-circle"></i>&nbsp; No agents found.
                  </td>
                </tr>
              ) : filtered.map((a, i) => (
                <tr key={a.id}>
                  <td className="agt-sno-cell">{String(i + 1).padStart(2, '0')}</td>
                  <td className="agt-td-name">{a.name}</td>
                  <td><span className="agt-td-badge-m">{a.gender}</span></td>
                  <td className="agt-td-date">{a.dob}</td>
                  <td><span className="agt-td-code">{a.agentCode}</span></td>
                  <td className="agt-td-email">{a.email}</td>
                  <td>{a.contact}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="agt-action-btn edit" title="Edit" onClick={() => onEdit(a)}>
                      <i className="fas fa-pencil-alt"></i>
                    </button>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="agt-action-btn del" title="Delete"
                      onClick={() => { if (window.confirm(`Delete agent "${a.name}"?`)) onDelete(a.id) }}>
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination (static) */}
          <div className="agt-pagination">
            <button className="agt-page-btn nav">‹ Previous</button>
            <button className="agt-page-btn active">1</button>
            <button className="agt-page-btn">2</button>
            <button className="agt-page-btn">3</button>
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

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }))
    setErrors(p => ({ ...p, [k]: '' }))
  }

  function handleSubmit() {
    const e = {}
    REQUIRED.forEach(k => { if (!form[k].trim()) e[k] = 'This field is required.' })
    setErrors(e)
    if (Object.keys(e).length) return
    onSubmit(form)
  }

  const isEdit = !!initial

  return (
    <>
      {/* Header bar */}
      <div className="agt-page-header">
        <div className="agt-breadcrumb">
          <span>Agent</span>
          <span className="agt-breadcrumb-sep">›</span>
          <span className="agt-breadcrumb-active">{isEdit ? 'Edit Agent' : 'Add New Agent'}</span>
        </div>
        <button className="agt-btn-secondary" onClick={onBack}>← Back to List</button>
      </div>

      <div className="agt-main">
        <div className="agt-form-card">
          <div className="agt-form-section-head">
            <div className="agt-grad-bar"></div>
            <span className="agt-form-section-title">{isEdit ? 'Edit Agent' : 'Add New Agent'}</span>
          </div>

          <div className="agt-form-grid">

            <Field label="Agent Name" required error={errors.name}>
              <input className={`agt-cb-input${errors.name ? ' agt-input-err' : ''}`} type="text"
                placeholder="Enter agent full name" value={form.name} onChange={e => set('name', e.target.value)} />
            </Field>

            <Field label="Agent Code" required error={errors.agentCode}>
              <input className={`agt-cb-input${errors.agentCode ? ' agt-input-err' : ''}`} type="text"
                placeholder="e.g. AGT001" value={form.agentCode} onChange={e => set('agentCode', e.target.value)} />
            </Field>

            <Field label="Gender" required error={errors.gender}>
              <select className={`agt-cb-select${errors.gender ? ' agt-input-err' : ''}`}
                value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">— Select —</option>
                {['Male','Female','Other'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>

            <Field label="Date of Birth" required error={errors.dob}>
              <input className={`agt-cb-input${errors.dob ? ' agt-input-err' : ''}`} type="date"
                value={form.dob} onChange={e => set('dob', e.target.value)} />
            </Field>

            <Field label="Email Id" required error={errors.email}>
              <input className={`agt-cb-input${errors.email ? ' agt-input-err' : ''}`} type="email"
                placeholder="agent@company.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </Field>

            <Field label="Contact Number" required error={errors.contact}>
              <input className={`agt-cb-input${errors.contact ? ' agt-input-err' : ''}`} type="tel"
                placeholder="+91 XXXXX XXXXX" value={form.contact} onChange={e => set('contact', e.target.value)} />
            </Field>

            <Field label="Alternate Contact Number">
              <input className="agt-cb-input" type="tel" placeholder="+91 XXXXX XXXXX"
                value={form.altContact} onChange={e => set('altContact', e.target.value)} />
            </Field>

            <Field label="Agent Type">
              <select className="agt-cb-select" value={form.agentType} onChange={e => set('agentType', e.target.value)}>
                <option value="">— Select —</option>
                {['Individual','Corporate','Broker','Agency'].map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>

            <Field label="Joining Date">
              <input className="agt-cb-input" type="date" value={form.joiningDate} onChange={e => set('joiningDate', e.target.value)} />
            </Field>

            <Field label="License Number">
              <input className="agt-cb-input" type="text" placeholder="Enter license number"
                value={form.licenseNo} onChange={e => set('licenseNo', e.target.value)} />
            </Field>

            <Field label="License Expiry Date">
              <input className="agt-cb-input" type="date" value={form.licenseExpiry} onChange={e => set('licenseExpiry', e.target.value)} />
            </Field>

            <Field label="Commission Applicable">
              <div className="agt-radio-group">
                {['yes','no'].map(v => (
                  <label key={v} className="agt-radio-label">
                    <input type="radio" name="commissionApplicable" value={v}
                      checked={form.commissionApplicable === v}
                      onChange={() => set('commissionApplicable', v)} />
                    {v === 'yes' ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Commission Rate (%)">
              <input className="agt-cb-input" type="number" placeholder="e.g. 5"
                value={form.commissionRate} onChange={e => set('commissionRate', e.target.value)} />
            </Field>

            <Field label="Business Type">
              <input className="agt-cb-input" type="text" placeholder="e.g. Retail, Corporate"
                value={form.businessType} onChange={e => set('businessType', e.target.value)} />
            </Field>

            <Field label="Address" required full error={errors.address}>
              <textarea className={`agt-cb-textarea${errors.address ? ' agt-input-err' : ''}`}
                placeholder="Enter full address..."
                value={form.address} onChange={e => set('address', e.target.value)} />
            </Field>

            <Field label="Pin Code">
              <input className="agt-cb-input" type="text" placeholder="Postal / ZIP code"
                value={form.pinCode} onChange={e => set('pinCode', e.target.value)} />
            </Field>

            <Field label="Country">
              <select className="agt-cb-select" value={form.country} onChange={e => set('country', e.target.value)}>
                <option value="">— Select —</option>
                {['India','United Arab Emirates','Saudi Arabia','Oman','Kuwait'].map(o => <option key={o}>{o}</option>)}
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

            <Field label="PAN Number">
              <input className="agt-cb-input" type="text" placeholder="Enter PAN number"
                value={form.panNo} onChange={e => set('panNo', e.target.value)} />
            </Field>

            <Field label="GST Number">
              <input className="agt-cb-input" type="text" placeholder="Enter GST number"
                value={form.gstNo} onChange={e => set('gstNo', e.target.value)} />
            </Field>

            <Field label="Status">
              <select className="agt-cb-select" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
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

/* tiny helper to keep field markup DRY */
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
export default function AgentManage() {
  const [agents,  setAgents]  = useState(SEED)
  const [view,    setView]    = useState('list')   // 'list' | 'form'
  const [editing, setEditing] = useState(null)     // agent object when editing

  function openAdd()       { setEditing(null); setView('form') }
  function openEdit(agent) { setEditing(agent); setView('form') }
  function backToList()    { setView('list'); setEditing(null) }

  function handleDelete(id) {
    setAgents(prev => prev.filter(a => a.id !== id))
  }

  function handleSubmit(form) {
    if (editing) {
      setAgents(prev => prev.map(a => a.id === editing.id ? { ...a, ...form } : a))
      window.alert('Agent updated successfully!')
    } else {
      const newAgent = { ...form, id: Date.now() }
      setAgents(prev => [...prev, newAgent])
      window.alert('Agent added successfully!')
    }
    backToList()
  }

  return (
    <div className="agt-page">
      {view === 'list' ? (
        <ListView agents={agents} onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete} />
      ) : (
        <FormView initial={editing} onBack={backToList} onSubmit={handleSubmit} />
      )}
    </div>
  )
}
