-- Safe Link Admin Platform Schema
-- Separate admin authentication and management system

-- ===========================================
-- ADMIN USER MANAGEMENT
-- ===========================================

-- Admin users table (separate from consumer users)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_MFA')),
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_secret VARCHAR(255),
  mfa_backup_codes TEXT[], -- Array of hashed backup codes
  last_login_at TIMESTAMPTZ,
  last_login_ip VARCHAR(45),
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin roles table
CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT false, -- Cannot be deleted if true
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permission scopes
CREATE TABLE IF NOT EXISTS admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'users.read', 'subscriptions.update'
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- e.g., 'users', 'families', 'subscriptions'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role to permission mapping
CREATE TABLE IF NOT EXISTS admin_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- Admin user to role mapping (supports multiple roles per admin)
CREATE TABLE IF NOT EXISTS admin_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES admin_users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(admin_user_id, role_id)
);

-- Admin sessions table (for tracking and revocation)
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL, -- Hash of refresh token
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_reason VARCHAR(100)
);

-- ===========================================
-- ADMIN ACTION LOGGING (IMMUTABLE AUDIT TRAIL)
-- ===========================================

CREATE TABLE IF NOT EXISTS admin_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50), -- 'user', 'family', 'subscription', 'ticket', etc.
  target_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  ticket_id UUID, -- Link to support ticket if action was part of a case
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- SUPPORT TICKET SYSTEM
-- ===========================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(20) UNIQUE NOT NULL, -- e.g., 'TKT-2024-001234'
  family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'BILLING', 'TECHNICAL', 'ACCOUNT', 'SUBSCRIPTION', 
    'LOCATION', 'PRIVACY', 'ABUSE_REPORT', 'FEATURE_REQUEST', 'OTHER'
  )),
  priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN (
    'OPEN', 'IN_PROGRESS', 'WAITING_USER', 'WAITING_INTERNAL', 
    'ESCALATED', 'RESOLVED', 'CLOSED'
  )),
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  escalated_to_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support ticket messages (conversation thread)
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('USER', 'ADMIN', 'SYSTEM')),
  sender_id UUID, -- user_id or admin_user_id based on sender_type
  message TEXT NOT NULL,
  is_internal_note BOOLEAN DEFAULT false, -- Internal notes not visible to user
  attachments JSONB DEFAULT '[]', -- Array of attachment URLs
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support ticket actions (tracks all changes to ticket)
CREATE TABLE IF NOT EXISTS support_ticket_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  admin_user_id UUID REFERENCES admin_users(id),
  action_type VARCHAR(50) NOT NULL, -- 'assigned', 'status_changed', 'priority_changed', etc.
  old_value VARCHAR(255),
  new_value VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- SUBSCRIPTION STATUS HISTORY
-- ===========================================

CREATE TABLE IF NOT EXISTS subscription_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  source VARCHAR(50) NOT NULL, -- 'GOOGLE_PLAY', 'ADMIN_MANUAL', 'SYSTEM', 'WEBHOOK'
  admin_user_id UUID REFERENCES admin_users(id), -- If changed by admin
  ticket_id UUID REFERENCES support_tickets(id), -- If linked to support case
  notes TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- TRUST & SAFETY / RISK FLAGS
-- ===========================================

CREATE TABLE IF NOT EXISTS risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  flag_type VARCHAR(50) NOT NULL CHECK (flag_type IN (
    'PAYMENT_MISMATCH', 'ABUSIVE_SIGNUP_PATTERN', 'LOCATION_ANOMALY',
    'SPAM_ACTIVITY', 'CHARGEBACK_RISK', 'SUSPICIOUS_LOGIN',
    'MULTIPLE_ACCOUNTS', 'TOS_VIOLATION', 'ABUSE_REPORT', 'PRIVACY_CONCERN'
  )),
  severity VARCHAR(20) DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED', 'ESCALATED')),
  description TEXT,
  evidence JSONB DEFAULT '{}', -- Supporting data
  reviewed_by_admin_id UUID REFERENCES admin_users(id),
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  ticket_id UUID REFERENCES support_tickets(id), -- Link to support ticket if created
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (family_id IS NOT NULL OR user_id IS NOT NULL)
);

-- ===========================================
-- INDEXES
-- ===========================================

-- Admin users
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(status);

-- Admin sessions
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user ON admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at) WHERE revoked_at IS NULL;

-- Admin action logs
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin ON admin_action_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_target ON admin_action_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_action ON admin_action_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created ON admin_action_logs(created_at DESC);

-- Support tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_number ON support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_family ON support_tickets(family_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at DESC);

-- Ticket messages
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON support_ticket_messages(ticket_id);

-- Subscription status history
CREATE INDEX IF NOT EXISTS idx_sub_status_history_sub ON subscription_status_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_status_history_changed ON subscription_status_history(changed_at DESC);

-- Risk flags
CREATE INDEX IF NOT EXISTS idx_risk_flags_family ON risk_flags(family_id);
CREATE INDEX IF NOT EXISTS idx_risk_flags_user ON risk_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_flags_type ON risk_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_risk_flags_status ON risk_flags(status);
CREATE INDEX IF NOT EXISTS idx_risk_flags_severity ON risk_flags(severity);

-- ===========================================
-- INSERT DEFAULT ROLES AND PERMISSIONS
-- ===========================================

