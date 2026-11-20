/**
 * DbWorkflowReference — static documentation page for internal reference.
 * Shows the stage-by-stage database save behavior across the Lead workflow
 * (Lead Registration → Patient Discharge Approval), traced from the DAL code.
 * Not wired to the dynamic sidebar menu — add a row via Manage Pages if a
 * permanent nav entry is wanted; otherwise reachable at /admin/db-workflow-reference.
 */

const RELATIONSHIPS = [
  { from: 'MT_MemberRegistration', fk: 'Member_Id', to: 'MT_LeadRegistration' },
  { from: 'MT_LeadRegistration',   fk: 'Status_Cd', to: 'MT_CaseStatus' },
  { from: 'MT_CaseICD',            fk: 'Claim_No',  to: 'MT_LeadRegistration' },
  { from: 'MT_CaseCPT',            fk: 'Claim_No',  to: 'MT_LeadRegistration' },
  { from: 'MT_CaseQuery',          fk: 'Claim_No',  to: 'MT_LeadRegistration' },
  { from: 'MT_CaseNote',           fk: 'Claim_No',  to: 'MT_LeadRegistration' },
  { from: 'MT_CaseDocument',       fk: 'Claim_No',  to: 'MT_LeadRegistration' },
  { from: 'MT_AppDocument',        fk: 'Reference_Cd', to: 'MT_LeadRegistration.Claim_No' },
  { from: 'MT_EstimateRequest',    fk: 'Claim_No',  to: 'MT_LeadRegistration' },
  { from: 'MT_EstimateRequest',    fk: 'Prv_Cd',    to: 'MT_Provider' },
  { from: 'MT_EstimateExpense',    fk: 'request_No', to: 'MT_EstimateRequest' },
  { from: 'MT_LeadTravel',         fk: 'Claim_No',  to: 'MT_LeadRegistration' },
  { from: 'MT_LeadTravel',         fk: 'Prv_Cd',    to: 'MT_Provider' },
  { from: 'MT_PaymentGuarantee',   fk: 'Claim_No',  to: 'MT_LeadRegistration' },
  { from: 'MT_Appointment',        fk: 'Claim_No',  to: 'MT_LeadRegistration' },
  { from: 'MT_Appointment',        fk: 'Prv_Cd',    to: 'MT_Provider' },
  { from: 'MT_MedicalBulletin',    fk: 'Claim_No',  to: 'MT_LeadRegistration' },
  { from: 'MT_LeadDischarge',      fk: 'Claim_No',  to: 'MT_LeadRegistration' },
  { from: 'MT_LeadDischargeDoc',       fk: 'Discharge_Id', to: 'MT_LeadDischarge.Id' },
  { from: 'MT_LeadDischargeChecklist', fk: 'Discharge_Id', to: 'MT_LeadDischarge.Id' },
]

