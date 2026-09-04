# GigLink V1 — Master Screen & Interface Inventory

This document serves as the canonical, authoritative implementation contract for **GigLink V1**. It classifies every user-facing screen, nested view, modal, drawer, tab section, and system state required for the approved GigLink V1 architecture.

---

## 1. PUBLIC & INFORMATION ARCHITECTURE

### 1.1 Public Ecosystem Portal
- **Classification**: FULL PAGE
- **Parent Page**: None (Root)
- **Personas Allowed**: Guest, All Personas
- **Access Level**: Public
- **Entry Points**: Direct URL (`/`), brand logo click, unauthenticated landing.
- **Exit / Back Destination**: N/A (Root page).
- **Visible Back Arrow**: No
- **Browser/Device Back**: Supported (Returns to previous browser entry)
- **Child Screens / Modals / States**: Sign In Prompt Modal, Sign Up Prompt Modal, Global Search Bar, How It Works Section.
- **Required for V1**: Yes
- **Canonical Route**: `/`

### 1.2 Public Trust Passport Inspector
- **Classification**: FULL PAGE
- **Parent Page**: Public Ecosystem Portal
- **Personas Allowed**: Guest, All Personas
- **Access Level**: Public
- **Entry Points**: Public URL link (`/passport/:passportId`), search result item, application candidate click.
- **Exit / Back Destination**: Previous Page or `/search`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Proof Detail Drawer, Certificate Verification Badge, Unauthenticated CTA Banner.
- **Required for V1**: Yes
- **Canonical Route**: `/passport/:passportId`

### 1.3 Public Opportunity Detail View
- **Classification**: FULL PAGE
- **Parent Page**: Opportunity Marketplace / Search
- **Personas Allowed**: Guest, All Personas
- **Access Level**: Public
- **Entry Points**: Shareable link (`/opportunities/:opportunityId`), search results, marketplace cards.
- **Exit / Back Destination**: `/search` or `/partner/marketplace`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Proposal Submission Drawer (requires auth), Sign In Prompt Modal.
- **Required for V1**: Yes
- **Canonical Route**: `/opportunities/:opportunityId`

### 1.4 Ecosystem Talent & Opportunity Search
- **Classification**: FULL PAGE
- **Parent Page**: App Frame
- **Personas Allowed**: Guest, All Personas
- **Access Level**: Public
- **Entry Points**: Global search bar in Top Header, footer search link (`/search`).
- **Exit / Back Destination**: Previous Page or `/`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Search Filter Drawer, Result Item Cards.
- **Required for V1**: Yes
- **Canonical Route**: `/search`

### 1.5 About GigLink & How It Works
- **Classification**: FULL PAGE
- **Parent Page**: Public Ecosystem Portal
- **Personas Allowed**: Guest, All Personas
- **Access Level**: Public
- **Entry Points**: Footer link "About", header "How It Works" link.
- **Exit / Back Destination**: `/`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Contact Support Modal.
- **Required for V1**: Yes
- **Canonical Route**: `/about`

### 1.6 For Students & Learners Guide
- **Classification**: FULL PAGE
- **Parent Page**: Public Ecosystem Portal
- **Personas Allowed**: Guest, All Personas
- **Access Level**: Public
- **Entry Points**: Footer link "For Students", Landing Page Learner CTA card.
- **Exit / Back Destination**: `/`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Get Started CTA Button $\rightarrow$ `/auth/register`.
- **Required for V1**: Yes
- **Canonical Route**: `/for-students`

### 1.7 Help Centre & FAQ
- **Classification**: FULL PAGE
- **Parent Page**: Public Ecosystem Portal
- **Personas Allowed**: Guest, All Personas
- **Access Level**: Public
- **Entry Points**: Footer link "Help Centre", User Settings help link.
- **Exit / Back Destination**: Previous Page or `/`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Contact Support Modal, Guides & FAQs Section.
- **Required for V1**: Yes
- **Canonical Route**: `/help`

### 1.8 Privacy Policy
- **Classification**: FULL PAGE
- **Parent Page**: Public Ecosystem Portal
- **Personas Allowed**: Guest, All Personas
- **Access Level**: Public
- **Entry Points**: Footer link "Privacy Policy", Onboarding agreement link.
- **Exit / Back Destination**: `/`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: None.
- **Required for V1**: Yes
- **Canonical Route**: `/legal/privacy`

### 1.9 Terms of Service
- **Classification**: FULL PAGE
- **Parent Page**: Public Ecosystem Portal
- **Personas Allowed**: Guest, All Personas
- **Access Level**: Public
- **Entry Points**: Footer link "Terms of Service", Sign Up form link.
- **Exit / Back Destination**: `/`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: None.
- **Required for V1**: Yes
- **Canonical Route**: `/legal/terms`

### 1.10 Security & Trust Protocol
- **Classification**: FULL PAGE
- **Parent Page**: Public Ecosystem Portal
- **Personas Allowed**: Guest, All Personas
- **Access Level**: Public
- **Entry Points**: Footer link "Security & Trust", Trust Passport Inspector trust badge.
- **Exit / Back Destination**: `/`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: None.
- **Required for V1**: Yes
- **Canonical Route**: `/legal/security`

### 1.11 Public Information Architecture Categorization Summary

| Footprint / Information Area | V1 Category | Implementation Surface |
| :--- | :--- | :--- |
| **About** | V1 FULL PAGE | Canonical Route `/about` |
| **How It Works** | V1 SECTION | Embedded section inside `/` and `/about` |
| **For Students** | V1 FULL PAGE | Canonical Route `/for-students` |
| **Help Centre** | V1 FULL PAGE | Canonical Route `/help` |
| **Documentation** | V1 SECTION | Integrated section within `/help` |
| **Guides** | V1 SECTION | Sub-section within `/help` |
| **API** | V1 EXTERNAL/FUTURE | External developer portal link (Post-V1) |
| **Careers** | NOT V1 | Excluded from V1 scope |
| **Blog** | NOT V1 | Excluded from V1 scope |
| **Contact** | V1 MODAL | `Contact Support Modal` triggered from `/help` & `/about` |
| **Privacy Policy** | V1 FULL PAGE | Canonical Route `/legal/privacy` |
| **Terms of Service** | V1 FULL PAGE | Canonical Route `/legal/terms` |
| **Security / Compliance** | V1 FULL PAGE | Canonical Route `/legal/security` |

---

## 2. AUTHENTICATION

### 2.1 Sign In Screen
- **Classification**: FULL PAGE
- **Parent Page**: Landing or Auth Stack
- **Personas Allowed**: Guest
- **Access Level**: Guest Only
- **Entry Points**: Direct route `/auth/login`, Header "Sign In" button.
- **Secondary Presentation**: Can also render as an overlay modal (`Sign In Prompt Modal`) when triggered from unauthenticated public CTA buttons.
- **Exit / Back Destination**: `/` or redirected target page.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Forgot Password link, Sign Up toggle, Auth Loading/Error states.
- **Required for V1**: Yes
- **Canonical Route**: `/auth/login`

### 2.2 Sign Up Screen
- **Classification**: FULL PAGE
- **Parent Page**: Landing or Auth Stack
- **Personas Allowed**: Guest
- **Access Level**: Guest Only
- **Entry Points**: Direct route `/auth/register`, Header "Get Started" button, Sign In toggle.
- **Secondary Presentation**: Can also render as an overlay modal (`Sign Up Prompt Modal`) when triggered from unauthenticated public CTA buttons.
- **Exit / Back Destination**: `/`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Terms Agreement Checkbox, Google OAuth Trigger, Validation Error State.
- **Required for V1**: Yes
- **Canonical Route**: `/auth/register`

### 2.3 Forgot Password Screen
- **Classification**: FULL PAGE
- **Parent Page**: Sign In Screen
- **Personas Allowed**: Guest
- **Access Level**: Guest Only
- **Entry Points**: "Forgot Password?" link on Sign In Screen (`/auth/login`).
- **Exit / Back Destination**: `/auth/login`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Email Sent Success Toast.
- **Required for V1**: Yes
- **Canonical Route**: `/auth/forgot-password`

### 2.4 Reset Password Screen
- **Classification**: FULL PAGE
- **Parent Page**: Auth Email Dispatch
- **Personas Allowed**: Guest (with reset token)
- **Access Level**: Token Link
- **Entry Points**: Email link click containing Firebase Auth `actionCode`.
- **Exit / Back Destination**: Redirects to `/auth/login` upon success.
- **Visible Back Arrow**: No (Isolated Action Screen)
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Reset Token Invalid / Expired State.
- **Required for V1**: Yes
- **Canonical Route**: `/auth/reset-password`