-- Insert default admin roles
INSERT INTO admin_roles (name, description, is_system_role) VALUES
  ('SUPER_ADMIN', 'Full platform control. Reserved for technical leadership.', true),
  ('SUPPORT_ADMIN', 'Can view users, families, subscriptions, and manage support tickets.', true),
  ('BILLING_ADMIN', 'Can view and manage subscription/payment status, refunds, and renewals.', true),
  ('TRUST_SAFETY', 'Can review abuse reports, suspicious accounts, and privacy complaints.', true),
  ('ANALYST', 'Read-only access to dashboards and metrics.', true)
ON CONFLICT (name) DO NOTHING;

-- Insert permission scopes
INSERT INTO admin_permissions (key, name, description, category) VALUES
  -- Users
  ('users.read', 'View Users', 'View user accounts and profiles', 'users'),
  ('users.update', 'Update Users', 'Modify user account information', 'users'),
  ('users.suspend', 'Suspend Users', 'Suspend or unsuspend user accounts', 'users'),
  ('users.delete', 'Delete Users', 'Permanently delete user accounts', 'users'),
  
  -- Families
  ('families.read', 'View Families', 'View family information and members', 'families'),
  ('families.update', 'Update Families', 'Modify family settings and structure', 'families'),
  ('families.delete', 'Delete Families', 'Delete families after retention workflow', 'families'),
  
  -- Subscriptions
  ('subscriptions.read', 'View Subscriptions', 'View subscription status and history', 'subscriptions'),
  ('subscriptions.update', 'Update Subscriptions', 'Modify subscription status, grant trials', 'subscriptions'),
  ('subscriptions.refund', 'Process Refunds', 'Process subscription refunds', 'subscriptions'),
  
  -- Payments
  ('payments.read', 'View Payments', 'View payment transactions and history', 'payments'),
  ('payments.update', 'Update Payments', 'Modify payment records', 'payments'),
  
  -- Support
  ('support.read', 'View Tickets', 'View support tickets', 'support'),
  ('support.update', 'Manage Tickets', 'Update and respond to support tickets', 'support'),
  ('support.assign', 'Assign Tickets', 'Assign tickets to other admins', 'support'),
  
  -- Audit
  ('audit.read', 'View Audit Logs', 'View admin action audit logs', 'audit'),
  ('audit.export', 'Export Audit Logs', 'Export audit logs for compliance', 'audit'),
  
  -- Location
  ('location.read_limited', 'View Location Summary', 'View location sharing status and summaries', 'location'),
  ('location.read_full', 'View Full Location', 'View detailed location history (logged)', 'location'),
  
  -- Reports
  ('reports.read', 'View Reports', 'View analytics and reports', 'reports'),
  ('reports.export', 'Export Reports', 'Export report data', 'reports'),
  
  -- Trust & Safety
  ('trust.read', 'View Risk Flags', 'View abuse reports and risk flags', 'trust'),
  ('trust.update', 'Manage Risk Flags', 'Update risk flag status and resolution', 'trust'),
  ('trust.restrict', 'Restrict Accounts', 'Restrict account features for safety', 'trust'),
  
  -- Admin Management
  ('admin.read', 'View Admins', 'View admin user accounts', 'admin'),
  ('admin.create', 'Create Admins', 'Create new admin accounts', 'admin'),
  ('admin.update', 'Update Admins', 'Modify admin accounts and roles', 'admin'),
  ('admin.delete', 'Delete Admins', 'Remove admin accounts', 'admin')
ON CONFLICT (key) DO NOTHING;

-- Assign permissions to roles
-- SUPER_ADMIN gets all permissions
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM admin_roles r, admin_permissions p 
WHERE r.name = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- SUPPORT_ADMIN permissions
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM admin_roles r, admin_permissions p 
WHERE r.name = 'SUPPORT_ADMIN' 
  AND p.key IN (
    'users.read', 'users.update',
    'families.read', 'families.update',
    'subscriptions.read',
    'support.read', 'support.update', 'support.assign',
    'location.read_limited',
    'audit.read'
  )
ON CONFLICT DO NOTHING;

-- BILLING_ADMIN permissions
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM admin_roles r, admin_permissions p 
WHERE r.name = 'BILLING_ADMIN' 
  AND p.key IN (
    'users.read',
    'families.read',
    'subscriptions.read', 'subscriptions.update', 'subscriptions.refund',
    'payments.read', 'payments.update',
    'support.read', 'support.update',
    'audit.read'
  )
ON CONFLICT DO NOTHING;

-- TRUST_SAFETY permissions
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM admin_roles r, admin_permissions p 
WHERE r.name = 'TRUST_SAFETY' 
  AND p.key IN (
    'users.read', 'users.suspend',
    'families.read',
    'location.read_limited', 'location.read_full',
    'trust.read', 'trust.update', 'trust.restrict',
    'support.read', 'support.update',
    'audit.read'
  )
ON CONFLICT DO NOTHING;

-- ANALYST permissions (read-only)
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM admin_roles r, admin_permissions p 
WHERE r.name = 'ANALYST' 
  AND p.key IN (
    'users.read',
    'families.read',
    'subscriptions.read',
    'payments.read',
    'support.read',
    'reports.read',
    'audit.read'
  )
ON CONFLICT DO NOTHING;
