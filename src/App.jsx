import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Layout from './components/layout/Layout'
import Dashboard from './pages/dashboard/Dashboard'
import LeadForm from './pages/leads/LeadForm'
import MemberSearch from './pages/leads/MemberSearch'
import LeadSearch from './pages/leads/LeadSearch'
import Login from './pages/auth/Login'
import ComingSoon from './pages/ComingSoon'
import LeadAction      from './pages/leads/LeadAction'
import LeadQuery        from './pages/leads/LeadQuery'
import EstimateRequest  from './pages/leads/EstimateRequest'
import ProviderEstimateRequest from './pages/leads/ProviderEstimateRequest'
import LeadEstimateReq  from './components/LeadEstimateReq'
import LeadEstimateCu   from './components/LeadEstimateCu'
import EstimateStatus   from './pages/leads/EstimateStatus'
import EstimateCompare    from './pages/leads/EstimateCompare'
import EstimateAcceptance from './components/EstimateAcceptance'
import TravelInfo          from './components/TravelInfo'
import MemberDocUpload    from './components/MemberDocUpload'
import Appointments        from './pages/leads/Appointments'
import AppointmentConfirm  from './pages/leads/AppointmentConfirm'
import ProviderSearch from './pages/provider/ProviderSearch'
import ProviderForm   from './pages/provider/ProviderForm'
import ProviderAction from './pages/provider/ProviderAction'
import ManageGroups    from './pages/pagemanage/ManageGroups'
import GroupForm       from './pages/pagemanage/GroupForm'
import ManagePages     from './pages/pagemanage/ManagePages'
import PageForm        from './pages/pagemanage/PageForm'
import EmployeeSearch  from './pages/admin/EmployeeSearch'
import EmployeeForm    from './pages/admin/EmployeeForm'
import DbWorkflowReference from './pages/admin/DbWorkflowReference'
import LeadSupport from './pages/support/LeadSupport'
import CaseBillDetails from './pages/accounts/CaseBillDetails'
import CaseBillList     from './pages/accounts/CaseBillList'
import CaseBillReferral from './pages/accounts/CaseBillReferral'
import ReferralInvoiceGenerate from './pages/accounts/ReferralInvoiceGenerate'
import ReferralInvoiceList from './pages/accounts/ReferralInvoiceList'
import ReferralInvoiceDashboard from './pages/accounts/ReferralInvoiceDashboard'
import InvoiceGenerate  from './pages/accounts/InvoiceGenerate'
import CaseBillEntry   from './pages/accounts/CaseBillEntry'
import InvoiceList          from './pages/accounts/InvoiceList'
import InvoiceView          from './pages/accounts/InvoiceView'
import InsurerWiseCaseList  from './pages/accounts/InsurerWiseCaseList'
import AgentManage          from './pages/accounts/AgentManage'
import InsurerManage        from './pages/accounts/InsurerManage'
import AgentReferralRecord         from './pages/accounts/AgentReferralRecord'
import InsurancePaymentSettlement  from './pages/accounts/InsurancePaymentSettlement'
import InsurerPaymentStatus        from './pages/accounts/InsurerPaymentStatus'
import MisReport                   from './pages/reports/MisReport'
import MisDashboard                from './pages/reports/MisDashboard'
import AgentSearch          from './pages/agent/AgentSearch'
import AgentIndividualForm  from './pages/agent/AgentIndividualForm'
import AgentCompanyForm     from './pages/agent/AgentCompanyForm'
import InsurerSearch        from './pages/master/InsurerSearch'
import InsurerForm          from './pages/master/InsurerForm'
import EmailEventSearch     from './pages/master/EmailEventSearch'
import EmailEventForm       from './pages/master/EmailEventForm'
import CaseStatusSearch     from './pages/master/CaseStatusSearch'
import DocumentSearch       from './pages/master/DocumentSearch'
import DocumentForm         from './pages/master/DocumentForm'
import MasterItemSearch     from './pages/master/MasterItemSearch'
import MasterItemForm       from './pages/master/MasterItemForm'
import CaseStatusForm       from './pages/master/CaseStatusForm'
import ServiceChargeSlabSearch from './pages/master/ServiceChargeSlabSearch'
import ServiceChargeSlabForm   from './pages/master/ServiceChargeSlabForm'
import ClaimSubmission      from './pages/leads/ClaimSubmission'
import { authUtils } from './utils/auth'

// Auth check runs once on mount — does NOT re-run on every navigation
function PrivateRoute({ children }) {
  const [isAuth] = useState(() => authUtils.isLoggedIn())
  return isAuth ? children : <Navigate to="/login" replace />
}