### 2.5 Email Verification Screen
- **Classification**: FULL PAGE
- **Parent Page**: User Dashboard
- **Personas Allowed**: Authenticated User (Unverified Email)
- **Access Level**: Authenticated User
- **Entry Points**: Onboarding completion redirect, top banner click.
- **Secondary Presentation**: Can also render as a persistent top notice banner across authenticated workspaces.
- **Exit / Back Destination**: Redirects to active persona dashboard upon verification.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Resend Verification Email Button.
- **Required for V1**: Yes
- **Canonical Route**: `/auth/verify-email`

### 2.6 Account Recovery & Security Notice
- **Classification**: FULL PAGE
- **Parent Page**: Auth Stack
- **Personas Allowed**: Guest, Authenticated
- **Access Level**: Public / Authenticated
- **Entry Points**: Security flag interceptor, support system redirect.
- **Exit / Back Destination**: `/auth/login`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Contact Support Modal.
- **Required for V1**: Yes
- **Canonical Route**: `/auth/recovery`

---

## 3. ACCOUNT & ONBOARDING

### 3.1 Initial Persona Selection & Welcome
- **Classification**: FULL PAGE
- **Parent Page**: Post-Registration Auth Entry
- **Personas Allowed**: Authenticated User
- **Access Level**: Authenticated User
- **Entry Points**: Post-registration redirect when `profile.activePersona` is unconfigured.
- **Exit / Back Destination**: Cannot exit without selecting a primary persona.
- **Visible Back Arrow**: No (Mandatory Step)
- **Browser/Device Back**: Blocked until persona selected
- **Child Screens / Modals / States**: Persona Description Cards.
- **Required for V1**: Yes
- **Canonical Route**: `/onboarding`

### 3.2 Individual Profile Setup Wizard
- **Classification**: FULL PAGE
- **Parent Page**: Initial Persona Selection
- **Personas Allowed**: Learner, Partner
- **Access Level**: Authenticated User
- **Entry Points**: Persona Selection completion (`learner` or `partner`).
- **Exit / Back Destination**: `/onboarding`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Skill Tag Picker Drawer.
- **Required for V1**: Yes
- **Canonical Route**: `/onboarding/profile`

### 3.3 Organization Workspace Setup Wizard
- **Classification**: FULL PAGE
- **Parent Page**: Initial Persona Selection
- **Personas Allowed**: Client, Organization Admin
- **Access Level**: Authenticated User
- **Entry Points**: Persona Selection completion (`client` or `organization_admin`).
- **Exit / Back Destination**: `/onboarding`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Organization Logo Upload Action.
- **Required for V1**: Yes
- **Canonical Route**: `/onboarding/organization`

---

## 4. PROFILE & TRUST PASSPORT

### 4.1 My Trust Passport Editor
- **Classification**: FULL PAGE
- **Parent Page**: App Frame
- **Personas Allowed**: Authenticated User (Learner, Partner, Client)
- **Access Level**: Owner Gated
- **Entry Points**: Header avatar menu $\rightarrow$ "My Trust Passport", Dashboard Passport Widget.
- **Exit / Back Destination**: Active Persona Dashboard (`/learner/dashboard`, `/partner/dashboard`, `/client/dashboard`).
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Add/Edit Project Proof Drawer, Request Verification Modal, Verification Status Drawer, Public Passport Preview Modal.
- **Required for V1**: Yes
- **Canonical Route**: `/passport/edit`

### 4.2 Passport Overview & Bio Section
- **Classification**: TAB / SECTION
- **Parent Page**: My Trust Passport Editor
- **Personas Allowed**: Authenticated User
- **Access Level**: Owner Gated
- **Entry Points**: Passport Editor Tab "Overview & Bio".
- **Exit / Back Destination**: Tab switch within Passport Editor.
- **Child Screens / Modals / States**: Avatar Upload Action.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Section inside `/passport/edit`)

### 4.3 Skills & Endorsements Section
- **Classification**: TAB / SECTION
- **Parent Page**: My Trust Passport Editor
- **Personas Allowed**: Authenticated User
- **Access Level**: Owner Gated
- **Entry Points**: Passport Editor Tab "Skills".
- **Exit / Back Destination**: Tab switch within Passport Editor.
- **Child Screens / Modals / States**: Request Verification Modal.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Section inside `/passport/edit`)

### 4.4 Projects & Proof of Work Section
- **Classification**: TAB / SECTION
- **Parent Page**: My Trust Passport Editor
- **Personas Allowed**: Authenticated User
- **Access Level**: Owner Gated
- **Entry Points**: Passport Editor Tab "Projects & Proofs".
- **Exit / Back Destination**: Tab switch within Passport Editor.
- **Child Screens / Modals / States**: Add/Edit Project Proof Drawer.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Section inside `/passport/edit`)

### 4.5 Certificates & Credentials Section
- **Classification**: TAB / SECTION
- **Parent Page**: My Trust Passport Editor
- **Personas Allowed**: Authenticated User
- **Access Level**: Owner Gated
- **Entry Points**: Passport Editor Tab "Certificates".
- **Exit / Back Destination**: Tab switch within Passport Editor.
- **Child Screens / Modals / States**: Request Verification Modal.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Section inside `/passport/edit`)

### 4.6 Experience & Career Timeline Section
- **Classification**: TAB / SECTION
- **Parent Page**: My Trust Passport Editor
- **Personas Allowed**: Authenticated User
- **Access Level**: Owner Gated
- **Entry Points**: Passport Editor Tab "Experience & Timeline".
- **Exit / Back Destination**: Tab switch within Passport Editor.
- **Child Screens / Modals / States**: Request Verification Modal.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Section inside `/passport/edit`)

### 4.7 Reputation & Trust Score Section
- **Classification**: TAB / SECTION
- **Parent Page**: My Trust Passport Editor
- **Personas Allowed**: Authenticated User
- **Access Level**: Owner Gated
- **Entry Points**: Passport Editor Tab "Reputation & Trust".
- **Exit / Back Destination**: Tab switch within Passport Editor.
- **Child Screens / Modals / States**: Identity Verification Modal.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Section inside `/passport/edit`)

### 4.8 Profile Visibility Controls Section
- **Classification**: TAB / SECTION
- **Parent Page**: My Trust Passport Editor
- **Personas Allowed**: Authenticated User
- **Access Level**: Owner Gated
- **Entry Points**: Passport Editor Tab "Visibility & Privacy".
- **Exit / Back Destination**: Tab switch within Passport Editor.
- **Child Screens / Modals / States**: Visibility Saved Toast.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Section inside `/passport/edit`)

### 4.9 Add/Edit Project Proof Drawer
- **Classification**: DRAWER
- **Parent Page**: My Trust Passport Editor
- **Personas Allowed**: Authenticated User
- **Access Level**: Owner Gated
- **Entry Points**: "Add Project Proof" button in Passport Editor.
- **Exit / Back Destination**: Close Drawer button.
- **Child Screens / Modals / States**: Repository Link Inspector.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Drawer)

### 4.10 Request Verification Modal
- **Classification**: MODAL
- **Parent Page**: My Trust Passport Editor
- **Personas Allowed**: Authenticated User
- **Access Level**: Owner Gated
- **Entry Points**: "Request Verification" button next to Passport item.
- **Exit / Back Destination**: Close Modal button.
- **Child Screens / Modals / States**: Organization Search Selector.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Modal)

### 4.11 Verification Status Drawer
- **Classification**: DRAWER
- **Parent Page**: My Trust Passport Editor
- **Personas Allowed**: Authenticated User
- **Access Level**: Owner Gated
- **Entry Points**: Verification status badge click on Passport item.
- **Exit / Back Destination**: Close Drawer button.
- **Child Screens / Modals / States**: Resubmit Request Button.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Drawer)

### 4.12 Public Passport Preview Modal
- **Classification**: MODAL
- **Parent Page**: My Trust Passport Editor
- **Personas Allowed**: Authenticated User
- **Access Level**: Owner Gated
- **Entry Points**: "Preview Public View" button in Passport Editor.
- **Exit / Back Destination**: Close Modal button.
- **Child Screens / Modals / States**: None.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Modal)

---

## 5. LEARNER WORKSPACE

### 5.1 Learner Overview Dashboard
- **Classification**: FULL PAGE
- **Parent Page**: App Frame
- **Personas Allowed**: Learner
- **Access Level**: Persona Gated (`activePersona == 'learner'`)
- **Entry Points**: Primary navigation link, post-login default for Learner persona.
- **Exit / Back Destination**: N/A (Primary Workspace Dashboard).
- **Visible Back Arrow**: No
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Profile Completion Widget, Active Applications Summary Card, Career Guidance & AI Advisory Section.
- **Required for V1**: Yes
- **Canonical Route**: `/learner/dashboard`

