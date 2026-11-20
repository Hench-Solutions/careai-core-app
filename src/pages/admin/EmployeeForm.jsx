import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { fetchEmployeeDetail, saveEmployee, apiFetch } from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'

function SuccessModal({ message, onClose }) {
  if (!message) return null
  return (
    <div className="vmodal-overlay" onClick={onClose}>
      <div className="confirm-modal-box" onClick={e => e.stopPropagation()}>
        <div className="confirm-modal-header" style={{ background: 'linear-gradient(135deg,#38ef7d,#11998e)' }}>
          <i className="fas fa-check-circle"></i>&nbsp; Success
        </div>
        <div className="confirm-modal-body">{message}</div>
        <div className="confirm-modal-footer">
          <button className="btn-gradient" style={{ minWidth: 80 }} onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  )
}

const EMPTY = {
  title: '', firstNm: '', lastNm: '', gender: '', employeeCd: '',
  userNm: '', userType: '', departmentCd: '', designationCd: '',
  highestQualification: '', locationCode: '', dateOfJoining: '',
  reportingManagerCd: '', panNumber: '', dob: '',
  address: '', countryCd: '', state: '', city: '', pincode: '',
  personalMobileNo: '', personalEmailId: '', emailId: '', mobileNo: '',
  landlineNo: '', extensionNo: '',
  userGroupId: '', actvInd: 1
}

async function fetchDdl(mode, filterId) {
  const params = new URLSearchParams({ mode })
  if (filterId) params.append('filterId', filterId)
  try {
    const data = await apiFetch(`/Master/dropdown?${params}`)
    return data?.responseObj ?? []
  } catch { return [] }
}

function toDateInput(val) {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
}

async function fetchGroups() {
  try {
    const data = await apiFetch('/Admin/groups?mode=B&pageLevel=0&parentId=0')
    return data?.responseObj ?? []
  } catch { return [] }
}

