# CareAI — Change Log & Requirements Tracker

> Covers all requirements discussed and implemented in the May 2026 development session.
> Status: ✅ Done | 🔄 In Progress | ⏳ Pending

---

## 1. Sidebar — Direct Navigation for Single-Leaf Menus
**Requirement:** Menu sections with no child items (e.g. Dashboard) must navigate directly on click instead of attempting accordion expand.

**Impact / Logic:**
- `isDirectNav(section)` — true when section has zero L2 items with its own URL, OR exactly one childless L2 item
- `PageUrl` field added to `MenuSectionDto` so the API returns the L1 URL
- Chevron arrow hidden for direct-nav sections; accordion body hidden

**Files Changed:**
| File | Change |
|---|---|
| `src/components/layout/Sidebar.jsx` | Added `isDirectNav`, `getDirectNavUrl`, `handleSectionClick`; updated JSX render |
| `CareAi_Api/Modules/Admin/Response/AdminResponse.cs` | Added `PageUrl` to `MenuSectionDto` |
| `CareAi_Api/Modules/Admin/AppService/AdminAppService.cs` | Maps `primary.Page_Url` to `section.PageUrl` |

**Status:** ✅ Done

---

## 2. Lead Page Caption Change
**Requirement:** Header caption on the lead registration page should read "Patient Registration" instead of "Patient Lead Management".

**Files Changed:**
| File | Change |
|---|---|
| `src/pages/leads/LeadForm.jsx` | Line ~428: updated heading text |

**Status:** ✅ Done

---

## 3. Currency Dropdown — Add INR
**Requirement:** INR was missing from the currency selection dropdown on the Case Bill Entry page.

**Files Changed:**
| File | Change |
|---|---|
| `src/pages/accounts/CaseBillEntry.jsx` | Added `'INR'` to `CURRENCIES` array |

**Status:** ✅ Done

---