### 5.2 Career Guidance & AI Advisory Section
- **Classification**: TAB / SECTION
- **Parent Page**: Learner Overview Dashboard
- **Personas Allowed**: Learner
- **Access Level**: Persona Gated
- **Entry Points**: Learner Dashboard tab, "Career Advisory" CTA.
- **Exit / Back Destination**: Dashboard tab switch.
- **Child Screens / Modals / States**: Skill Action Plan Card, AI Loading State.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Section inside `/learner/dashboard`)

### 5.3 Internships & Entry Opportunities Feed
- **Classification**: FULL PAGE
- **Parent Page**: Learner Dashboard
- **Personas Allowed**: Learner
- **Access Level**: Persona Gated
- **Entry Points**: Learner navigation menu, "Explore Opportunities" button.
- **Exit / Back Destination**: `/learner/dashboard`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Opportunity Filter Drawer, Proposal Submission Drawer.
- **Required for V1**: Yes
- **Canonical Route**: `/learner/opportunities`

### 5.4 My Applications
- **Classification**: FULL PAGE
- **Parent Page**: Learner Dashboard
- **Personas Allowed**: Learner
- **Access Level**: Persona Gated
- **Entry Points**: Learner navigation menu "My Applications".
- **Exit / Back Destination**: `/learner/dashboard`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Withdraw Application Modal, Application Detail Drawer.
- **Required for V1**: Yes
- **Canonical Route**: `/learner/applications`

### 5.5 Withdraw Application Modal
- **Classification**: MODAL
- **Parent Page**: My Applications
- **Personas Allowed**: Learner
- **Access Level**: Persona Gated
- **Entry Points**: "Withdraw" button on application card.
- **Exit / Back Destination**: Close Modal button.
- **Child Screens / Modals / States**: Application Withdrawn Toast.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Modal)

### 5.6 Application Detail Drawer
- **Classification**: DRAWER
- **Parent Page**: My Applications
- **Personas Allowed**: Learner
- **Access Level**: Persona Gated
- **Entry Points**: Application card click in Applications list.
- **Exit / Back Destination**: Close Drawer button.
- **Child Screens / Modals / States**: None.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Drawer)

---

## 6. PARTNER WORKSPACE

### 6.1 Partner Workspace Dashboard
- **Classification**: FULL PAGE
- **Parent Page**: App Frame
- **Personas Allowed**: Partner
- **Access Level**: Persona Gated (`activePersona == 'partner'`)
- **Entry Points**: Primary navigation link, post-login default for Partner persona.
- **Exit / Back Destination**: N/A (Primary Workspace Dashboard).
- **Visible Back Arrow**: No
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Active Contracts Widget, Earnings Summary Card, Payout Status Badge.
- **Required for V1**: Yes
- **Canonical Route**: `/partner/dashboard`

### 6.2 Opportunity Marketplace
- **Classification**: FULL PAGE
- **Parent Page**: Partner Workspace Dashboard
- **Personas Allowed**: Partner
- **Access Level**: Persona Gated
- **Entry Points**: Partner navigation menu "Find Work".
- **Exit / Back Destination**: `/partner/dashboard`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Proposal Submission Drawer, Search Filter Drawer.
- **Required for V1**: Yes
- **Canonical Route**: `/partner/marketplace`

### 6.3 Proposal Submission Drawer
- **Classification**: DRAWER
- **Parent Page**: Opportunity Marketplace / Opportunity Detail View
- **Personas Allowed**: Partner, Learner
- **Access Level**: Authenticated User
- **Entry Points**: "Submit Proposal" button on Opportunity View.
- **Exit / Back Destination**: Close Drawer button.
- **Child Screens / Modals / States**: Proposal Submitted Success Toast.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Drawer)

### 6.4 My Active Proposals & Bids
- **Classification**: FULL PAGE
- **Parent Page**: Partner Workspace Dashboard
- **Personas Allowed**: Partner
- **Access Level**: Persona Gated
- **Entry Points**: Partner navigation menu "My Proposals".
- **Exit / Back Destination**: `/partner/dashboard`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Withdraw Proposal Modal.
- **Required for V1**: Yes
- **Canonical Route**: `/partner/proposals`

### 6.5 Active Contract Workspace (Partner View)
- **Classification**: FULL PAGE
- **Parent Page**: Partner Workspace Dashboard
- **Personas Allowed**: Partner
- **Access Level**: Owner Gated (Contract Member)
- **Entry Points**: Contract card click from Partner Dashboard.
- **Exit / Back Destination**: `/partner/dashboard`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Submit Milestone Deliverable Modal, Messaging Panel link.
- **Required for V1**: Yes
- **Canonical Route**: `/partner/contracts/:contractId`

### 6.6 Withdraw Proposal Modal
- **Classification**: MODAL
- **Parent Page**: My Active Proposals & Bids
- **Personas Allowed**: Partner
- **Access Level**: Persona Gated
- **Entry Points**: "Withdraw Proposal" button on proposal card.
- **Exit / Back Destination**: Close Modal button.
- **Child Screens / Modals / States**: Proposal Withdrawn Toast.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Modal)

---

## 7. CLIENT WORKSPACE

### 7.1 Client Workspace Dashboard
- **Classification**: FULL PAGE
- **Parent Page**: App Frame
- **Personas Allowed**: Client
- **Access Level**: Persona Gated (`activePersona == 'client'`)
- **Entry Points**: Primary navigation link, post-login default for Client persona.
- **Exit / Back Destination**: N/A (Primary Workspace Dashboard).
- **Visible Back Arrow**: No
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Open Postings Summary, Pending Milestone Approvals Widget.
- **Required for V1**: Yes
- **Canonical Route**: `/client/dashboard`

### 7.2 Opportunity Creation Wizard
- **Classification**: FULL PAGE
- **Parent Page**: Client Workspace Dashboard
- **Personas Allowed**: Client, Organization Admin
- **Access Level**: Persona Gated
- **Entry Points**: "Post New Opportunity" button on Client/Org Dashboard.
- **Exit / Back Destination**: `/client/dashboard`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Skill Tag Selector, Budget Type Toggle.
- **Required for V1**: Yes
- **Canonical Route**: `/client/opportunities/new`

### 7.3 Opportunity & Applicant Management View
- **Classification**: FULL PAGE
- **Parent Page**: Client Workspace Dashboard
- **Personas Allowed**: Client, Organization Admin
- **Access Level**: Owner Gated
- **Entry Points**: Opportunity card click on Client Dashboard.
- **Exit / Back Destination**: `/client/dashboard`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Candidate Trust Passport Inspector Drawer, Shortlist Candidate Action, Accept Proposal Modal.
- **Required for V1**: Yes
- **Canonical Route**: `/client/opportunities/:opportunityId`

### 7.4 Candidate Trust Passport Inspector Drawer
- **Classification**: DRAWER
- **Parent Page**: Opportunity & Applicant Management View
- **Personas Allowed**: Client, Organization Admin
- **Access Level**: Owner Gated
- **Entry Points**: Applicant card click in Applicant List.
- **Exit / Back Destination**: Close Drawer button.
- **Child Screens / Modals / States**: Public Passport Link, Direct Message Button.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Drawer)

### 7.5 Active Contract Workspace (Client View)
- **Classification**: FULL PAGE
- **Parent Page**: Client Workspace Dashboard
- **Personas Allowed**: Client
- **Access Level**: Owner Gated (Contract Client)
- **Entry Points**: Active contract item on Client Dashboard.
- **Exit / Back Destination**: `/client/dashboard`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Milestone Approval & Payout Authorization Modal, Fund Milestone Modal, Contract Discussion Panel.
- **Required for V1**: Yes
- **Canonical Route**: `/client/contracts/:contractId`

### 7.6 Accept Proposal Modal
- **Classification**: MODAL
- **Parent Page**: Opportunity & Applicant Management View
- **Personas Allowed**: Client, Organization Admin
- **Access Level**: Owner Gated
- **Entry Points**: "Accept Proposal & Create Contract" button.
- **Exit / Back Destination**: Close Modal button.
- **Child Screens / Modals / States**: Contract Created Toast $\rightarrow$ Redirect to `/vault/:contractId`.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Modal)

---

## 8. ORGANIZATION WORKSPACE

### 8.1 Organization Workspace Dashboard
- **Classification**: FULL PAGE
- **Parent Page**: App Frame
- **Personas Allowed**: Organization Admin
- **Access Level**: Persona Gated (`activePersona == 'organization_admin'`)
- **Entry Points**: Primary navigation link, post-login default for Organization Admin.
- **Exit / Back Destination**: N/A (Primary Workspace Dashboard).
- **Visible Back Arrow**: No
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Org Profile Banner, Verification Requests Summary Card, Member & Team Management Section.
- **Required for V1**: Yes
- **Canonical Route**: `/organization/dashboard`