export default function EmployeeForm() {
  const navigate    = useNavigate()
  const location    = useLocation()
  const { id }      = useParams()
  const isEdit      = !!id
  const empCd       = location.state?.employeeCd || ''

  const [form,               setForm]               = useState(EMPTY)
  const [loading,            setLoading]            = useState(isEdit)
  const [saving,             setSaving]             = useState(false)
  const [modalMsgs,          setModalMsgs]          = useState([])
  const [successMsg,         setSuccessMsg]         = useState('')
  const [selectedAvailableId, setSelectedAvailableId] = useState('')

  // Dropdowns
  const [ddlTitle,       setDdlTitle]       = useState([])
  const [ddlDept,        setDdlDept]        = useState([])
  const [ddlDesig,       setDdlDesig]       = useState([])
  const [ddlUserType,    setDdlUserType]     = useState([])
  const [ddlLocation,    setDdlLocation]    = useState([])
  const [ddlCountry,     setDdlCountry]     = useState([])
  const [ddlState,       setDdlState]       = useState([])
  const [ddlCity,        setDdlCity]        = useState([])
  const [ddlGroups,      setDdlGroups]      = useState([])
  const [ddlReportingManager, setDdlReportingManager] = useState([])

  // Load all static dropdowns on mount
  useEffect(() => {
    Promise.all([
      fetchDdl('ddlTitle'),
      fetchDdl('ddlDepartment'),
      fetchDdl('ddlDesignation'),
      fetchDdl('ddlUserType'),
      fetchDdl('ddlOfficeLocation'),
      fetchDdl('ddlNationality'),
      fetchGroups()
    ]).then(([title, dept, desig, utype, loc, country, groups]) => {
      setDdlTitle(title)
      setDdlDept(dept)
      setDdlDesig(desig)
      setDdlUserType(utype)
      setDdlLocation(loc)
      setDdlCountry(country)
      setDdlGroups(groups)
    })
  }, [])

  // Reporting Manager dropdown — every active employee, excluding self in Edit mode
  // (self-reference guard: nobody can be their own reporting manager).
  useEffect(() => {
    fetchDdl('drpReportingManager', isEdit ? empCd : '').then(setDdlReportingManager)
  }, [isEdit, empCd])

  // Load employee detail in edit mode
  useEffect(() => {
    if (!isEdit) return
    fetchEmployeeDetail(id, empCd)
      .then(detail => {
        if (!detail) return
        setForm({
          title:                detail.title         || '',
          firstNm:              detail.firstNm       || '',
          lastNm:               detail.lastNm        || '',
          gender:               detail.gender        || '',
          employeeCd:           detail.employeeCd    || '',
          userNm:               detail.userNm        || '',
          userType:             detail.userType      || '',
          departmentCd:         detail.departmentCd  || '',
          designationCd:        detail.designationCd || '',
          highestQualification: detail.highestQualification || '',
          locationCode:         detail.locationCode  || '',
          dateOfJoining:        toDateInput(detail.dateOfJoining),
          reportingManagerCd:   detail.reportingManagerCd || '',
          panNumber:            detail.panNumber     || '',
          dob:                  toDateInput(detail.dob),
          address:              detail.address       || '',
          countryCd:            detail.countryCd     || '',
          state:                detail.state         || '',
          city:                 detail.city || detail.district || '',
          pincode:              detail.pincode       || '',
          personalMobileNo:     detail.personalMobileNo || '',
          personalEmailId:      detail.personalEmailId || '',
          emailId:              detail.emailId       || '',
          mobileNo:             detail.mobileNo      || '',
          landlineNo:           detail.landlineNo    || '',
          extensionNo:          detail.extensionNo   || '',
          userGroupId:          detail.userGroupId ? String(detail.userGroupId) : '',
          actvInd:              detail.actvInd ?? 1
        })
        // Cascade: reload state + city dropdowns so selected values are visible
        if (detail.countryCd) fetchDdl('ddlState', detail.countryCd).then(setDdlState)
        if (detail.state)     fetchDdl('ddlDistrict', detail.state).then(setDdlCity)
      })
      .catch(err => setModalMsgs([`Failed to load employee details. ${err.message || ''}`]))
      .finally(() => setLoading(false))
  }, [id])

  const handleChange = e => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const onCountryChange = e => {
    const val = e.target.value
    setForm(prev => ({ ...prev, countryCd: val, state: '', city: '' }))
    setDdlState([]); setDdlCity([])
    if (val) fetchDdl('ddlState', val).then(setDdlState)
  }

  const onStateChange = e => {
    const val = e.target.value
    setForm(prev => ({ ...prev, state: val, city: '' }))
    setDdlCity([])
    if (val) fetchDdl('ddlDistrict', val).then(setDdlCity)
  }

  const onAssign = () => {
    if (!selectedAvailableId) return
    setForm(prev => ({ ...prev, userGroupId: selectedAvailableId }))
    setSelectedAvailableId('')
  }

  const onUnassign = () => {
    setForm(prev => ({ ...prev, userGroupId: '' }))
  }

  function validate() {
    const e = {}
    if (!form.firstNm.trim())  e.firstNm  = 'First Name is required'
    if (!form.employeeCd.trim()) e.employeeCd = 'Employee Code is required'
    if (!form.userNm.trim())   e.userNm   = 'Username is required'
    if (!form.emailId.trim())  e.emailId  = 'Office Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailId.trim())) e.emailId = 'Enter a valid email'
    if (!form.userGroupId)     e.userGroupId = 'User Group is required'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setModalMsgs(Object.values(errs))
      return
    }

    setSaving(true)
    try {
      await saveEmployee({
        mode:                 isEdit ? 'U' : 'I',
        id:                   isEdit ? Number(id) : null,
        employeeCd:           isEdit ? empCd : form.employeeCd.trim(),
        title:                form.title,
        firstNm:              form.firstNm.trim(),
        lastNm:               form.lastNm.trim(),
        fullNm:               `${form.firstNm.trim()} ${form.lastNm.trim()}`.trim(),
        gender:               form.gender,
        userNm:               form.userNm.trim(),
        userType:             form.userType,
        departmentCd:         form.departmentCd,
        designationCd:        form.designationCd,
        highestQualification: form.highestQualification,
        locationCode:         form.locationCode,
        dateOfJoining:        form.dateOfJoining || null,
        reportingManagerCd:   form.reportingManagerCd,
        panNumber:            form.panNumber,
        dob:                  form.dob || null,
        address:              form.address,
        countryCd:            form.countryCd,
        state:                form.state,
        city:                 form.city,
        pincode:              form.pincode,
        personalMobileNo:     form.personalMobileNo ? Number(form.personalMobileNo) : null,
        personalEmailId:      form.personalEmailId,
        emailId:              form.emailId.trim(),
        mobileNo:             form.mobileNo ? Number(form.mobileNo) : null,
        landlineNo:           form.landlineNo,
        extensionNo:          form.extensionNo,
        userGroupId:          form.userGroupId ? Number(form.userGroupId) : null,
        actvInd:              Number(form.actvInd)
      })
      setSuccessMsg(isEdit ? 'Employee updated successfully.' : 'Employee added successfully.')
    } catch (err) {
      setModalMsgs([err.message || 'Failed to save employee. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="lsrch-page">
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
          <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Loading...
        </div>
      </div>
    )
  }

  const field = (label, name, type = 'text', required = false) => (
    <div className="leadform-field">
      <label className="leadform-field-label">{label}{required && <span style={{ color: '#e53e3e' }}> *</span>}</label>
      <input className="leadform-field-input" type={type} name={name}
        value={form[name]} onChange={handleChange} />
    </div>
  )

  const select = (label, name, options, required = false, onChange = handleChange) => (
    <div className="leadform-field">
      <label className="leadform-field-label">{label}{required && <span style={{ color: '#e53e3e' }}> *</span>}</label>
      <select className="leadform-field-input" name={name} value={form[name]} onChange={onChange}>
        <option value="">-- Select --</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.text}</option>)}
      </select>
    </div>
  )

  return (
    <div className="lsrch-page">
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />
      <SuccessModal message={successMsg} onClose={() => navigate('/admin/employees')} />

      <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>{isEdit ? 'Edit Employee' : 'Add Employee'}</h2>
        <button className="btn-outline" style={{ fontSize: 13, padding: '7px 16px' }}
          onClick={() => navigate('/admin/employees')}>
          <i className="fas fa-arrow-left"></i>&nbsp; Back
        </button>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── Personal Information ── */}
        <div className="panel-card" style={{ marginBottom: 16 }}>
          <div className="lsrch-section-title" style={{ fontWeight: 600, color: '#2e1d55', marginBottom: 14, fontSize: 14 }}>
            <i className="fas fa-user" style={{ marginRight: 6, color: '#667eea' }}></i> Personal Information
          </div>
          <div className="leadform-grid-2">
            {select('Title', 'title', ddlTitle)}
            {field('First Name *', 'firstNm')}
            {field('Last Name', 'lastNm')}
            <div className="leadform-field">
              <label className="leadform-field-label">Gender</label>
              <select className="leadform-field-input" name="gender" value={form.gender} onChange={handleChange}>
                <option value="">-- Select --</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            {field('Date of Birth', 'dob', 'date')}
            {field('PAN Number', 'panNumber')}
            {field('Highest Qualification', 'highestQualification')}
          </div>
        </div>

        {/* ── Employment Information ── */}
        <div className="panel-card" style={{ marginBottom: 16 }}>
          <div className="lsrch-section-title" style={{ fontWeight: 600, color: '#2e1d55', marginBottom: 14, fontSize: 14 }}>
            <i className="fas fa-briefcase" style={{ marginRight: 6, color: '#667eea' }}></i> Employment Information
          </div>
          <div className="leadform-grid-2">
            {field('Employee Code *', 'employeeCd')}
            {field('Username *', 'userNm')}
            {select('User Type', 'userType', ddlUserType)}
            {select('Department', 'departmentCd', ddlDept)}
            {select('Designation', 'designationCd', ddlDesig)}
            {select('Office Location', 'locationCode', ddlLocation)}
            {field('Date of Joining', 'dateOfJoining', 'date')}
            {select('Reporting Manager', 'reportingManagerCd', ddlReportingManager)}
          </div>
        </div>

        {/* ── Address ── */}
        <div className="panel-card" style={{ marginBottom: 16 }}>
          <div className="lsrch-section-title" style={{ fontWeight: 600, color: '#2e1d55', marginBottom: 14, fontSize: 14 }}>
            <i className="fas fa-map-marker-alt" style={{ marginRight: 6, color: '#667eea' }}></i> Address
          </div>
          <div className="leadform-grid-2">
            <div className="leadform-field" style={{ gridColumn: '1 / -1' }}>
              <label className="leadform-field-label">Address</label>
              <textarea className="leadform-field-textarea" name="address" rows={2}
                value={form.address} onChange={handleChange} />
            </div>
            {select('Country', 'countryCd', ddlCountry, false, onCountryChange)}
            {select('State', 'state', ddlState, false, onStateChange)}
            {select('City', 'city', ddlCity)}
            {field('Pincode', 'pincode')}
          </div>
        </div>

        {/* ── Contact Information ── */}
        <div className="panel-card" style={{ marginBottom: 16 }}>
          <div className="lsrch-section-title" style={{ fontWeight: 600, color: '#2e1d55', marginBottom: 14, fontSize: 14 }}>
            <i className="fas fa-phone" style={{ marginRight: 6, color: '#667eea' }}></i> Contact Information
          </div>
          <div className="leadform-grid-2">
            {field('Office Email *', 'emailId', 'email')}
            {field('Office Mobile', 'mobileNo', 'tel')}
            {field('Landline No.', 'landlineNo')}
            {field('Extension No.', 'extensionNo')}
            {field('Personal Email', 'personalEmailId', 'email')}
            {field('Personal Mobile', 'personalMobileNo', 'tel')}
          </div>
        </div>

        {/* ── Role Information ── */}
        <div className="panel-card" style={{ marginBottom: 16 }}>
          <div className="lsrch-section-title" style={{ fontWeight: 600, color: '#2e1d55', marginBottom: 14, fontSize: 14 }}>
            <i className="fas fa-shield-alt" style={{ marginRight: 6, color: '#667eea' }}></i> Role Information
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

            {/* Available Roles */}
            <div style={{ flex: 1 }}>
              <label className="leadform-field-label" style={{ marginBottom: 6, display: 'block' }}>Available Roles</label>
              <select
                multiple
                className="leadform-field-input"
                style={{ height: 160, overflowY: 'auto' }}
                value={selectedAvailableId ? [selectedAvailableId] : []}
                onChange={e => setSelectedAvailableId(Array.from(e.target.selectedOptions)[0]?.value || '')}>
                {ddlGroups
                  .filter(g => String(g.id) !== String(form.userGroupId))
                  .map(g => <option key={g.id} value={String(g.id)}>{g.groupNm}</option>)}
              </select>
            </div>

            {/* Transfer buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 28 }}>
              <button type="button" className="btn-gradient"
                style={{ padding: '7px 14px', fontSize: 13 }}
                title="Assign role"
                disabled={!selectedAvailableId}
                onClick={onAssign}>
                <i className="fas fa-angle-double-right"></i>
              </button>
              <button type="button" className="btn-outline"
                style={{ padding: '7px 14px', fontSize: 13 }}
                title="Remove role"
                disabled={!form.userGroupId}
                onClick={onUnassign}>
                <i className="fas fa-angle-double-left"></i>
              </button>
            </div>

            {/* Assigned Role */}
            <div style={{ flex: 1 }}>
              <label className="leadform-field-label" style={{ marginBottom: 6, display: 'block' }}>
                Assigned Role <span style={{ color: '#e53e3e' }}>*</span>
              </label>
              <select
                multiple
                className="leadform-field-input"
                style={{ height: 160, overflowY: 'auto' }}
                readOnly>
                {form.userGroupId && ddlGroups
                  .filter(g => String(g.id) === String(form.userGroupId))
                  .map(g => <option key={g.id} value={String(g.id)}>{g.groupNm}</option>)}
              </select>
            </div>

          </div>

          {/* Status below the listboxes */}
          <div style={{ marginTop: 14, maxWidth: 220 }}>
            <div className="leadform-field">
              <label className="leadform-field-label">Status</label>
              <select className="leadform-field-input" name="actvInd" value={form.actvInd} onChange={handleChange}>
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          </div>

        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginBottom: 24 }}>
          <button type="button" className="btn-outline" style={{ fontSize: 13, padding: '8px 24px' }}
            onClick={() => navigate('/admin/employees')}>
            Cancel
          </button>
          <button type="submit" className="btn-gradient" style={{ fontSize: 13, padding: '8px 28px' }}
            disabled={saving}>
            {saving
              ? <><i className="fas fa-spinner fa-spin"></i> Saving...</>
              : <><i className="fas fa-save"></i> {isEdit ? 'Update' : 'Save'}</>}
          </button>
        </div>

      </form>
    </div>
  )
}
