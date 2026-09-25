# Safe Link - Admin Platform User Manual

## Table of Contents
1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Dashboard](#dashboard)
4. [User Management](#user-management)
5. [Family Management](#family-management)
6. [Subscription Management](#subscription-management)
7. [Support Tickets](#support-tickets)
8. [Trust & Safety](#trust--safety)
9. [Audit Logs](#audit-logs)
10. [Admin User Management](#admin-user-management)
11. [Best Practices](#best-practices)

---

## Overview

### What is the Safe Link Admin Platform?

The Admin Platform is a back-office system for Safe Link staff to:
- Manage consumer users and families
- Handle subscription billing issues
- Respond to support tickets
- Monitor trust and safety concerns
- Audit system activity

### Access Levels

| Role | Permissions |
|------|-------------|
| **SUPER_ADMIN** | Full access to all features, can manage other admins |
| **SUPPORT_ADMIN** | User/family lookup, support tickets, basic user actions |
| **BILLING_ADMIN** | Subscription management, payment issues, refunds |
| **TRUST_SAFETY** | Risk flags, account suspensions, content moderation |
| **ANALYST** | Read-only access to reports and analytics |

---

## Getting Started

### First-Time Setup (Super Admin)

If this is a fresh installation with no admin users:

1. Navigate to `/admin/setup`
2. Create the first Super Admin account:
   - **Email**: Your admin email
   - **Password**: Strong password (min 12 characters recommended)
   - **First Name** and **Last Name**
3. Click **"Create Super Admin"**
4. You'll be redirected to the login page

**Note:** The setup page only works when no admin users exist in the system.

### Logging In

1. Go to `/admin/login`
2. Enter your admin email and password
3. Click **"Sign In"**
4. You'll be redirected to the admin dashboard

**Security Notes:**
- Admin sessions expire after 8 hours
- After 5 failed login attempts, the account is locked for 15 minutes
- All login attempts are logged for security auditing

### Logging Out

1. Click your name in the top-right corner
2. Select **"Sign Out"**
3. Your session is immediately terminated

---

## Dashboard

### Overview

The dashboard provides a real-time snapshot of system health and activity:

**Key Metrics Cards:**
- Total Users
- Active Families
- Premium Subscribers
- Open Support Tickets

**Alerts Section:**
Displays items requiring immediate attention:
- High-priority support tickets
- Risk flags on accounts
- Payment failures
- Unusual activity patterns

**Recent Activity Feed:**
Shows the latest actions across the platform:
- New user registrations
- Subscription changes
- Support ticket updates
- Admin actions

### Refreshing Data

- Dashboard auto-refreshes every 60 seconds
- Click the refresh icon to manually update
- Data shown is near real-time (typically <30 second delay)

---

## User Management

### Searching for Users

1. Go to **Users** from the sidebar
2. Use the search box to find users by:
   - Email address
   - Name
   - User ID
3. Filter by:
   - Account status (Active, Suspended, Deleted)
   - Account type (Parent, Guardian, Child)
   - Subscription tier
   - Registration date range

### Viewing User Details

Click on a user row to see:
- **Profile Information**: Name, email, phone, registration date
- **Family Memberships**: All families they belong to with roles
- **Subscription Status**: Current plan, billing info
- **Activity Log**: Recent actions taken by the user
- **Risk Flags**: Any trust/safety concerns

### User Actions

**Available to Support Admin and above:**

| Action | Description |
|--------|-------------|
| **View Profile** | See full user details |
| **Reset Password** | Send password reset email |
| **Verify Email** | Manually verify email address |
| **Edit Profile** | Update name, email, phone |

**Available to Trust & Safety and above:**

| Action | Description |
|--------|-------------|
| **Suspend Account** | Temporarily disable account access |
| **Unsuspend Account** | Restore access to suspended account |
| **Add Risk Flag** | Flag account for review |
| **Remove Risk Flag** | Clear a risk flag |

**Available to Super Admin only:**

| Action | Description |
|--------|-------------|
| **Delete Account** | Permanently remove user (soft delete) |
| **Export User Data** | Generate GDPR data export |
| **Impersonate** | Log in as user for debugging |

### Suspending a User

1. Find the user in User Management
2. Click **"Suspend Account"**
3. Select a reason:
   - Terms of Service violation
   - Suspicious activity
   - Payment fraud
   - User request
   - Other (specify)
4. Add internal notes (optional)
5. Click **"Confirm Suspension"**

The user will:
- Be immediately logged out
- See a "Account Suspended" message on login
- Receive an email notification (unless disabled)

---

## Family Management

### Searching for Families

1. Go to **Families** from the sidebar
2. Search by:
   - Family name
   - Family ID
   - Owner email
3. Filter by:
   - Member count
   - Subscription status
   - Creation date

### Viewing Family Details

Click on a family to see:
- **Basic Info**: Name, creation date, owner
- **Members List**: All members with roles and status
- **Children Profiles**: Managed child accounts
- **Subscription**: Current plan and billing
- **Events**: Recent calendar activity
- **Audit Trail**: Changes to the family

### Family Actions

| Action | Permission Required |
|--------|---------------------|
| View details | Support Admin |
| Edit family name | Support Admin |
| Remove member | Trust & Safety |
| Transfer ownership | Super Admin |
| Delete family | Super Admin |

### Transferring Family Ownership

When a paying parent needs to transfer ownership:

1. View the family details
2. Click **"Transfer Ownership"**
3. Select the new owner from current members (must be PARENT role)
4. Add reason for transfer
5. Click **"Confirm Transfer"**

**Note:** This also transfers billing responsibility for the subscription.

---

## Subscription Management

### Viewing Subscriptions

1. Go to **Subscriptions** from the sidebar
2. See all subscriptions with:
   - Family name
   - Current tier
   - Status
   - Next billing date
   - Payment method

### Filtering Subscriptions

Filter by:
- **Tier**: FREE, PREMIUM, PREMIUM_PLUS
- **Status**: ACTIVE, PAST_DUE, CANCELLED, EXPIRED, TRIALING
- **Billing Period**: Monthly, Annual
- **Date Range**: Renewal dates

### Subscription Actions

**Grant Trial (Billing Admin+)**
1. Find the subscription
2. Click **"Grant Trial"**
3. Select trial duration (7, 14, or 30 days)
4. Add reason (e.g., "Customer service gesture")
5. Click **"Apply Trial"**

**Change Tier (Billing Admin+)**
1. Find the subscription
2. Click **"Change Tier"**
3. Select new tier
4. Choose effective date:
   - Immediately
   - Next billing cycle
5. Add reason for change
6. Click **"Apply Change"**

**Handle Past Due (Billing Admin+)**
1. Find subscriptions with PAST_DUE status
2. Options:
   - Extend grace period
   - Downgrade to FREE
   - Cancel subscription
3. Add notes about customer communication
4. Apply action

**Cancel Subscription (Billing Admin+)**
1. Click **"Cancel Subscription"**
2. Select cancellation type:
   - End of current period
   - Immediate
3. Select reason
4. Confirm cancellation

### Viewing Payment History

1. Click on a subscription
2. Go to **"Payment History"** tab
3. See all transactions:
   - Date
   - Amount
   - Status (Success, Failed, Refunded)
   - Payment method

### Processing Refunds

1. Find the payment in history
2. Click **"Refund"**
3. Enter refund amount (full or partial)
4. Select reason
5. Click **"Process Refund"**

**Note:** Refunds are processed through the payment provider (Google Play/App Store) and may take 5-10 business days.

---

## Support Tickets

### Ticket Overview

Support tickets are customer inquiries submitted through:
- In-app help center
- Email to support@safelink.app
- Automated system triggers

### Viewing Tickets

1. Go to **Tickets** from the sidebar
2. Default view shows **Open** tickets sorted by priority
3. Filter by:
   - Status: OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED
   - Priority: LOW, MEDIUM, HIGH, URGENT
   - Category: ACCOUNT, BILLING, TECHNICAL, FEATURE_REQUEST, OTHER
   - Assigned agent

### Ticket Priorities

| Priority | Response SLA | Description |
|----------|--------------|-------------|
| URGENT | 1 hour | Account locked, payment fraud, safety issue |
| HIGH | 4 hours | Payment problem, can't access features |
| MEDIUM | 24 hours | Feature questions, non-blocking issues |
| LOW | 72 hours | Feature requests, general inquiries |

### Working on a Ticket

1. Click a ticket to open it
2. Review:
   - Customer message
   - Account details (linked user/family)
   - Previous tickets from this user
3. Click **"Assign to Me"** to take ownership

### Responding to a Ticket

1. Type your response in the message box
2. Choose visibility:
   - **Public**: Customer sees the response
   - **Internal Note**: Only admins see (for handoffs)
3. Optionally attach files
4. Click **"Send Response"**

### Ticket Actions

| Action | Description |
|--------|-------------|
| **Assign** | Transfer to another agent |
| **Change Priority** | Escalate or de-escalate |
| **Change Category** | Re-categorize the issue |
| **Merge** | Combine duplicate tickets |
| **Link to User/Family** | Associate with account |

### Resolving Tickets

1. After resolving the issue, click **"Mark Resolved"**
2. Select resolution type:
   - Issue fixed
   - Information provided
   - No action needed
   - Duplicate
3. Add resolution notes
4. Click **"Resolve"**

The customer receives a satisfaction survey.

### Reopening Tickets

If a customer replies to a resolved ticket:
- Ticket automatically reopens
- Original agent is notified
- Priority is set to previous level

---

## Trust & Safety

### Risk Flags

Risk flags highlight accounts needing review:

| Flag Type | Trigger |
|-----------|---------|
| **Payment Fraud** | Chargebacks, suspicious payment patterns |
| **TOS Violation** | Reported content, abusive behavior |
| **Suspicious Activity** | Unusual login patterns, data scraping |
| **Account Sharing** | Multiple IPs, impossible travel |
| **Child Safety** | CSAM reports, grooming concerns |

### Viewing Flagged Accounts

1. Go to **Trust & Safety** from the sidebar
2. See all accounts with active risk flags
3. Click a flag to see:
   - Flag reason and details
   - When flagged
   - Who flagged it
   - Account history

### Investigating Flags

1. Review the flag details
2. Check account activity:
   - Login history
   - Location patterns
   - Recent actions
3. Review related accounts (family members)
4. Make a determination

### Flag Resolutions

| Resolution | Action |
|------------|--------|
| **Clear Flag** | No issue found, remove flag |
| **Monitor** | Keep flag, no action yet |
| **Warn User** | Send warning email |
| **Suspend** | Temporarily disable account |
| **Ban** | Permanent account termination |
| **Escalate** | Forward to legal team |

### Emergency Actions

For immediate safety concerns:

1. Click **"Emergency Suspend"**
2. This immediately:
   - Logs out all user sessions
   - Disables account access
   - Notifies Trust & Safety team lead
3. Document the reason
4. Follow up within 24 hours

---

## Audit Logs

### Purpose

Audit logs provide an immutable record of all admin actions for:
- Compliance requirements
- Security investigations
- Quality assurance

### Viewing Audit Logs

1. Go to **Audit Logs** from the sidebar
2. Each entry shows:
   - Timestamp
   - Admin user
   - Action performed
   - Target (user/family/subscription)
   - Before/after values
   - IP address

### Filtering Logs

Filter by:
- Date range
- Admin user
- Action type
- Target entity

### Exporting Logs

1. Set your filters
2. Click **"Export"**
3. Choose format: CSV or JSON
4. Download the file

**Note:** Exports for compliance may require Super Admin approval.

---

## Admin User Management

*Available to Super Admin only*

### Creating New Admins

1. Go to **Admin Users** from the sidebar
2. Click **"Add Admin"**
3. Enter:
   - Email address
   - First and last name
   - Temporary password
4. Select roles:
   - Can assign multiple roles
   - Permissions are additive
5. Click **"Create Admin"**

The new admin receives an email to set their password.

### Managing Admin Roles

1. Click on an admin user
2. Click **"Edit Roles"**
3. Add or remove roles
4. Click **"Save Changes"**

Role changes take effect immediately.

### Deactivating Admins

1. Click on an admin user
2. Click **"Deactivate"**
3. Confirm the action

The admin:
- Is immediately logged out
- Cannot log in again
- Their actions remain in audit logs

### Reactivating Admins

1. Find the deactivated admin
2. Click **"Reactivate"**
3. Reset their password if needed

---

## Best Practices

### Security

1. **Never share your admin credentials**
2. Use a strong, unique password
3. Log out when stepping away
4. Report suspicious admin activity immediately
5. Don't access the admin panel on public WiFi

### Customer Interactions

1. Always verify customer identity before making changes
2. Document all actions in ticket notes
3. Use canned responses for consistency
4. Escalate when unsure - don't guess
5. Follow the principle of least privilege

### Data Handling

1. Only access data needed for the current task
2. Don't export data without business justification
3. Never share customer data externally
4. Follow GDPR/privacy regulations
5. Report data breaches immediately

### Common Scenarios

**"I can't log into my account"**
1. Verify email address
2. Check if account is suspended
3. Send password reset
4. Check for email delivery issues

**"I was charged incorrectly"**
1. Pull payment history
2. Verify subscription status at charge time
3. Check for duplicate charges
4. Process refund if warranted

**"Someone is harassing my family"**
1. Escalate to Trust & Safety immediately
2. Collect evidence (screenshots, etc.)
3. Consider emergency suspension
4. Document thoroughly

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Search | `Ctrl/Cmd + K` |
| Dashboard | `G` then `D` |
| Users | `G` then `U` |
| Tickets | `G` then `T` |
| Subscriptions | `G` then `S` |
| Refresh | `R` |

---

## Getting Help

For admin platform issues:
- Slack: #admin-support
- Email: admin-help@safelink.internal
- Emergency: Contact on-call Super Admin

---

*Last Updated: March 2026*
*Version: 1.0.0*
*Internal Use Only - Do Not Distribute*