### 8.2 Member & Team Management Section
- **Classification**: TAB / SECTION
- **Parent Page**: Organization Workspace Dashboard
- **Personas Allowed**: Organization Admin
- **Access Level**: Persona Gated
- **Entry Points**: Organization Dashboard tab "Team & Admins".
- **Exit / Back Destination**: Tab switch within Org Dashboard.
- **Child Screens / Modals / States**: Invite Team Member Modal.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Section inside `/organization/dashboard`)

### 8.3 Student & Talent Verification Queue
- **Classification**: FULL PAGE
- **Parent Page**: Organization Workspace Dashboard
- **Personas Allowed**: Organization Admin
- **Access Level**: Persona Gated
- **Entry Points**: "Verification Queue" menu item, Dashboard action card.
- **Exit / Back Destination**: `/organization/dashboard`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Approve Verification Action, Reject Verification Action with Notes, Credential & Certificate Issuance Drawer.
- **Required for V1**: Yes
- **Canonical Route**: `/organization/verifications`

### 8.4 Credential & Certificate Issuance Drawer
- **Classification**: DRAWER
- **Parent Page**: Student & Talent Verification Queue
- **Personas Allowed**: Organization Admin
- **Access Level**: Persona Gated
- **Entry Points**: "Issue Credential" button in Verification Queue.
- **Exit / Back Destination**: Close Drawer button.
- **Child Screens / Modals / States**: Credential Template Selector.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Drawer)

### 8.5 Invite Team Member Modal
- **Classification**: MODAL
- **Parent Page**: Member & Team Management Section
- **Personas Allowed**: Organization Admin
- **Access Level**: Persona Gated
- **Entry Points**: "Invite Team Member" button in Team section.
- **Exit / Back Destination**: Close Modal button.
- **Child Screens / Modals / States**: Invite Sent Toast.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Modal)

---

## 9. PAYMENTS & MILESTONE VAULT (Paystack Integration)

### 9.1 Milestone Escrow Vault Inspector
- **Classification**: FULL PAGE
- **Parent Page**: Contract Workspace
- **Personas Allowed**: Client, Partner
- **Access Level**: Member Gated (Contract Parties)
- **Entry Points**: "View Escrow Vault" link in Contract Workspace (`/client/contracts/:contractId` or `/partner/contracts/:contractId`).
- **Exit / Back Destination**: Contract Workspace (`/client/contracts/:contractId` or `/partner/contracts/:contractId`).
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Fund Milestone Modal, Milestone Approval & Payout Authorization Modal, Payment Protection Information Drawer, Payment & Payout History Section.
- **Required for V1**: Yes
- **Canonical Route**: `/vault/:contractId`

### 9.2 Fund Milestone Modal
- **Classification**: MODAL
- **Parent Page**: Milestone Escrow Vault Inspector
- **Personas Allowed**: Client
- **Access Level**: Member Gated (Client)
- **Entry Points**: "Fund Milestone" button in Escrow Vault.
- **Exit / Back Destination**: Close Modal button.
- **Child Screens / Modals / States**: Paystack Gateway Handoff State, Payment Processing State, Payment Successful State.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Modal)

### 9.3 Submit Milestone Deliverable Modal
- **Classification**: MODAL
- **Parent Page**: Active Contract Workspace (Partner View)
- **Personas Allowed**: Partner
- **Access Level**: Member Gated (Partner)
- **Entry Points**: "Submit Deliverable" button on Contract Workspace.
- **Exit / Back Destination**: Close Modal button.
- **Child Screens / Modals / States**: Deliverable Submitted Toast.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Modal)

### 9.4 Milestone Approval & Payout Authorization Modal
- **Classification**: MODAL
- **Parent Page**: Milestone Escrow Vault Inspector / Contract Workspace
- **Personas Allowed**: Client
- **Access Level**: Member Gated (Client)
- **Entry Points**: "Approve Milestone & Release Escrow" button.
- **Exit / Back Destination**: Close Modal button.
- **Child Screens / Modals / States**: Release Success Toast.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Modal)

### 9.5 Refund Request Modal
- **Classification**: MODAL
- **Parent Page**: Milestone Escrow Vault Inspector
- **Personas Allowed**: Client
- **Access Level**: Member Gated (Client)
- **Entry Points**: "Request Refund" link in Escrow Vault.
- **Exit / Back Destination**: Close Modal button.
- **Child Screens / Modals / States**: Refund Request Submitted Toast.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Modal)

### 9.6 Payout Setup & Bank Selection Modal
- **Classification**: MODAL
- **Parent Page**: Partner Workspace Dashboard / Account Settings
- **Personas Allowed**: Partner
- **Access Level**: Persona Gated (Partner)
- **Entry Points**: "Set Up Payout Bank" button on Partner Dashboard.
- **Exit / Back Destination**: Close Modal button.
- **Child Screens / Modals / States**: Bank Verification Success / Failure State.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Modal)

### 9.7 Payout Request Modal
- **Classification**: MODAL
- **Parent Page**: Partner Workspace Dashboard
- **Personas Allowed**: Partner
- **Access Level**: Persona Gated (Partner)
- **Entry Points**: "Withdraw Funds" button on Partner Dashboard.
- **Exit / Back Destination**: Close Modal button.
- **Child Screens / Modals / States**: Payout Pending State, Payout Successful State.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Modal)

### 9.8 Payment Transaction Details Modal
- **Classification**: MODAL
- **Parent Page**: Milestone Vault Inspector / Payment History
- **Personas Allowed**: Client, Partner
- **Access Level**: Member Gated
- **Entry Points**: Transaction item click in Payment History.
- **Exit / Back Destination**: Close Modal button.
- **Child Screens / Modals / States**: None.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Modal)

### 9.9 Dispute / Raise Issue Modal
- **Classification**: MODAL
- **Parent Page**: Contract Workspace / Milestone Vault
- **Personas Allowed**: Client, Partner
- **Access Level**: Member Gated
- **Entry Points**: "Raise Issue / Dispute" link in Contract View.
- **Exit / Back Destination**: Close Modal button.
- **Child Screens / Modals / States**: Dispute Active State.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Modal)

### 9.10 Payment & Payout History Section
- **Classification**: TAB / SECTION
- **Parent Page**: Milestone Vault Inspector / Account Settings
- **Personas Allowed**: Client, Partner
- **Access Level**: Member Gated
- **Entry Points**: Vault Tab "Transaction History".
- **Exit / Back Destination**: Tab switch.
- **Child Screens / Modals / States**: Payment Transaction Details Modal.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Section inside `/vault/:contractId`)

### 9.11 Payment Protection Information Drawer
- **Classification**: DRAWER
- **Parent Page**: Milestone Vault Inspector
- **Personas Allowed**: Client, Partner
- **Access Level**: Public / Member Gated
- **Entry Points**: "How Milestone Protection Works" link.
- **Exit / Back Destination**: Close Drawer button.
- **Child Screens / Modals / States**: None.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Drawer)

---

## 10. MESSAGING

### 10.1 Messages & Conversations Hub
- **Classification**: FULL PAGE
- **Parent Page**: App Frame
- **Personas Allowed**: Authenticated User
- **Access Level**: Authenticated User
- **Entry Points**: Header message icon, "Message Candidate" button.
- **Exit / Back Destination**: Active Persona Dashboard.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Conversation List, Empty Messages State, User Report & Block Modal.
- **Required for V1**: Yes
- **Canonical Route**: `/messages`

### 10.2 Contextual Conversation Thread View
- **Classification**: NESTED PAGE
- **Parent Page**: Messages & Conversations Hub
- **Personas Allowed**: Authenticated User
- **Access Level**: Member Gated (Conversation Participants)
- **Entry Points**: Conversation item click inside `/messages`.
- **Exit / Back Destination**: `/messages`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: File Attachment Processing State, User Report & Block Modal.
- **Required for V1**: Yes
- **Canonical Route**: `/messages/:conversationId`

### 10.3 User Report & Block Modal
- **Classification**: MODAL
- **Parent Page**: Contextual Conversation Thread View
- **Personas Allowed**: Authenticated User
- **Access Level**: Authenticated User
- **Entry Points**: Thread Options $\rightarrow$ "Report / Block User".
- **Exit / Back Destination**: Close Modal button.
- **Child Screens / Modals / States**: Report Submitted Toast.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Modal)

---

## 11. NOTIFICATIONS

### 11.1 Dedicated Notification Center Page
- **Classification**: FULL PAGE
- **Parent Page**: App Frame
- **Personas Allowed**: Authenticated User
- **Access Level**: Authenticated User
- **Entry Points**: Navigation menu "Notifications", Notification Drawer "View All" link.
- **Exit / Back Destination**: Active Persona Dashboard.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Notification Filter Tabs, Empty Notifications State.
- **Required for V1**: Yes
- **Canonical Route**: `/notifications`