const STAGES = [
  {
    n: 1, stage: 'Lead Registration', page: 'lead',
    tables: 'MT_LeadRegistration (insert), MT_MemberRegistration (insert if no match), MT_CaseICD, MT_CaseCPT',
    keys: "Claim_No = 'TID'+FinYr+SEQ (PK); Member_Id reused or generated",
    pattern: 'ICD/CPT: history-log. Registration/Member: plain insert.'
  },
  {
    n: 2, stage: 'Request for Additional Info', page: 'leads/query',
    tables: 'MT_CaseQuery',
    keys: 'Claim_No FK',
    pattern: 'History-log — every save deactivates prior rows, inserts a fresh set. Member reply is a plain in-place UPDATE.'
  },
  {
    n: 3, stage: 'Proceed for Estimate', page: 'leads/estimate-request',
    tables: 'MT_EstimateRequest — one row per selected provider',
    keys: 'Claim_No, Prv_Cd, request_No (token)',
    pattern: 'History-log per Claim_No+Prv_Cd pair (deactivate prior, insert new).'
  },
  {
    n: 4, stage: 'Estimate Sharing by Provider', page: 'leads/estimate-cu',
    tables: 'MT_EstimateExpense (insert), MT_EstimateRequest (update)',
    keys: 'request_no FK → MT_EstimateRequest.request_No',
    pattern: 'Normal mode: plain in-place UPDATE. Edit mode: history-log — deactivates old rows, inserts fresh copies carrying flags forward.'
  },
  {
    n: 5, stage: 'Estimate Approval by Executive', page: 'leads/estimate-status',
    tables: 'MT_EstimateRequest',
    keys: 'request_No',
    pattern: 'Plain in-place UPDATE IsApproved=1, AppBy, AppDt.'
  },
  {
    n: 6, stage: 'Estimate Generation/Sharing by Executive', page: 'leads/estimate-compare',
    tables: 'MT_EstimateRequest',
    keys: 'request_No',
    pattern: 'Plain in-place UPDATE IsShared=1, EstSharedBy, EstSharedDt (requires IsApproved=1).'
  },
  {
    n: 7, stage: 'Estimate Acceptance by Member', page: 'leads/estimate-acceptance',
    tables: 'MT_EstimateRequest',
    keys: 'request_No',
    pattern: 'Plain in-place UPDATE IsEstAccepted=1.'
  },
  {
    n: 8, stage: 'GOP / Insurer Pay', page: 'GOP Issue div (Lead Action)',
    tables: 'MT_PaymentGuarantee',
    keys: 'Claim_No, Prv_Cd, Insurer_Cd',
    pattern: 'Check-then-branch: UPDATE if an active row exists, else INSERT with Is_Approved=0. Not history-logged.'
  },
  {
    n: 9, stage: 'Travel Data Submitted', page: 'leads/travel-info',
    tables: 'MT_LeadTravel',
    keys: 'Claim_No, Request_No, Prv_Cd',
    pattern: 'Plain insert per traveller; delete = soft Actv_Ind=0 (no re-insert history).'
  },
  {
    n: 10, stage: 'Appointment Request', page: 'appointments',
    tables: 'MT_Appointment',
    keys: 'Claim_No, Prv_Cd',
    pattern: 'Plain insert.'
  },
  {
    n: 11, stage: 'Appointment Confirmation', page: 'appointments/confirm',
    tables: 'MT_Appointment',
    keys: 'Id + Claim_No',
    pattern: 'Plain in-place UPDATE.'
  },
  {
    n: 12, stage: 'Patient Admission', page: 'Lead Action — Patient Admission div',
    tables: 'MT_LeadRegistration (DOA/DOD), MT_MedicalBulletin (insert-only)',
    keys: 'Claim_No',
    pattern: 'Plain in-place UPDATE on registration; bulletins are pure inserts, no discrete admission table.'
  },
  {
    n: 13, stage: 'Patient Discharge', page: 'Lead Action — Patient Discharge div',
    tables: 'MT_LeadDischarge, MT_LeadDischargeDoc, MT_LeadDischargeChecklist (Is_Approved=0)',
    keys: 'Discharge_Id FK → MT_LeadDischarge.Id; all carry Claim_No',
    pattern: 'History-log across all three — every Save deactivates the prior active set and inserts a fresh one, Crtd_* pinned to the first insert.'
  },
  {
    n: 14, stage: 'Patient Discharge Approval', page: 'Lead Action — Patient Discharge Approval div',
    tables: 'Same 3 discharge tables (Is_Approved=1) + MT_LeadRegistration (App_Amt_Provider / App_Copay_Amt / App_Ded_Amt / App_Net_Amt_Provider / App_Dt / App_By)',
    keys: 'Discharge_Id, Claim_No',
    pattern: 'Discharge tables: same history-log pattern, keyed by Is_Approved=1. Registration amount columns: plain in-place UPDATE. Approved docs also promoted into MT_AppDocument.'
  },
]

