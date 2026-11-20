import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLeadByClaimNo, fetchProvidersWithLocation, fetchDropdown, getCompanyAgreements, submitEstimateRequest } from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'
import PatientInfoCard from '../../components/PatientInfoCard'

const P = 'MedicaltourismProceedforEstimate__'   // CSS prefix shorthand

/* ═══════════════════════════════════════════════════════════════════════════
   EstimateRequest — Proceed for Estimate (mirrors MedTour mt-multi.aspx)
═══════════════════════════════════════════════════════════════════════════ */
export default function EstimateRequest() {
  const navigate     = useNavigate()
  const [params]     = useSearchParams()
  const claimNo        = params.get('claimNo') ?? ''
  const additionalMode = params.get('mode') === 'additional'

  const [lead,      setLead]      = useState(null)
  const [allItems,  setAllItems]  = useState([])   // flat ProviderLocationItem[]
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  // ── Company (entity) selection — determines which branded template + sender is used ──
  const [companies,   setCompanies]   = useState([])   // [{value, text}]
  const [selCompany,  setSelCompany]  = useState('')
  const [senderEmail, setSenderEmail] = useState('')

  // ── Cascade selection state ─────────────────────────────────────────────
  const [selCountry,  setSelCountry]  = useState('')
  const [selCity,     setSelCity]     = useState('')
  const [selHospitals, setSelHospitals] = useState([])   // array of Prv_Cd strings
  const [dropOpen,    setDropOpen]    = useState(false)
  const [hospitalSearch, setHospitalSearch] = useState('')
  const dropRef = useRef(null)

  // ── Table rows (added selections) ───────────────────────────────────────
  const [rows, setRows] = useState([])   // [{country_Cd, country_Nm, city_Cd, city_Nm, hospitals:[{prv_Cd,prv_Nm,prv_Email}]}]

  // ── Submit state ─────────────────────────────────────────────────────────
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success,     setSuccess]     = useState(false)
  const [modalMsgs,   setModalMsgs]   = useState([])

  useEffect(() => {
    if (!claimNo) { setError('No Treatment ID provided.'); setLoading(false); return }
    Promise.all([getLeadByClaimNo(claimNo), fetchProvidersWithLocation(), fetchDropdown('drpComp')])
      .then(([leadData, items, companyItems]) => {
        if (!leadData) { setError('Lead not found.'); return }
        setLead(leadData)
        setAllItems(items)
        setCompanies(companyItems ?? [])

        // Pre-populate grid with preferred provider from lead registration (skipped in additional mode)
        if (!additionalMode && leadData.providerCd) {
          const match = items.find(i => i.prv_Cd === leadData.providerCd)
          if (match) {
            setRows([{
              country_Cd: match.country_Cd,
              country_Nm: match.country_Nm,
              city_Cd:    match.city_Cd,
              city_Nm:    match.city_Nm,
              hospitals:  [{ prv_Cd: match.prv_Cd, prv_Nm: match.prv_Nm, prv_Email: match.prv_Email }]
            }])
          }
        }
      })
      .catch(() => setError('Failed to load page data.'))
      .finally(() => setLoading(false))
  }, [claimNo])

  // Close hospital dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false)
        setHospitalSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Company change → look up sender email (mirrors ProviderAction.jsx) ───
  async function handleCompanyChange(cd) {
    setSelCompany(cd)
    setSenderEmail('')
    if (!cd) return
    try {
      const rows = await getCompanyAgreements(cd)
      setSenderEmail(rows?.[0]?.senderEmailId || '')
    } catch {
      setSenderEmail('')
    }
  }

  // ── Derived lists ────────────────────────────────────────────────────────
  const countries = [...new Map(
    allItems.map(i => [i.country_Cd, { value: i.country_Cd, text: i.country_Nm }])
  ).values()].sort((a, b) => a.text.localeCompare(b.text))

  const cities = selCountry
    ? [...new Map(
        allItems
          .filter(i => i.country_Cd === selCountry)
          .map(i => [i.city_Cd, { value: i.city_Cd, text: i.city_Nm }])
      ).values()].sort((a, b) => a.text.localeCompare(b.text))
    : []

  const hospitals = (selCountry && selCity)
    ? allItems.filter(i => i.country_Cd === selCountry && i.city_Cd === selCity)
    : []

  const filteredHospitals = hospitalSearch.trim()
    ? hospitals.filter(h => h.prv_Nm.toLowerCase().includes(hospitalSearch.trim().toLowerCase()))
    : hospitals

  const selectedHospitalObjs = hospitals.filter(h => selHospitals.includes(h.prv_Cd))

  // "Select All" applies to the currently filtered/visible list, not the full
  // location list — matches how search-filtered multi-selects usually behave.
  const allChecked = filteredHospitals.length > 0 && filteredHospitals.every(h => selHospitals.includes(h.prv_Cd))

  function toggleHospital(prvCd) {
    setSelHospitals(prev =>
      prev.includes(prvCd) ? prev.filter(x => x !== prvCd) : [...prev, prvCd]
    )
  }

  function toggleAll() {
    const filteredCds = filteredHospitals.map(h => h.prv_Cd)
    if (allChecked) setSelHospitals(prev => prev.filter(x => !filteredCds.includes(x)))
    else setSelHospitals(prev => [...new Set([...prev, ...filteredCds])])
  }

  function removeSelectedHospital(prvCd) {
    setSelHospitals(prev => prev.filter(x => x !== prvCd))
  }

  // ── Add row ──────────────────────────────────────────────────────────────
  function handleAdd() {
    const errs = []
    if (!selCountry)               errs.push('Please select a Country.')
    if (!selCity)                  errs.push('Please select a Location.')
    if (selHospitals.length === 0) errs.push('Please select at least one Hospital/Provider.')
    if (errs.length > 0) { setModalMsgs(errs); return }

    const countryNm = countries.find(c => c.value === selCountry)?.text ?? ''
    const cityNm    = cities.find(c => c.value === selCity)?.text ?? ''

    // Merge into existing row for same country+city, or add new row
    const existingIdx = rows.findIndex(r => r.country_Cd === selCountry && r.city_Cd === selCity)
    if (existingIdx >= 0) {
      setRows(prev => {
        const updated = [...prev]
        const existing = updated[existingIdx]
        const mergedHospitals = [...existing.hospitals]
        selectedHospitalObjs.forEach(h => {
          if (!mergedHospitals.find(x => x.prv_Cd === h.prv_Cd)) {
            mergedHospitals.push({ prv_Cd: h.prv_Cd, prv_Nm: h.prv_Nm, prv_Email: h.prv_Email })
          }
        })
        updated[existingIdx] = { ...existing, hospitals: mergedHospitals }
        return updated
      })
    } else {
      setRows(prev => [...prev, {
        country_Cd: selCountry,
        country_Nm: countryNm,
        city_Cd:    selCity,
        city_Nm:    cityNm,
        hospitals:  selectedHospitalObjs.map(h => ({
          prv_Cd: h.prv_Cd, prv_Nm: h.prv_Nm, prv_Email: h.prv_Email
        }))
      }])
    }

    // Reset cascade
    setSelCountry('')
    setSelCity('')
    setSelHospitals([])
  }

  // ── Remove hospital from table row ───────────────────────────────────────
  function removeFromRow(rowIdx, prvCd) {
    setRows(prev => {
      const updated = [...prev]
      const hospitals = updated[rowIdx].hospitals.filter(h => h.prv_Cd !== prvCd)
      if (hospitals.length === 0) {
        updated.splice(rowIdx, 1)
      } else {
        updated[rowIdx] = { ...updated[rowIdx], hospitals }
      }
      return updated
    })
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleProceed() {
    if (!selCompany) {
      setModalMsgs(['Please select a Company.'])
      return
    }
    if (rows.length === 0) {
      setModalMsgs(['Please add at least one Country/Location/Provider selection before proceeding.'])
      return
    }

    const fullName = lead
      ? [lead.firstName, lead.middleName, lead.lastName].filter(Boolean).join(' ')
      : ''

    const payload = {
      claimNo,
      memberId:      lead?.memberId ?? '',
      fullName,
      statusCd:      additionalMode ? 321 : 304,
      statusRemarks: additionalMode ? 'Additional Estimate Request' : 'Estimate request sent to providers',
      compCd:        selCompany,
      rows: rows.map(r => ({
        country_Cd: r.country_Cd,
        country_Nm: r.country_Nm,
        city_Cd:    r.city_Cd,
        city_Nm:    r.city_Nm,
        hospitals:  r.hospitals.map(h => ({
          prv_Cd:    h.prv_Cd,
          prv_Nm:    h.prv_Nm,
          prv_Email: h.prv_Email
        }))
      }))
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      await submitEstimateRequest(payload)
      setSuccess(true)
    } catch {
      setSubmitError('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Shared header ──────────────────────────────────────────────────────── */
  const header = (
    <div className="common-header">
      <div className="common-header-content">
        <div className="common-header-title-wrapper">
          <h2 className="common-header-title">Estimate Request to Providers</h2>
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

  const hospitalToggleLabel = selHospitals.length === 0
    ? '-- Select Hospitals --'
    : `${selHospitals.length} hospital${selHospitals.length > 1 ? 's' : ''} selected`

  return (
    <div className="quotation-container">
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />
      <ValidationModal messages={success ? ['Estimate request sent successfully!'] : []} type="success" onClose={() => { setSuccess(false); navigate('/leads/search') }} />

      {header}

        {/* ── Patient Info Card ── */}
        <PatientInfoCard lead={lead} />

        {/* ── Main estimate card ── */}
        <div className={`${P}wrapper`}>

          <div className={`${P}header ${P}header--with-company`}>
            <h2 className="hospital-form-title">
              <i className="fas fa-hospital"></i> Country and Hospital Selection
            </h2>

            {/* Company — determines the branded template + sender email used */}
            <div className={`${P}header-company`}>
              <label className={`${P}label`}>
                Company <span className={`${P}required`}>*</span>
              </label>
              <select
                className={`${P}select`}
                value={selCompany}
                onChange={e => handleCompanyChange(e.target.value)}
              >
                {companies.map(c => (
                  <option key={c.value} value={c.value}>{c.text}</option>
                ))}
              </select>
              {selCompany && (
                <span className={`${P}header-sender-email`}>
                  Sender Email Id: <strong>{senderEmail || '—'}</strong>
                </span>
              )}
            </div>
          </div>

          <div className={`${P}content`}>

            {/* ── Filter dropdowns: Country / City / Hospital ── */}
            <div className={`${P}filters`}>

              {/* Country */}
              <div className={`${P}field`}>
                <label className={`${P}label`}>
                  Country <span className={`${P}required`}>*</span>
                </label>
                <select
                  className={`${P}select`}
                  value={selCountry}
                  onChange={e => { setSelCountry(e.target.value); setSelCity(''); setSelHospitals([]); setHospitalSearch('') }}
                >
                  <option value="">-- Select Country --</option>
                  {countries.map(c => (
                    <option key={c.value} value={c.value}>{c.text}</option>
                  ))}
                </select>
              </div>

              {/* City / Location */}
              <div className={`${P}field`}>
                <label className={`${P}label`}>
                  Location <span className={`${P}required`}>*</span>
                </label>
                <select
                  className={`${P}select`}
                  value={selCity}
                  disabled={!selCountry}
                  onChange={e => { setSelCity(e.target.value); setSelHospitals([]); setHospitalSearch('') }}
                >
                  <option value="">-- Select Location --</option>
                  {cities.map(c => (
                    <option key={c.value} value={c.value}>{c.text}</option>
                  ))}
                </select>
              </div>

              {/* Hospital — custom multi-select with checkboxes */}
              <div className={`${P}field`}>
                <label className={`${P}label`}>
                  Hospital / Provider <span className={`${P}required`}>*</span>
                </label>
                <div className={`${P}dropdown-wrapper`} ref={dropRef}>
                  <button
                    type="button"
                    className={`${P}dropdown-toggle`}
                    disabled={!selCity}
                    onClick={() => {
                      setDropOpen(prev => !prev)
                      setHospitalSearch('')
                    }}
                  >
                    {hospitalToggleLabel}
                  </button>

                  {dropOpen && hospitals.length > 0 && (
                    <div className={`${P}dropdown-menu`} style={{ display: 'block', opacity: 1, transform: 'translateY(0)' }}>
                      {/* Type-to-filter search box */}
                      <div className={`${P}dropdown-search`} style={{ padding: '6px 10px' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          autoFocus
                          value={hospitalSearch}
                          onChange={e => setHospitalSearch(e.target.value)}
                          placeholder="Type to filter hospitals..."
                          style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 13, border: '1px solid #dee2e6', borderRadius: 6 }}
                        />
                      </div>

                      {/* Select All (applies to the currently filtered list) */}
                      {filteredHospitals.length > 0 && (
                        <div
                          className={`${P}dropdown-item ${P}dropdown-item--select-all`}
                          onClick={toggleAll}
                        >
                          <div className={`${P}checkbox${allChecked ? ` ${P}checkbox--checked` : ''}`}>
                            {allChecked && <i className="fas fa-check" style={{ fontSize: '10px' }}></i>}
                          </div>
                          Select All
                        </div>
                      )}
                      {filteredHospitals.length === 0 && (
                        <div className={`${P}dropdown-item`} style={{ color: '#888', cursor: 'default' }}>
                          No hospitals match your search.
                        </div>
                      )}
                      {filteredHospitals.map(h => {
                        const checked = selHospitals.includes(h.prv_Cd)
                        return (
                          <div
                            key={h.prv_Cd}
                            className={`${P}dropdown-item`}
                            onClick={() => toggleHospital(h.prv_Cd)}
                          >
                            <div className={`${P}checkbox${checked ? ` ${P}checkbox--checked` : ''}`}>
                              {checked && <i className="fas fa-check" style={{ fontSize: '10px' }}></i>}
                            </div>
                            {h.prv_Nm}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Selected hospital badges */}
                {selHospitals.length > 0 && (
                  <div className={`${P}selected-badges`}>
                    {selectedHospitalObjs.map(h => (
                      <span key={h.prv_Cd} className={`${P}badge`}>
                        {h.prv_Nm}
                        <span
                          className={`${P}badge-remove`}
                          onClick={() => removeSelectedHospital(h.prv_Cd)}
                        >&times;</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Add button ── */}
            <div style={{ marginTop: '18px', marginBottom: '6px' }}>
              <button
                type="button"
                className={`${P}add-more-btn`}
                onClick={handleAdd}
              >
                <i className="fas fa-plus"></i> Add
              </button>
            </div>

            {/* ── Saved selections table ── */}
            {rows.length > 0 && (
              <div className={`${P}saved-selections`}>
                <div className={`${P}table-wrapper`}>
                  <table className={`${P}table`}>
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>S.No</th>
                        <th>Country</th>
                        <th>Location</th>
                        <th>Hospitals / Providers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, ri) => (
                        <tr key={ri}>
                          <td>{ri + 1}</td>
                          <td>{row.country_Nm}</td>
                          <td>{row.city_Nm}</td>
                          <td>
                            <div className={`${P}table-hospitals`}>
                              {row.hospitals.map(h => {
                                const isPreferred = lead?.providerCd && h.prv_Cd === lead.providerCd
                                return (
                                  <span key={h.prv_Cd} className={`${P}table-badge`}>
                                    {h.prv_Nm}
                                    {(!isPreferred || additionalMode) && (
                                      <span
                                        className={`${P}table-badge-remove`}
                                        onClick={() => removeFromRow(ri, h.prv_Cd)}
                                      >&times;</span>
                                    )}
                                  </span>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer actions ── */}
          <div className={`${P}actions`}>
            {submitError && <span className="er-error">{submitError}</span>}
            <button
              type="button"
              className={`${P}btn ${P}btn--reset`}
              onClick={() => navigate(0)}
            >
              <i className="fas fa-redo"></i> Reset
            </button>
            <button
              type="button"
              className={`${P}btn ${P}btn--submit`}
              onClick={handleProceed}
              disabled={submitting}
            >
              {submitting
                ? <><i className="fas fa-spinner fa-spin"></i> Submitting...</>
                : <><i className="fas fa-paper-plane"></i> Proceed for Estimate</>
              }
            </button>
          </div>

        </div>

    </div>
  )
}