### 11.2 Notification Center Drawer
- **Classification**: DRAWER
- **Parent Page**: App Frame
- **Personas Allowed**: Authenticated User
- **Access Level**: Authenticated User
- **Entry Points**: Top Header bell icon.
- **Exit / Back Destination**: Close Drawer button.
- **Child Screens / Modals / States**: Mark All Read Action.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Drawer)

---

## 12. SETTINGS & SECURITY

### 12.1 Account Settings & Preferences
- **Classification**: FULL PAGE
- **Parent Page**: App Frame
- **Personas Allowed**: Authenticated User
- **Access Level**: Authenticated User
- **Entry Points**: Avatar menu $\rightarrow$ "Account Settings".
- **Exit / Back Destination**: Active Persona Dashboard.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Security & Password Management Section, Payment Settings Section.
- **Required for V1**: Yes
- **Canonical Route**: `/settings/account`

### 12.2 Security & Password Management Section
- **Classification**: TAB / SECTION
- **Parent Page**: Account Settings & Preferences
- **Personas Allowed**: Authenticated User
- **Access Level**: Authenticated User
- **Entry Points**: Settings menu tab "Security".
- **Exit / Back Destination**: Tab switch within Settings.
- **Child Screens / Modals / States**: Password Changed Toast.
- **Required for V1**: Yes
- **Canonical Route**: N/A (Section inside `/settings/account`)

---

## 13. ADMIN / MISSION CONTROL

### 13.1 Mission Control System Dashboard
- **Classification**: FULL PAGE
- **Parent Page**: App Frame
- **Personas Allowed**: System Admin
- **Access Level**: Admin Only (`profile.isAdmin == true`)
- **Entry Points**: Admin route `/admin/dashboard`.
- **Exit / Back Destination**: `/`.
- **Visible Back Arrow**: Yes
- **Browser/Device Back**: Supported
- **Child Screens / Modals / States**: Verification Audit Table, Dispute Review Panel.
- **Required for V1**: Yes
- **Canonical Route**: `/admin/dashboard`

---

## 14. REUSABLE SYSTEM STATE REGISTRY

The following system states are non-navigational UI conditions, overlays, notifications, or status banners used across the application:

1. **Loading State**: Full-page or container skeleton loader during async data retrieval.
2. **Empty Collection State**: Visual placeholder for empty lists (applications, proposals, verifications).
3. **Generic Error State**: Error panel with retry trigger when network or API calls fail.
4. **Action Success Toast**: Temporary floating notification confirming save/update/submit actions.
5. **Offline Banner State**: Non-intrusive banner indicating lost internet connection.
6. **Unauthorized State (401)**: Route interceptor view redirecting unauthenticated users to `/auth/login`.
7. **Forbidden Access State (403)**: Access restriction screen when trying to access unauthorized views/documents.
8. **Not Found State (404)**: Missing route page with return button to dashboard.
9. **Session Expired Dialog State**: Re-authentication prompt when Firebase Auth token expires.
10. **Verification Pending Status Badge**: Badge indicating institutional verification review in progress.
11. **Verification Approved Badge**: Green badge highlighting official institutional endorsement.
12. **Verification Rejected Badge**: Badge with reviewer feedback note popup.
13. **Payment Processing State**: Spinner verifying Paystack payment status via webhook.
14. **Payment Failed Notice**: Error alert with retry button if Paystack transaction fails.
15. **Payment Successful State**: Confirmation notice for funded milestone escrow.
16. **Payment Abandoned Notice**: Toast notification when payment popup is closed before completion.
17. **Payout Pending State**: Processing badge while Paystack Transfer is being dispatched to bank.
18. **Payout Failed State**: Alert when bank transfer payout fails.
19. **Payout Reversed Notice**: Alert when bank transfer payout is reversed by recipient bank.
20. **Network Error State**: Connection timeout notice with manual retry trigger.
21. **Maintenance Banner State**: Top banner notifying users of scheduled system maintenance.
22. **Email Unverified Notice Banner**: Persistent top warning banner advising email verification.
23. **Authentication Error State**: Validation error notice on login/signup forms.
24. **Sign Out Trigger Action**: System action clearing auth state and redirecting to `/`.
25. **Paystack Gateway Handoff State**: Processing screen initializing Paystack inline popup.
26. **Milestone Funded Badge State**: Visual status tag showing escrow funds safely in vault.
27. **Bank Account Verification State**: Loading indicator while Paystack Resolve Account API executes.
28. **Bank Verification Success / Failure State**: Inline text feedback showing resolved bank account name or failure reason.
29. **Contract Dispute Active Banner State**: Warning banner indicating contract is under admin review.
30. **Messages Loading State**: Skeleton loader for active message threads.
31. **Message Sending Failed State**: Inline retry indicator for failed message transmissions.
32. **File Attachment Processing State**: Progress bar for uploading file attachments in chat.
33. **Unread Message Indicator State**: Unread counter badge on header messages icon and thread items.
34. **Notifications Loading State**: Skeleton loader for notifications feed.
35. **Notification Delivery Error State**: Retry banner when notification loading fails.
36. **Unread Notification Badge State**: Visual counter badge on header bell icon.

---

## 15. SHARED UI / GLOBAL NAVIGATION

1. **Global Header & Persona Switcher**: Top navigation bar present on all authenticated views, containing brand logo, active persona dropdown switcher, notification bell with unread badge, direct messages button, and user avatar menu.
2. **Mobile Navigation Drawer**: Responsive slide-out menu providing clean touch navigation across persona workspaces on mobile viewports.
3. **Visible Back Navigation Anchor**: Dedicated header back button on sub-pages ensuring predictable back navigation without relying solely on browser controls.

---

## 16. PERSONAS & SINGLE IDENTITY MODEL

- **Single Identity Architecture**: One human user corresponds to **one Firebase Auth identity (`uid`)**.
- **Persona Lenses**: Switching personas (`Learner` 🎓, `Partner` 💼, `Client` 🤝, `Organization` 🏢) updates the user's active workspace context (`profile.activePersona`), granting access to persona-specific dashboards and routes without logging out or creating parallel accounts.

---

## 17. V1 SCOPE CLASSIFICATION & EXCLUSIONS

### INCLUDED IN V1
1. **Explicit Contract Dispute Escalation Modal**: (`Dispute / Raise Issue Modal`). Essential for handling milestone release deadlocks without manual database intervention.
2. **Public vs. Private Passport Visibility Controls**: (`Profile Visibility Controls Section`). Essential for letting users hide private contact details or specific non-public proofs from `/passport/:passportId`.

### EXCLUDED FROM V1 (FUTURE SCOPE)
- **LMS / Course Creation System**: Learning modules belong to external educational institutions. GigLink records verified course *credentials*, not video lessons.
- **In-App Coding IDE / Sandbox**: Learners submit GitHub repository links or live links as project proofs.
- **Integrated Video Conferencing**: Communication handled via text messages or external meeting links.
- **Public Social Feed / Wall**: Replaced by targeted search and direct verified Trust Passports.
- **Community Forum / Discord Clone**: Outside GigLink's focused career progression model.
- **Blockchain / Smart Contracts / Tokens**: Escrow and verified credentials rely on secure Firestore audit trails and Paystack APIs.
- **Autonomous AI Agents**: AI capabilities limited to server-side guidance and skill gap analysis.
- **Enterprise Payroll Engine**: Replaced by milestone escrow releases and Paystack recipient bank transfers.
- **Full CRM / HR Suite**: Excluded in favor of lightweight applicant and contract management.

---

## 18. MASTER CANONICAL SCREEN TABLE