function SectionBox({ title, children }) {
  return (
    <div className="section-box" style={{ marginBottom: 20 }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        <h4>{title}</h4>
      </div>
      <div className="section-body">{children}</div>
    </div>
  )
}

export default function DbWorkflowReference() {
  return (
    <div className="quotation-container">
      <div className="common-header">
        <div className="common-header-content">
          <div className="common-header-title-wrapper">
            <h2 className="common-header-title">Lead Workflow — Database Reference</h2>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#555', margin: '0 0 20px' }}>
        Stage-by-stage database save behavior across the Lead workflow, from Lead Registration through Patient Discharge
        Approval — traced directly from <code>LeadDAL.cs</code>, <code>EstimateDAL.cs</code> and <code>AppointmentDAL.cs</code>.
        <br />
        <b>MT_LeadRegistration.Claim_No</b> is the hub every table hangs off, either directly or via one intermediate
        table (<code>MT_EstimateRequest.request_No</code> or <code>MT_LeadDischarge.Id</code>).
      </p>

      <SectionBox title="Key Relationships (Foreign Keys)">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f0fb' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11.5, textTransform: 'uppercase', color: '#888' }}>Table</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11.5, textTransform: 'uppercase', color: '#888' }}>FK Column</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11.5, textTransform: 'uppercase', color: '#888' }}>References</th>
            </tr>
          </thead>
          <tbody>
            {RELATIONSHIPS.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 12.5 }}>{r.from}</td>
                <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 12.5, color: '#632da7' }}>{r.fk}</td>
                <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 12.5 }}>{r.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionBox>

      <SectionBox title="Stage-by-Stage Save Behavior">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#f5f0fb' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11.5, textTransform: 'uppercase', color: '#888', width: 30 }}>#</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11.5, textTransform: 'uppercase', color: '#888' }}>Stage (Page)</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11.5, textTransform: 'uppercase', color: '#888' }}>Table(s)</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11.5, textTransform: 'uppercase', color: '#888' }}>Key Columns</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11.5, textTransform: 'uppercase', color: '#888' }}>Save Pattern</th>
              </tr>
            </thead>
            <tbody>
              {STAGES.map(s => (
                <tr key={s.n} style={{ borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 700, color: '#632da7' }}>{s.n}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <div style={{ fontWeight: 600 }}>{s.stage}</div>
                    <div style={{ fontSize: 11.5, color: '#888' }}>{s.page}</div>
                  </td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{s.tables}</td>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>{s.keys}</td>
                  <td style={{ padding: '9px 12px', fontSize: 12.5, color: '#444' }}>{s.pattern}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionBox>

      <SectionBox title="Two Save Patterns in Play">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ flex: '1 1 320px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>History-log (deactivate + insert)</div>
            <p style={{ fontSize: 12.5, color: '#555', margin: '0 0 8px' }}>
              Every edit is preserved as its own row (Actv_Ind=0), only the latest is Actv_Ind=1 — full audit trail.
            </p>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#444', lineHeight: 1.8 }}>
              MT_CaseICD, MT_CaseCPT, MT_CaseQuery, MT_EstimateRequest (new/edit), MT_EstimateExpense (edit),
              MT_LeadDischarge, MT_LeadDischargeDoc, MT_LeadDischargeChecklist
            </div>
          </div>
          <div style={{ flex: '1 1 320px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Plain in-place UPDATE</div>
            <p style={{ fontSize: 12.5, color: '#555', margin: '0 0 8px' }}>
              No historical trail — only current state is kept.
            </p>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#444', lineHeight: 1.8 }}>
              MT_LeadRegistration (most fields), MT_PaymentGuarantee, MT_Appointment,
              MT_EstimateRequest (approve/share/accept flags), MT_LeadTravel (delete only)
            </div>
          </div>
        </div>
      </SectionBox>
    </div>
  )
}
