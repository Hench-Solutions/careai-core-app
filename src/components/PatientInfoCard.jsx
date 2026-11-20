/* Reusable read-only patient info card — mirrors the WebForms UserControl pattern.
   Accepts a `lead` object from getLeadByClaimNo response.
   `extraFields` (optional): [{ label, value }] appended after the standard fields —
   used by pages that need extra case-context fields (e.g. Claim Submission) without
   changing the card for every other page that renders it as-is. */
export default function PatientInfoCard({ lead, extraFields = [] }) {
  if (!lead) return null

  const fullName = [lead.firstName, lead.middleName, lead.lastName]
    .filter(Boolean).join(' ') || '—'

  return (
    <div className="patient-info-card">
      <h3 className="patient-info-header">
        <i className="fas fa-user-circle"></i> Patient Information
      </h3>
      <div className="patient-details-grid">
        <div className="patient-detail-item">
          <div className="patient-detail-label">Insurer / Entity</div>
          <div className="patient-detail-value">{lead.insurerNm || '—'}</div>
        </div>
        <div className="patient-detail-item">
          <div className="patient-detail-label">Full Name</div>
          <div className="patient-detail-value">{fullName}</div>
        </div>
        <div className="patient-detail-item">
          <div className="patient-detail-label">Email Address</div>
          <div className="patient-detail-value">{lead.emailId || '—'}</div>
        </div>
        <div className="patient-detail-item">
          <div className="patient-detail-label">DOB</div>
          <div className="patient-detail-value">{lead.dob || '—'}</div>
        </div>
        <div className="patient-detail-item">
          <div className="patient-detail-label">Current Location</div>
          <div className="patient-detail-value">{lead.patientLocationNm || '—'}</div>
        </div>
        <div className="patient-detail-item">
          <div className="patient-detail-label">Treatment Type</div>
          <div className="patient-detail-value">{lead.treatmentTypeNm || '—'}</div>
        </div>
        {extraFields.map((f, i) => (
          <div className="patient-detail-item" key={i}>
            <div className="patient-detail-label">{f.label}</div>
            <div className="patient-detail-value">{f.value || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