// Listens for 401 events from apiFetch and redirects via React Router (no full page reload)
function AuthEventHandler() {
  const navigate = useNavigate()
  useEffect(() => {
    const handler = () => navigate('/login', { replace: true })
    window.addEventListener('careai:logout', handler)
    return () => window.removeEventListener('careai:logout', handler)
  }, [navigate])
  return null
}

// Re-mounts LeadForm on every navigation to /lead (even from same route)
function LeadFormKeyed() {
  const { key } = useLocation()
  return <LeadForm key={key} />
}

// Root route element — replaces the old <BrowserRouter><AuthEventHandler />... sibling
// arrangement. RouterProvider renders a single tree, so AuthEventHandler now lives here
// alongside <Outlet /> instead of as a Routes sibling.
function RootLayout() {
  return (
    <>
      <AuthEventHandler />
      <Outlet />
    </>
  )
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
        {/* Default: redirect root to /login */}
        <Route index element={<Navigate to="/login" replace />} />

        {/* Public route — no sidebar/topnav */}
        <Route path="/login" element={<Login />} />

        {/* Public estimate-req route — accessible without login (provider via email link) */}
        <Route path="/estimate-req" element={<LeadEstimateReq />} />

        {/* Public estimate-cu route — provider fills estimate details after accepting */}
        <Route path="/estimate-cu" element={<LeadEstimateCu />} />

        {/* Public member-facing routes — no login required */}
        <Route path="/estimate-acceptance" element={<EstimateAcceptance />} />
        <Route path="/travel-info"         element={<TravelInfo />} />
        <Route path="/documents"           element={<MemberDocUpload />} />

        {/* Protected routes */}
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="dashboard" element={<Dashboard />} />

          {/* Leads */}
          <Route path="lead/new"                     element={<MemberSearch />} />
          <Route path="lead"                        element={<LeadFormKeyed />} />
          <Route path="lead/edit/:claimNo"           element={<LeadFormKeyed />} />
          <Route path="lead/subset/:sourceClaimNo"   element={<LeadFormKeyed />} />
          <Route path="leads/search"                element={<LeadSearch />} />
          <Route path="leads/actions"          element={<LeadAction />} />
          <Route path="leads/query"            element={<LeadQuery />} />
          <Route path="leads/estimate-request" element={<EstimateRequest />} />
          <Route path="leads/provider-estimate-request" element={<ProviderEstimateRequest />} />
          <Route path="leads/estimate-req"     element={<LeadEstimateReq />} />
          <Route path="leads/estimate-status"   element={<EstimateStatus />} />
          <Route path="leads/estimate-compare"  element={<EstimateCompare />} />
          <Route path="leads/estimate-cu"          element={<LeadEstimateCu />} />
          <Route path="leads/estimate-acceptance"  element={<EstimateAcceptance />} />
          <Route path="leads/travel-info"           element={<TravelInfo />} />
          <Route path="leads/claim-submission"      element={<ClaimSubmission />} />

          {/* Appointments */}
          <Route path="appointments"         element={<Appointments />} />
          <Route path="appointments/confirm" element={<AppointmentConfirm />} />

          {/* Provider */}
          <Route path="provider/search"      element={<ProviderSearch />} />
          <Route path="provider/add"         element={<ProviderForm />} />
          <Route path="provider/edit/:prvCd" element={<ProviderForm />} />
          <Route path="provider/action"      element={<ProviderAction />} />

          {/* Admin — Employees */}
          <Route path="admin/employees"            element={<EmployeeSearch />} />
          <Route path="admin/employees/add"        element={<EmployeeForm />} />
          <Route path="admin/employees/edit/:id"   element={<EmployeeForm />} />
          <Route path="admin/db-workflow-reference" element={<DbWorkflowReference />} />

          {/* Page Management */}
          <Route path="pagemanage/groups"          element={<ManageGroups />} />
          <Route path="pagemanage/groups/add"      element={<GroupForm />} />
          <Route path="pagemanage/groups/edit/:id" element={<GroupForm />} />

          {/* Page Management — L1 */}
          <Route path="pagemanage/pages"            element={<ManagePages level={1} />} />
          <Route path="pagemanage/pages/add"        element={<PageForm level={1} />} />
          <Route path="pagemanage/pages/edit/:id"   element={<PageForm level={1} />} />

          {/* Page Management — L2 (sub pages) */}
          <Route path="pagemanage/pages/:parentId/sub"            element={<ManagePages level={2} />} />
          <Route path="pagemanage/pages/:parentId/sub/add"        element={<PageForm level={2} />} />
          <Route path="pagemanage/pages/:parentId/sub/edit/:id"   element={<PageForm level={2} />} />

          {/* Page Management — L3 (tertiary pages) */}
          <Route path="pagemanage/pages/:parentId/sub/:subParentId/tertiary"            element={<ManagePages level={3} />} />
          <Route path="pagemanage/pages/:parentId/sub/:subParentId/tertiary/add"        element={<PageForm level={3} />} />
          <Route path="pagemanage/pages/:parentId/sub/:subParentId/tertiary/edit/:id"   element={<PageForm level={3} />} />

          {/* Documents */}
          {/* /documents is a public route — handled above outside protected routes */}
          <Route path="estimate/view" element={<ComingSoon page="View Estimate" />} />

          {/* Agent */}
          <Route path="master/insurer"                  element={<InsurerSearch />} />
          <Route path="master/insurer/add"              element={<InsurerForm />} />
          <Route path="master/insurer/edit/:insurerCd"  element={<InsurerForm />} />

          <Route path="master/email-event"              element={<EmailEventSearch />} />
          <Route path="master/email-event/add"          element={<EmailEventForm />} />
          <Route path="master/email-event/edit/:id"     element={<EmailEventForm />} />

          <Route path="master/case-status"              element={<CaseStatusSearch />} />
          <Route path="master/case-status/add"          element={<CaseStatusForm />} />
          <Route path="master/case-status/edit/:id"     element={<CaseStatusForm />} />

          <Route path="support/lead-support"            element={<LeadSupport />} />
          <Route path="master/document"                 element={<DocumentSearch />} />
          <Route path="master/document/add"             element={<DocumentForm />} />
          <Route path="master/document/edit/:id"        element={<DocumentForm />} />

          <Route path="master/master-item"              element={<MasterItemSearch />} />
          <Route path="master/master-item/add"          element={<MasterItemForm />} />
          <Route path="master/master-item/edit/:id"     element={<MasterItemForm />} />

          <Route path="master/service-charge-slab"          element={<ServiceChargeSlabSearch />} />
          <Route path="master/service-charge-slab/add"      element={<ServiceChargeSlabForm />} />
          <Route path="master/service-charge-slab/edit/:id" element={<ServiceChargeSlabForm />} />

          <Route path="agent/search"                    element={<AgentSearch />} />
          <Route path="agent/add-individual"            element={<AgentIndividualForm />} />
          <Route path="agent/edit-individual/:agentCd"  element={<AgentIndividualForm />} />
          <Route path="agent/add-company"               element={<AgentCompanyForm />} />
          <Route path="agent/edit-company/:agentCd"     element={<AgentCompanyForm />} />

          {/* Reports (generic MIS pages — ?reportCode= from the Page Master menu entry) */}
          <Route path="reports/mis" element={<MisReport />} />
          <Route path="reports/dashboard" element={<MisDashboard />} />

          {/* Accounts */}
          <Route path="accounts/casebilldetails" element={<CaseBillDetails />} />
          <Route path="accounts/casebilllist"    element={<CaseBillList />} />
          <Route path="accounts/case-bill-referral" element={<CaseBillReferral />} />
          <Route path="accounts/referral-invoice/generate" element={<ReferralInvoiceGenerate />} />
          <Route path="accounts/referral-invoice/list"      element={<ReferralInvoiceList />} />
          <Route path="accounts/referral-invoice/dashboard" element={<ReferralInvoiceDashboard />} />
          <Route path="accounts/invoicegenerate" element={<InvoiceGenerate />} />
          <Route path="accounts/casebillentry"   element={<CaseBillEntry />} />
          <Route path="accounts/invoicelist"     element={<InvoiceList />} />
          <Route path="accounts/invoice"              element={<InvoiceView />} />
          <Route path="accounts/insurerwisecaselist" element={<InsurerWiseCaseList />} />
          <Route path="accounts/agents"             element={<AgentManage />} />
          <Route path="accounts/insurers"           element={<InsurerManage />} />
          <Route path="accounts/agent-referral-record"        element={<AgentReferralRecord />} />
          <Route path="accounts/insurance-payment-settlement" element={<InsurancePaymentSettlement />} />
          <Route path="accounts/insurer-payment-status"       element={<InsurerPaymentStatus />} />

          {/* Reports */}
          <Route path="reports/mis" element={<ComingSoon page="MIS Reports" />} />

          {/* Profile / Settings */}
          <Route path="profile"  element={<ComingSoon page="Profile Settings" />} />
          <Route path="settings" element={<ComingSoon page="Settings" />} />

          {/* 404 */}
          <Route path="*" element={<ComingSoon page="Page Not Found" />} />
        </Route>
    </Route>
  )
)

export default function App() {
  return <RouterProvider router={router} />
}