| ID | Screen Name | Classification | Canonical Route | Persona | Access Level | Entry Point | Back Destination | Parent Screen | Primary Purpose | V1/Future | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| S01 | Public Ecosystem Portal | FULL PAGE | `/` | All | Public | Direct URL / Logo | N/A | None | Unified platform landing portal | V1 | Root Page |
| S02 | Public Trust Passport Inspector | FULL PAGE | `/passport/:passportId` | All | Public | Share link / Search | Previous / `/search` | Public Portal | Read-only verified passport view | V1 | Public Identity Surface |
| S03 | Public Opportunity Detail View | FULL PAGE | `/opportunities/:opportunityId` | All | Public | Share link / Search | `/search` | Marketplace | Public opportunity details & apply trigger | V1 | Public Opportunity View |
| S04 | Ecosystem Talent & Opportunity Search | FULL PAGE | `/search` | All | Public | Header Search Bar | Previous / `/` | App Frame | Global discovery search engine | V1 | Search Tool |
| S05 | About GigLink & How It Works | FULL PAGE | `/about` | All | Public | Header/Footer Link | `/` | Public Portal | Platform workflow & Trust Passport guide | V1 | Informational |
| S06 | For Students & Learners Guide | FULL PAGE | `/for-students` | All | Public | Footer Link / CTA | `/` | Public Portal | Ecosystem onboarding guide for students | V1 | Informational |
| S07 | Help Centre & FAQ | FULL PAGE | `/help` | All | Public | Footer Link / Settings | Previous / `/` | Public Portal | Knowledge base & support portal | V1 | Informational |
| S08 | Privacy Policy | FULL PAGE | `/legal/privacy` | All | Public | Footer Link | `/` | Public Portal | Data privacy policy | V1 | Legal |
| S09 | Terms of Service | FULL PAGE | `/legal/terms` | All | Public | Footer Link | `/` | Public Portal | Platform terms & escrow conditions | V1 | Legal |
| S10 | Security & Trust Protocol | FULL PAGE | `/legal/security` | All | Public | Footer Link | `/` | Public Portal | Institutional verification standards | V1 | Legal |
| S11 | Sign In Screen | FULL PAGE | `/auth/login` | Guest | Guest Only | Direct URL / Header | `/` | Auth Stack | User authentication via OAuth/Email | V1 | Also renders as Modal |
| S12 | Sign Up Screen | FULL PAGE | `/auth/register` | Guest | Guest Only | Direct URL / Header | `/` | Auth Stack | New user registration & persona trigger | V1 | Also renders as Modal |
| S13 | Forgot Password Screen | FULL PAGE | `/auth/forgot-password` | Guest | Guest Only | Sign In Link | `/auth/login` | Auth Stack | Password reset link dispatch | V1 | Auth Recovery |
| S14 | Reset Password Screen | FULL PAGE | `/auth/reset-password` | Guest | Token Link | Password Reset Email | `/auth/login` | Auth Stack | Validates and sets new password | V1 | Isolated Action View |
| S15 | Email Verification Screen | FULL PAGE | `/auth/verify-email` | Authenticated | User | Onboarding Redirect | Dashboard | Auth Stack | Mandates email verification | V1 | Also renders as Banner |
| S16 | Account Recovery & Security Notice | FULL PAGE | `/auth/recovery` | Guest / Auth | Public/User | Security Interceptor | `/auth/login` | Auth Stack | Guides security recovery steps | V1 | Security Alert |
| S17 | Initial Persona Selection & Welcome | FULL PAGE | `/onboarding` | Authenticated | User | Post-Registration | Mandatory | Onboarding | Establishes active persona lens | V1 | Mandatory Entry |
| S18 | Individual Profile Setup Wizard | FULL PAGE | `/onboarding/profile` | Learner / Partner | User | Persona Selected | `/onboarding` | Onboarding | Seeds individual profile & skills | V1 | Wizard Flow |
| S19 | Organization Workspace Setup Wizard | FULL PAGE | `/onboarding/organization` | Client / Org Admin | User | Persona Selected | `/onboarding` | Onboarding | Seeds organization workspace details | V1 | Wizard Flow |
| S20 | My Trust Passport Editor | FULL PAGE | `/passport/edit` | Authenticated | Owner Gated | Header Avatar Menu | Active Dashboard | App Frame | Editable passport management workspace | V1 | Primary Identity Hub |
| S21 | Learner Overview Dashboard | FULL PAGE | `/learner/dashboard` | Learner | Persona Gated | Navigation Menu | N/A | App Frame | Learner career progress dashboard | V1 | Primary Learner Hub |
| S22 | Internships & Entry Opportunities Feed | FULL PAGE | `/learner/opportunities` | Learner | Persona Gated | Learner Nav | `/learner/dashboard` | Learner Dashboard | Micro-internship & task feed | V1 | Opportunity Feed |
| S23 | My Applications | FULL PAGE | `/learner/applications` | Learner | Persona Gated | Learner Nav | `/learner/dashboard` | Learner Dashboard | Application status tracker | V1 | Candidate Tracker |
| S24 | Partner Workspace Dashboard | FULL PAGE | `/partner/dashboard` | Partner | Persona Gated | Navigation Menu | N/A | App Frame | Partner contract & earnings workspace | V1 | Primary Partner Hub |
| S25 | Opportunity Marketplace | FULL PAGE | `/partner/marketplace` | Partner | Persona Gated | Partner Nav | `/partner/dashboard` | Partner Dashboard | Full freelance contract marketplace | V1 | Marketplace Feed |
| S26 | My Active Proposals & Bids | FULL PAGE | `/partner/proposals` | Partner | Persona Gated | Partner Nav | `/partner/dashboard` | Partner Dashboard | Submitted proposals manager | V1 | Proposals Tracker |
| S27 | Active Contract Workspace (Partner View) | FULL PAGE | `/partner/contracts/:contractId` | Partner | Owner Gated | Dashboard Card | `/partner/dashboard` | Partner Dashboard | Partner contract execution view | V1 | Contract Workspace |
| S28 | Client Workspace Dashboard | FULL PAGE | `/client/dashboard` | Client | Persona Gated | Navigation Menu | N/A | App Frame | Client project & escrow dashboard | V1 | Primary Client Hub |
| S29 | Opportunity Creation Wizard | FULL PAGE | `/client/opportunities/new` | Client / Org Admin | Persona Gated | Client Nav | `/client/dashboard` | Client Dashboard | Multi-step job posting editor | V1 | Job Creation Wizard |
| S30 | Opportunity & Applicant Management View | FULL PAGE | `/client/opportunities/:opportunityId` | Client / Org Admin | Owner Gated | Dashboard Card | `/client/dashboard` | Client Dashboard | Candidate application reviewer | V1 | Applicant Manager |
| S31 | Active Contract Workspace (Client View) | FULL PAGE | `/client/contracts/:contractId` | Client | Owner Gated | Dashboard Card | `/client/dashboard` | Client Dashboard | Client contract & deliverable reviewer | V1 | Contract Workspace |
| S32 | Organization Workspace Dashboard | FULL PAGE | `/organization/dashboard` | Org Admin | Persona Gated | Navigation Menu | N/A | App Frame | Institutional admin workspace | V1 | Primary Org Hub |
| S33 | Student & Talent Verification Queue | FULL PAGE | `/organization/verifications` | Org Admin | Persona Gated | Org Nav | `/organization/dashboard` | Org Dashboard | Institutional credential verification queue | V1 | Verification Queue |
| S34 | Milestone Escrow Vault Inspector | FULL PAGE | `/vault/:contractId` | Client / Partner | Member Gated | Contract Workspace | Contract Workspace | Contract Workspace | Shared financial escrow workspace | V1 | Paystack Vault Hub |
| S35 | Messages & Conversations Hub | FULL PAGE | `/messages` | Authenticated | User | Header Icon | Active Dashboard | App Frame | Direct chat thread hub | V1 | Chat Hub |
| S36 | Contextual Conversation Thread View | NESTED PAGE | `/messages/:conversationId` | Authenticated | Member Gated | Thread Item | `/messages` | Messages Hub | Active conversation thread view | V1 | Active Chat View |
| S37 | Dedicated Notification Center Page | FULL PAGE | `/notifications` | Authenticated | User | Nav Menu / Drawer | Active Dashboard | App Frame | Full page notification feed | V1 | Notification Center |
| S38 | Account Settings & Preferences | FULL PAGE | `/settings/account` | Authenticated | User | Avatar Menu | Active Dashboard | App Frame | Account, security, & persona settings | V1 | Settings Hub |
| S39 | Mission Control System Dashboard | FULL PAGE | `/admin/dashboard` | System Admin | Admin Only | Direct Route | `/` | App Frame | Platform audit & system health dashboard | V1 | System Admin |
| M01 | Sign In Prompt Modal | MODAL | N/A | Guest | Public | Unauth CTA click | Close Button | Public Portal | Unauthenticated sign-in prompt | V1 | Secondary Auth View |
| M02 | Contact Support Modal | MODAL | N/A | All | Public | Help / About Link | Close Button | Help / About | Direct support message modal | V1 | Help Modal |
| M03 | Public Passport Preview Modal | MODAL | N/A | Authenticated | Owner Gated | Passport Editor | Close Button | Passport Editor | Previews public view before save | V1 | Passport Preview |
| M04 | Request Verification Modal | MODAL | N/A | Authenticated | Owner Gated | Passport Item | Close Button | Passport Editor | Submits credential for verification | V1 | Verification Form |
| M05 | Withdraw Application Modal | MODAL | N/A | Learner | Persona Gated | Application Card | Close Button | My Applications | Cancels submitted application | V1 | Application Action |
| M06 | Withdraw Proposal Modal | MODAL | N/A | Partner | Persona Gated | Proposal Card | Close Button | Active Proposals | Retracts submitted proposal | V1 | Proposal Action |
| M07 | Accept Proposal Modal | MODAL | N/A | Client / Org Admin | Owner Gated | Applicant View | Close Button | Applicant Management | Accepts candidate proposal & creates contract | V1 | Contract Trigger |
| M08 | Fund Milestone Modal | MODAL | N/A | Client | Member Gated | Escrow Vault | Close Button | Vault Inspector | Triggers Paystack inline payment popup | V1 | Paystack Gateway |
| M09 | Submit Milestone Deliverable Modal | MODAL | N/A | Partner | Member Gated | Partner Contract | Close Button | Contract Workspace | Submits completed work deliverables | V1 | Deliverable Submission |
| M10 | Milestone Approval & Payout Authorization Modal | MODAL | N/A | Client | Member Gated | Vault / Contract | Close Button | Vault Inspector | Approves work & releases escrow funds | V1 | Escrow Release |
| M11 | Refund Request Modal | MODAL | N/A | Client | Member Gated | Escrow Vault | Close Button | Vault Inspector | Requests milestone deposit refund | V1 | Refund Trigger |
| M12 | Payout Setup & Bank Selection Modal | MODAL | N/A | Partner | Persona Gated | Partner Dashboard | Close Button | Partner Dashboard | Configures bank account via Paystack API | V1 | Bank Setup |
| M13 | Payout Request Modal | MODAL | N/A | Partner | Persona Gated | Partner Dashboard | Close Button | Partner Dashboard | Dispatches bank transfer payout | V1 | Bank Transfer |
| M14 | Payment Transaction Details Modal | MODAL | N/A | Client / Partner | Member Gated | Payment History | Close Button | Vault / Settings | Auditable payment receipt modal | V1 | Receipt Viewer |
| M15 | Dispute / Raise Issue Modal | MODAL | N/A | Client / Partner | Member Gated | Contract View | Close Button | Contract Workspace | Submits formal contract dispute | V1 | Dispute Trigger |
| M16 | User Report & Block Modal | MODAL | N/A | Authenticated | User | Chat Thread Options | Close Button | Chat Thread | Reports or blocks abusive users | V1 | Safety Control |
| M17 | Invite Team Member Modal | MODAL | N/A | Org Admin | Persona Gated | Org Dashboard | Close Button | Org Dashboard | Invites team admins to workspace | V1 | Org Admin Action |
| D01 | Search Filter Drawer | DRAWER | N/A | Guest / Auth | Public | Search Bar | Close Button | Search Page | Filters talent & opportunity search | V1 | Search Drawer |
| D02 | Opportunity Filter Drawer | DRAWER | N/A | Learner / Partner | Persona Gated | Feed Page | Close Button | Marketplace / Feed | Filters opportunities by category/budget | V1 | Filter Drawer |
| D03 | Application Detail Drawer | DRAWER | N/A | Learner | Persona Gated | Applications List | Close Button | My Applications | Detailed application status panel | V1 | Detail Drawer |
| D04 | Candidate Trust Passport Inspector Drawer | DRAWER | N/A | Client / Org Admin | Owner Gated | Applicant Item | Close Button | Applicant Management | Candidate passport slide-over inspector | V1 | Candidate Review |
| D05 | Add/Edit Project Proof Drawer | DRAWER | N/A | Authenticated | Owner Gated | Passport Editor | Close Button | Passport Editor | Project portfolio upload form | V1 | Portfolio Form |
| D06 | Verification Status Drawer | DRAWER | N/A | Authenticated | Owner Gated | Passport Item | Close Button | Passport Editor | Inspects verification feedback notes | V1 | Status Inspector |
| D07 | Proposal Submission Drawer | DRAWER | N/A | Partner / Learner | User | Opportunity View | Close Button | Opportunity View | Formal proposal submission form | V1 | Proposal Form |
| D08 | Credential & Certificate Issuance Drawer | DRAWER | N/A | Org Admin | Persona Gated | Verification Queue | Close Button | Verification Queue | Form to issue verified credentials | V1 | Credential Issuer |
| D09 | Payment Protection Information Drawer | DRAWER | N/A | Client / Partner | Public / User | Vault Inspector | Close Button | Vault Inspector | Escrow protection rules slide-over | V1 | Protection Info |
| D10 | Notification Center Drawer | DRAWER | N/A | Authenticated | User | Header Bell Icon | Close Button | App Frame | Quick slide-over notification drawer | V1 | Quick Notifications |
| T01 | Passport Overview & Bio Section | TAB / SECTION | N/A | Authenticated | Owner Gated | Tab Switch | Tab Switch | Passport Editor | Bio, display name, contact preference | V1 | Profile Form |
| T02 | Skills & Endorsements Section | TAB / SECTION | N/A | Authenticated | Owner Gated | Tab Switch | Tab Switch | Passport Editor | Skill tags & institutional endorsements | V1 | Skill Manager |
| T03 | Projects & Proof of Work Section | TAB / SECTION | N/A | Authenticated | Owner Gated | Tab Switch | Tab Switch | Passport Editor | Portfolio project entries | V1 | Portfolio Manager |
| T04 | Certificates & Credentials Section | TAB / SECTION | N/A | Authenticated | Owner Gated | Tab Switch | Tab Switch | Passport Editor | Verified degrees & certificates | V1 | Credential Manager |
| T05 | Experience & Career Timeline Section | TAB / SECTION | N/A | Authenticated | Owner Gated | Tab Switch | Tab Switch | Passport Editor | Work history & career timeline | V1 | Timeline Manager |
| T06 | Reputation & Trust Score Section | TAB / SECTION | N/A | Authenticated | Owner Gated | Tab Switch | Tab Switch | Passport Editor | Trust score & review breakdown | V1 | Reputation Viewer |
| T07 | Profile Visibility Controls Section | TAB / SECTION | N/A | Authenticated | Owner Gated | Tab Switch | Tab Switch | Passport Editor | Toggles public vs. private visibility | V1 | Privacy Controls |
| T08 | Career Guidance & AI Advisory Section | TAB / SECTION | N/A | Learner | Persona Gated | Tab Switch / CTA | Tab Switch | Learner Dashboard | AI skill gap recommendations | V1 | Career Advisor |
| T09 | Member & Team Management Section | TAB / SECTION | N/A | Org Admin | Persona Gated | Tab Switch | Tab Switch | Org Dashboard | Team admin list & invitations | V1 | Org Team Manager |
| T10 | Payment & Payout History Section | TAB / SECTION | N/A | Client / Partner | Member Gated | Tab Switch | Tab Switch | Vault / Settings | Auditable payment transaction list | V1 | Payment History |
| T11 | Security & Password Management Section | TAB / SECTION | N/A | Authenticated | User | Tab Switch | Tab Switch | Account Settings | Password change & security logs | V1 | Security Manager |
| T12 | How It Works Section | TAB / SECTION | N/A | All | Public | Scroll / Link | Scroll | Portal / About | Explanatory visual workflow section | V1 | Information Section |
| T13 | Guides & FAQs Section | TAB / SECTION | N/A | All | Public | Tab Switch | Tab Switch | Help Centre | Categorized FAQ & self-serve guides | V1 | Help Section |
| Y01 | Global Loading State | SYSTEM STATE | N/A | All | Public / User | Async Data Fetch | N/A | Global Container | Skeleton loaders during data fetch | V1 | UI System State |
| Y02 | Empty Collection State | SYSTEM STATE | N/A | All | Public / User | Zero Items Returned | N/A | List Container | Visual placeholder for empty lists | V1 | UI System State |
| Y03 | Generic Error State | SYSTEM STATE | N/A | All | Public / User | API Call Failed | N/A | View Container | Error message panel with retry button | V1 | UI System State |
| Y04 | Action Success Toast | SYSTEM STATE | N/A | All | Public / User | Save / Submit Done | N/A | Screen Corner | Temporary confirmation toast | V1 | UI System State |
| Y05 | Offline Banner State | SYSTEM STATE | N/A | All | Public / User | Connection Lost | N/A | App Header | Top banner indicating offline mode | V1 | UI System State |
| Y06 | Unauthorized State (401) | SYSTEM STATE | N/A | Guest | Guest | Protected Route Hit | `/auth/login` | Route Guard | Redirects unauthenticated requests | V1 | Guard System State |
| Y07 | Forbidden Access State (403) | SYSTEM STATE | N/A | Authenticated | User | Unowned Document Hit | Active Dashboard | Route Guard | Access denied restriction view | V1 | Guard System State |
| Y08 | Not Found State (404) | SYSTEM STATE | N/A | All | Public | Invalid Route Hit | `/` | Router Root | Missing route placeholder page | V1 | Guard System State |
| Y09 | Session Expired Dialog State | SYSTEM STATE | N/A | Authenticated | User | Token Expired | `/auth/login` | Auth Guard | Re-authentication modal prompt | V1 | Guard System State |
| Y10 | Verification Pending Status Badge | SYSTEM STATE | N/A | Authenticated | User | Request Submitted | N/A | Passport Item | Badge indicating review in progress | V1 | Badge System State |
| Y11 | Verification Approved Badge | SYSTEM STATE | N/A | Authenticated | User | Endorsed Item | N/A | Passport Item | Green institutional verified badge | V1 | Badge System State |
| Y12 | Verification Rejected Badge | SYSTEM STATE | N/A | Authenticated | User | Rejected Request | N/A | Passport Item | Badge with reviewer feedback note | V1 | Badge System State |
| Y13 | Payment Processing State | SYSTEM STATE | N/A | Client | Member Gated | Paystack Callback | N/A | Payment Gateway | Webhook verification spinner | V1 | Payment System State |
| Y14 | Payment Failed Notice | SYSTEM STATE | N/A | Client | Member Gated | Transaction Declined | N/A | Payment Gateway | Error notice with retry button | V1 | Payment System State |
| Y15 | Payment Successful State | SYSTEM STATE | N/A | Client | Member Gated | Webhook Verified | N/A | Vault Inspector | Milestone escrow deposit confirmation | V1 | Payment System State |
| Y16 | Payment Abandoned Notice | SYSTEM STATE | N/A | Client | Member Gated | Popup Closed | N/A | Vault Inspector | Toast notification when payment closed | V1 | Payment System State |
| Y17 | Payout Pending State | SYSTEM STATE | N/A | Partner | Persona Gated | Transfer Triggered | N/A | Partner Dashboard | Badge while transfer dispatches | V1 | Payment System State |
| Y18 | Payout Failed State | SYSTEM STATE | N/A | Partner | Persona Gated | Transfer Failed | N/A | Partner Dashboard | Alert notice if payout fails | V1 | Payment System State |
| Y19 | Payout Reversed Notice | SYSTEM STATE | N/A | Partner | Persona Gated | Transfer Reversed | N/A | Partner Dashboard | Warning notice if payout reversed | V1 | Payment System State |
| Y20 | Network Error State | SYSTEM STATE | N/A | All | Public / User | Timeout / Drop | N/A | Screen View | Timeout message with retry trigger | V1 | System Error State |
| Y21 | Maintenance Banner State | SYSTEM STATE | N/A | All | Public | System Flag | N/A | App Header | Scheduled maintenance top banner | V1 | System Banner State |
| Y22 | Email Unverified Notice Banner | SYSTEM STATE | N/A | Authenticated | User | Unverified Email | N/A | App Header | Persistent top warning banner | V1 | Warning Banner |
| Y23 | Authentication Error State | SYSTEM STATE | N/A | Guest | Guest | Invalid Login | N/A | Auth Forms | Form error notice | V1 | Form System State |
| Y24 | Sign Out Trigger Action | SYSTEM STATE | N/A | Authenticated | User | Sign Out Click | `/` | Header Menu | Non-visual state clearing local auth | V1 | Auth Trigger State |
| Y25 | Paystack Gateway Handoff State | SYSTEM STATE | N/A | Client | Member Gated | Fund Click | N/A | Payment Gateway | Inline popup initialization spinner | V1 | Gateway Handoff |
| Y26 | Milestone Funded Badge State | SYSTEM STATE | N/A | Client / Partner | Member Gated | Escrow Deposited | N/A | Vault / Contract | Visual status tag showing vault funds | V1 | Status System State |
| Y27 | Bank Account Verification State | SYSTEM STATE | N/A | Partner | Persona Gated | Account Number Input | N/A | Payout Modal | Loading spinner while validating bank | V1 | API Validation State |
| Y28 | Bank Verification Success / Failure State | SYSTEM STATE | N/A | Partner | Persona Gated | Resolve API Complete | N/A | Payout Modal | Inline resolved account feedback | V1 | API Feedback State |
| Y29 | Contract Dispute Active Banner State | SYSTEM STATE | N/A | Client / Partner | Member Gated | Dispute Logged | N/A | Contract Workspace | Warning banner for admin review | V1 | Dispute Banner State |
| Y30 | Messages Loading State | SYSTEM STATE | N/A | Authenticated | User | Chat Fetch | N/A | Messages Hub | Skeleton loader for conversations | V1 | Chat System State |
| Y31 | Message Sending Failed State | SYSTEM STATE | N/A | Authenticated | User | Transmission Failed | N/A | Chat Thread | Retry indicator on unsent message | V1 | Chat System State |
| Y32 | File Attachment Processing State | SYSTEM STATE | N/A | Authenticated | User | Attachment Upload | N/A | Chat Thread | Progress bar for uploading files | V1 | Upload Progress |
| Y33 | Unread Message Indicator State | SYSTEM STATE | N/A | Authenticated | User | Unread Message Received | N/A | Header / Thread | Counter badge on message icon | V1 | Counter Badge |
| Y34 | Notifications Loading State | SYSTEM STATE | N/A | Authenticated | User | Feed Fetch | N/A | Notification Center | Skeleton loader for alert feed | V1 | Feed System State |
| Y35 | Notification Delivery Error State | SYSTEM STATE | N/A | Authenticated | User | Feed Error | N/A | Notification Center | Retry banner when alert fetch fails | V1 | Feed System State |
| Y36 | Unread Notification Badge State | SYSTEM STATE | N/A | Authenticated | User | New Alert Created | N/A | Header Bell Icon | Counter badge on bell icon | V1 | Counter Badge |