## 4. Invoice Page — CareAI Logo
**Requirement:** The Invoice view page should display the CareAI company logo (matching Med_Tour's `CareAIInvoice.aspx`) instead of a placeholder icon.

**Files Changed:**
| File | Change |
|---|---|
| `src/pages/accounts/InvoiceView.jsx` | Replaced placeholder `<div>` with `<img src={logo}>` using `Example.png` |

**Status:** ✅ Done

---

## 5. View Invoice Button — Navigation
**Requirement:** The "View Invoice" button on the Case Bill Entry page should open the `accounts/invoice` page, passing the current `claimNo` as a query parameter.

**Files Changed:**
| File | Change |
|---|---|
| `src/pages/accounts/CaseBillEntry.jsx` | Added `useNavigate` inside `CaseProcessForm` sub-component; `onClick` navigates to `/accounts/invoice?claimNo=...` |

**Status:** ✅ Done

---

## 6. Case Bill Details — Demo Data
**Requirement:** The grid on `accounts/casebilldetails` must display the same data as the Med_Tour `caretemplate/casebilldetails` page — same members, same sequence, same columns.

**Members (exact):**
1. Mr. Luke Simon — Dubai Insurance
2. Mr. Vinay Narayan — Sukoon Insurance
3. Mr. AKSHAY SHIBU — NLGI
4. Mr. Ibrahim Momin — Alkoot Insurance
5. Mrs. NASIYA NAZNEEN — NLGI
6. Mr. ZAFER NAHAWI — QLM Life & Medical Insurance Company

**Files Changed:**
| File | Change |
|---|---|
| `src/pages/accounts/CaseBillDetails.jsx` | Replaced `DEMO_ROWS` with exact Med_Tour data |

**Status:** ✅ Done

---

## 7. Estimate Status — Action Column
**Requirement:** Add an Action column to the Estimate Status grid. The action icon (edit) should be enabled only for `REQUESTED` and `ACCEPTED` statuses; disabled (greyed out, not clickable) for `DECLINED` and `ESTIMATE SHARED`.

**On click (enabled rows):** Opens `/leads/estimate-req?token=<requestNo>` — same token flow used by providers via email.

**Files Changed:**
| File | Change |
|---|---|
| `src/pages/leads/EstimateStatus.jsx` | Added Action column header; per-row conditional `actionEnabled`; icon button with disabled state and navigate |

**Status:** ✅ Done

---

## 8. Estimate CU — Portal Layout Wrapper
**Requirement:** When an internal executive accesses the Estimate CU form (after accepting from the portal), it should render inside the full portal layout (left sidebar + top header). The existing public route for providers via email link must remain unchanged.

**Logic:**
- `leads/estimate-cu` added as a protected route inside portal layout
- `LeadEstimateReq` detects `isLoggedIn` and routes to `/leads/estimate-cu?token=xxx` (portal) vs `/estimate-cu?token=xxx` (public standalone)
- Same `LeadEstimateCu` component serves both contexts — reads only the `token` param

**Files Changed:**
| File | Change |
|---|---|
| `src/App.jsx` | Added `<Route path="leads/estimate-cu" element={<LeadEstimateCu />} />` inside protected layout |
| `src/components/LeadEstimateReq.jsx` | Both redirect points (already-accepted on load + Accept button) now branch on `isLoggedIn` |

**Status:** ✅ Done

---

## 9. Audit Fields — Portal Executive Identity
**Requirement:** When an internal executive submits via the portal (Accept, Decline, or Estimate CU), audit fields (`Lst_Updt_Usr`, `Crtd_Usr`, `UpdateStatusAsync updatedBy`) must capture the logged-in executive's `User_Id` instead of hardcoded `0`.

**Fields affected:**
- `MT_EstimateExpense`: `Crtd_Usr`, `Lst_Updt_Usr`
- `MT_LeadRegistration`: `Lst_Updt_Usr`
- Status history row: `updatedBy` param in `UpdateStatusAsync`

**New request fields:** `UpdatedBy` (long), `UpdatedByNm` (string) — sent from frontend with `User_Id` / `User_Full_Name` from `authUtils.getUser()`. Zero / empty for provider (anonymous) flow.

**Files Changed:**
| File | Change |
|---|---|
| `CareAi_Api/Modules/Lead/Request/LeadEstimateCuRequest.cs` | Added `UpdatedBy`, `UpdatedByNm` |
| `CareAi_Api/Modules/Lead/Request/ProviderActionRequest.cs` | Added `UpdatedBy`, `UpdatedByNm` |
| `CareAi_Api/Modules/Lead/DataLayer/LeadDAL.cs` | `SaveLeadEstimateCuAsync`: `Crtd_Usr`/`Lst_Updt_Usr` = `@UpdatedBy`; `SaveProviderActionAsync`: `Lst_Updt_Usr` = `@UpdatedBy` |
| `CareAi_Api/Modules/Lead/AppService/LeadAppService.cs` | Both methods: `UpdateStatusAsync` passes `request.UpdatedBy` instead of `0` |
| `src/components/LeadEstimateCu.jsx` | Passes `updatedBy`, `updatedByNm` in submit payload |
| `src/components/LeadEstimateReq.jsx` | Passes `updatedBy`, `updatedByNm` in action payload |

**Status:** ✅ Done

---

## 10. Success Message & Redirect — Portal Users
**Requirement:** After a successful submit (Estimate CU) or decline (Estimate Req) by an internal executive:
- Show a portal-appropriate success message instead of the provider "You can close this window" text
- Auto-redirect to Lead Search (`/leads/search`) after 1.5 seconds
- Providers are unaffected — they still see the original thank-you screen

**Messages:**
| Action | Executive | Provider |
|---|---|---|
| Estimate CU submit | "Details submitted successfully. Redirecting to Lead Search..." | "Thank you for your response. We will get back to you soon. / You can close this window." |
| Decline | "Case declined successfully." (inline, then redirect) | "Your response has been submitted successfully. Thank you!" |

**Implementation:** `useEffect` watches `submitted` + `isLoggedIn`; fires `navigate('/leads/search', { replace: true })` after `setTimeout(1500)`.

**Files Changed:**
| File | Change |
|---|---|
| `src/components/LeadEstimateCu.jsx` | Always `setSubmitted(true)`; `useEffect` auto-redirect; conditional message in thank-you screen |
| `src/components/LeadEstimateReq.jsx` | Conditional `submitMsg`; `useEffect` auto-redirect on `submitted && submitOk && isLoggedIn` |

**Status:** ✅ Done

---

## Status Remarks — Contextual Wording
**Requirement:** The `statusRemarks` value written to the status history should reflect whether the action was taken by a provider or a portal executive.

| Action | Executive | Provider |
|---|---|---|
| Accept | `"Case Accepted by Portal Executive"` | `"Case Accepted by Provider"` |
| Decline | `"Case Declined by Portal Executive"` | `"Case Declined by Provider"` |
| Estimate CU | `"Estimate Entered by Portal Executive"` | `"Estimate Received From Provider"` |

**Status:** ✅ Done (handled in frontend payload, no API change required)

---

*Last updated: 2026-05-19*
