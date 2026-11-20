import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLeadByClaimNo, fetchMyBranches, fetchMyDoctors, submitEstimateRequest } from '../../utils/api'
import { authUtils } from '../../utils/auth'
import PatientInfoCard from '../../components/PatientInfoCard'
import ValidationModal from '../../components/ValidationModal'

/* ═══════════════════════════════════════════════════════════════════════════
   ProviderEstimateRequest — Proceed for Estimate (Provider portal variant,
   mirrors MedTour estimation_request.aspx). Branch + Doctor selection only —
   both scoped to the logged-in Provider-portal user's own provider via the
   my-branches/my-doctors endpoints (Prv_Cd resolved server-side from the JWT).

   Submits through the SAME /v1/Estimate/submit endpoint the MT flow uses —
   Prv_Cd = selected Branch, falling back to the logged-in user's own Prv_Cd;
   Prv_Email = the selected Doctor's email (so the automailer reaches the
   doctor, not the provider). Event code (110/111) is resolved server-side
   from the caller's session, not sent from here.
═══════════════════════════════════════════════════════════════════════════ */
export default function ProviderEstimateRequest() {
  const navigate   = useNavigate()
  const [params]   = useSearchParams()
  const claimNo    = params.get('claimNo') ?? ''

  const [lead,    setLead]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [branches, setBranches] = useState([])
  const [doctors,  setDoctors]  = useState([])
  const [selBranch, setSelBranch] = useState('')
  const [selDoctor, setSelDoctor] = useState('')

  const [modalMsgs, setModalMsgs] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!claimNo) { setError('No Treatment ID provided.'); setLoading(false); return }
    Promise.all([getLeadByClaimNo(claimNo), fetchMyBranches(), fetchMyDoctors()])
      .then(([leadData, branchItems, doctorItems]) => {
        if (!leadData) { setError('Lead not found.'); return }
        setLead(leadData)
        setBranches(branchItems ?? [])
        setDoctors(doctorItems ?? [])
      })
      .catch(() => setError('Failed to load page data.'))
      .finally(() => setLoading(false))
  }, [claimNo])

  function handleReset() {
    setSelBranch('')
    setSelDoctor('')
  }

  async function handleProceed() {
    const errs = []
    if (!selBranch) errs.push('Please select a Branch.')
    if (!selDoctor) errs.push('Please select a Doctor.')
    if (errs.length > 0) { setModalMsgs(errs); return }

    const branch = branches.find(b => b.value === selBranch)
    const doctor = doctors.find(d => d.value === selDoctor)
    const sessionPrvCd = authUtils.getUser()?.prv_Cd || ''

    const payload = {
      claimNo,
      memberId:      lead?.memberId ?? '',
      statusCd:      304,
      statusRemarks: 'Estimate request sent to provider',
      rows: [{
        country_Cd: '',
        country_Nm: '',
        city_Cd:    '',
        city_Nm:    '',
        hospitals: [{
          prv_Cd:    selBranch || sessionPrvCd,
          prv_Nm:    branch?.text || doctor?.text || '',
          prv_Email: doctor?.email || ''
        }]
      }]
    }

    setSubmitting(true)
    try {
      await submitEstimateRequest(payload)
      setSuccess(true)
    } catch {
      setModalMsgs(['Failed to submit. Please try again.'])
    } finally {
      setSubmitting(false)
    }
  }

  const header = (
    <div className="common-header">
      <div className="common-header-content">
        <div className="common-header-title-wrapper">
          <h2 className="common-header-title">Proceed For Estimate</h2>
        </div>
        <button
          className="lead-action-back"
          onClick={() => navigate(`/leads/actions?claimNo=${claimNo}`)}
        >
          Back
        </button>
      </div>
    </div>
  )

  if (loading) return (
    <div className="quotation-container">
      {header}
      <div className="lead-action-loading"><i className="fas fa-spinner fa-spin"></i> Loading...</div>
    </div>
  )

  if (error || !lead) return (
    <div className="quotation-container">
      {header}
      <div className="lead-action-error">{error || 'Lead not found.'}</div>
    </div>
  )

  return (
    <div className="quotation-container">
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />
      <ValidationModal
        messages={success ? ['Estimate request sent successfully!'] : []}
        type="success"
        onClose={() => { setSuccess(false); navigate('/leads/search') }}
      />

      {header}

      <PatientInfoCard lead={lead} />

      <div className="section-box">
        <div className="section-header" style={{ cursor: 'default' }}>
          <h4><i className="fas fa-hospital" style={{ marginRight: 9, color: '#7c4fc9' }}></i>Branch &amp; Doctor Selection</h4>
        </div>
        <div className="section-body">
          <div className="grid-form-two-cols">
            <div className="group-form-medical">
              <label className="label-form-medical">Select Branch <span style={{ color: '#e53e3e' }}>*</span></label>
              <select
                className="input-form-medical"
                value={selBranch}
                onChange={e => setSelBranch(e.target.value)}
              >
                <option value="">-- Select Branch --</option>
                {branches.map(b => (
                  <option key={b.value} value={b.value}>{b.text}</option>
                ))}
              </select>
            </div>
            <div className="group-form-medical">
              <label className="label-form-medical">Select Doctor <span style={{ color: '#e53e3e' }}>*</span></label>
              <select
                className="input-form-medical"
                value={selDoctor}
                onChange={e => setSelDoctor(e.target.value)}
              >
                <option value="">-- Select Doctor --</option>
                {doctors.map(d => (
                  <option key={d.value} value={d.value}>{d.text}</option>
                ))}
              </select>
            </div>
          </div>

          {branches.length === 0 && (
            <div style={{ fontSize: 12.5, color: '#a15c1f', marginTop: 10 }}>
              <i className="fas fa-info-circle" style={{ marginRight: 5 }}></i>
              No branches found for your provider account.
            </div>
          )}
          {doctors.length === 0 && (
            <div style={{ fontSize: 12.5, color: '#a15c1f', marginTop: 6 }}>
              <i className="fas fa-info-circle" style={{ marginRight: 5 }}></i>
              No doctors found for your provider account.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderTop: '1px solid #efefef' }}>
          <button className="lead-action-back" style={{ background: '#fff', color: '#632da7', border: '1px solid #d8c3f0' }} onClick={handleReset}>
            <i className="fas fa-redo"></i> Reset Selection
          </button>
          <button className="gradient-btn" onClick={handleProceed} disabled={submitting}>
            {submitting
              ? <><i className="fas fa-spinner fa-spin"></i> Submitting...</>
              : <><i className="fas fa-check-circle"></i> Proceed for Estimate</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