---

## 19. FINAL NORMALIZED INVENTORY METRICS

```
FULL PAGE: 38
NESTED PAGE: 1
MODAL: 17
DRAWER: 10
TAB/SECTION: 13
SYSTEM STATE: 36
TOTAL CANONICAL ROUTES: 39

TOTAL UNIQUE INVENTORY ITEMS: 115
```

---

## 20. DEPENDENCY ORDER FOR IMPLEMENTATION

This build order strictly adheres to technical and domain dependencies in GigLink's architecture:

1. **App Shell & Global Navigation Framework**: Header, Persona Switcher, Mobile Navigation Drawer, Base Layout Frame, and Route Guards.
   - *Dependency Rationale*: All authenticated and public views require the shell container, route guards, and persona switcher to render.
2. **Authentication Stack**: Sign In, Sign Up, Password Reset, Email Verification, and Firebase Auth state listeners.
   - *Dependency Rationale*: Establishes Firebase Auth sessions (`uid`) required by all downstream workspaces.
3. **Onboarding Stack**: Initial Persona Selection Wizard, Learner/Partner Profile Setup, Organization Workspace Setup.
   - *Dependency Rationale*: Populates `activePersona` and base profile data required before a user can access persona-gated routes.
4. **Trust Passport Engine**: Passport Editor (`/passport/edit`), Overview, Skills, Projects, Credentials, Timeline, Trust Score, Visibility Controls, and Public Passport Inspector (`/passport/:passportId`).
   - *Dependency Rationale*: The Trust Passport is GigLink's central currency. Learners/Partners cannot apply to opportunities without a seeded passport.
5. **Opportunities & Search Engine**: Opportunity Creation Wizard, Opportunity Detail View, Marketplace Feed, and Global Search (`/search`).
   - *Dependency Rationale*: Opportunities must exist before proposals can be submitted or candidates reviewed.
6. **Applications & Proposals Engine**: Proposal Submission Drawer, Learner Applications Tracker, Partner Proposals Manager.
   - *Dependency Rationale*: Connects candidate Trust Passports to posted opportunities.
7. **Contracts & Applicant Management**: Opportunity & Applicant Management View, Candidate Passport Inspector Drawer, Active Contract Workspaces (Client and Partner Views).
   - *Dependency Rationale*: Contracts are spawned from accepted proposals and serve as the parent context for Milestone Escrow Vaults.
8. **Milestone Vault & Paystack Payments**: Milestone Vault Inspector (`/vault/:contractId`), Fund Milestone Modal, Milestone Approvals, Bank Account Setup, and Payout Transfer Modals.
   - *Dependency Rationale*: Financial transactions require active Contracts and Milestone structures.
9. **Organization & Verification Queue**: Org Workspace Dashboard, Member Management, Verification Queue (`/organization/verifications`), Credential Issuance Drawer.
10. **Direct Messaging Engine**: Messages Hub (`/messages`), Contextual Conversation Thread View (`/messages/:conversationId`), File Attachments, Safety & Reporting Modals.
11. **Notifications Center**: Dedicated Notification Center Page (`/notifications`), Desktop Slide-over Drawer.
12. **Account Settings & Security**: Account Settings Page (`/settings/account`), Password Change, Security Logs.
13. **Admin Mission Control**: Mission Control System Dashboard (`/admin/dashboard`), Verification Audits, Dispute Review, Webhook Logs.
14. **Final System States & Visual Polish**: Toast notifications, empty states, error fallbacks, skeleton loaders, and responsive mobile polish.

---

*This document is the complete, canonical implementation contract for GigLink V1. No code, UI components, or routes will be built until explicit user approval is granted.*
