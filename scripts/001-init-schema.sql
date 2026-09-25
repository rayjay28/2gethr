-- Safe Link Database Schema
-- Initial migration script

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE family_role AS ENUM ('PARENT', 'GUARDIAN', 'CHILD');
CREATE TYPE event_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE event_visibility AS ENUM ('FAMILY', 'PRIVATE', 'SELECTED_MEMBERS');
CREATE TYPE participant_status AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'TENTATIVE');
CREATE TYPE recurrence_frequency AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');
CREATE TYPE location_mode AS ENUM ('OFF', 'PAUSED', 'ACTIVE');
CREATE TYPE geofence_event_type AS ENUM ('ARRIVAL', 'DEPARTURE');
CREATE TYPE notification_type AS ENUM (
  'EVENT_REMINDER', 'EVENT_INVITATION', 'EVENT_UPDATE', 
  'EVENT_APPROVAL_REQUEST', 'EVENT_APPROVED', 'EVENT_REJECTED',
  'LOCATION_ALERT', 'GEOFENCE_ALERT', 'FAMILY_INVITATION',
  'SUBSCRIPTION_ALERT', 'SYSTEM'
);
CREATE TYPE subscription_tier AS ENUM ('FREE', 'PREMIUM', 'PREMIUM_PLUS');
CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'TRIALING');
CREATE TYPE payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE consent_type AS ENUM ('TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'LOCATION_TRACKING', 'PUSH_NOTIFICATIONS', 'MARKETING');
CREATE TYPE audit_action AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'PERMISSION_CHANGE', 'SUBSCRIPTION_CHANGE', 'LOCATION_ACCESS', 'EXPORT_DATA');

-- ============================================
-- USERS TABLE
-- ============================================

CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  email_verified TIMESTAMPTZ,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  profile_photo_url TEXT,
  profile_photo_path TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  date_of_birth TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);

-- ============================================
-- REFRESH TOKENS TABLE
-- ============================================

CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ============================================
-- FAMILIES TABLE
-- ============================================

CREATE TABLE families (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  invite_code TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  invite_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_families_owner_id ON families(owner_id);
CREATE INDEX idx_families_invite_code ON families(invite_code);

-- ============================================
-- FAMILY MEMBERS TABLE
-- ============================================

CREATE TABLE family_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role family_role NOT NULL,
  nickname TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  can_create_events BOOLEAN DEFAULT true,
  requires_event_approval BOOLEAN DEFAULT false,
  can_override_conflicts BOOLEAN DEFAULT false,
  can_view_family_calendar BOOLEAN DEFAULT true,
  can_invite_members BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

CREATE INDEX idx_family_members_family_id ON family_members(family_id);
CREATE INDEX idx_family_members_user_id ON family_members(user_id);
CREATE INDEX idx_family_members_role ON family_members(role);

-- ============================================
-- CHILD PROFILES TABLE
-- ============================================

CREATE TABLE child_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  family_member_id TEXT UNIQUE NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  age INTEGER,
  grade TEXT,
  school TEXT,
  emergency_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CALENDARS TABLE
-- ============================================

CREATE TABLE calendars (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  is_default BOOLEAN DEFAULT false,
  is_shared BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendars_family_id ON calendars(family_id);

-- ============================================
-- RECURRENCE RULES TABLE
-- ============================================

CREATE TABLE recurrence_rules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  frequency recurrence_frequency NOT NULL,
  interval INTEGER DEFAULT 1,
  days_of_week INTEGER[],
  day_of_month INTEGER,
  month_of_year INTEGER,
  end_date TIMESTAMPTZ,
  occurrence_count INTEGER,
  exceptions TIMESTAMPTZ[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SAVED PLACES TABLE
-- ============================================

CREATE TABLE saved_places (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius INTEGER DEFAULT 100,
  geofence_enabled BOOLEAN DEFAULT false,
  alert_on_arrival BOOLEAN DEFAULT true,
  alert_on_departure BOOLEAN DEFAULT true,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_places_family_id ON saved_places(family_id);
CREATE INDEX idx_saved_places_location ON saved_places(latitude, longitude);

-- ============================================
-- EVENTS TABLE
-- ============================================

CREATE TABLE events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  calendar_id TEXT NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  created_by_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  saved_place_id TEXT REFERENCES saved_places(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  status event_status DEFAULT 'APPROVED',
  visibility event_visibility DEFAULT 'FAMILY',
  color TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule_id TEXT UNIQUE REFERENCES recurrence_rules(id),
  parent_event_id TEXT REFERENCES events(id),
  reminder_minutes INTEGER[] DEFAULT ARRAY[15, 60],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_calendar_id ON events(calendar_id);
CREATE INDEX idx_events_created_by_id ON events(created_by_id);
CREATE INDEX idx_events_time_range ON events(start_time, end_time);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_parent_event_id ON events(parent_event_id);

-- ============================================
-- EVENT PARTICIPANTS TABLE
-- ============================================

CREATE TABLE event_participants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status participant_status DEFAULT 'INVITED',
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX idx_event_participants_user_id ON event_participants(user_id);

-- ============================================
-- EVENT REQUESTS TABLE
-- ============================================

CREATE TABLE event_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  requestor_id TEXT NOT NULL REFERENCES users(id),
  approver_id TEXT REFERENCES users(id),
  status event_status DEFAULT 'PENDING',
  request_notes TEXT,
  response_notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX idx_event_requests_event_id ON event_requests(event_id);
CREATE INDEX idx_event_requests_requestor_id ON event_requests(requestor_id);
CREATE INDEX idx_event_requests_status ON event_requests(status);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- ============================================
-- REMINDER SETTINGS TABLE
-- ============================================

CREATE TABLE reminder_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  default_reminder_minutes INTEGER[] DEFAULT ARRAY[15, 60],
  push_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TEXT,
  quiet_hours_end TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LOCATION SETTINGS TABLE
-- ============================================

CREATE TABLE location_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  family_member_id TEXT UNIQUE NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  mode location_mode DEFAULT 'OFF',
  share_with_family BOOLEAN DEFAULT false,
  update_interval_sec INTEGER DEFAULT 300,
  last_mode_change TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LOCATION PINGS TABLE
-- ============================================

CREATE TABLE location_pings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  battery_level INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_location_pings_user_id ON location_pings(user_id);
CREATE INDEX idx_location_pings_timestamp ON location_pings(timestamp);
CREATE INDEX idx_location_pings_user_timestamp ON location_pings(user_id, timestamp);

-- ============================================
-- GEOFENCE EVENTS TABLE
-- ============================================

CREATE TABLE geofence_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  saved_place_id TEXT NOT NULL REFERENCES saved_places(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  event_type geofence_event_type NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_geofence_events_saved_place_id ON geofence_events(saved_place_id);
CREATE INDEX idx_geofence_events_user_id ON geofence_events(user_id);
CREATE INDEX idx_geofence_events_timestamp ON geofence_events(timestamp);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  family_id TEXT UNIQUE NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  tier subscription_tier DEFAULT 'FREE',
  status subscription_status DEFAULT 'ACTIVE',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ============================================
-- PAYMENT TRANSACTIONS TABLE
-- ============================================

CREATE TABLE payment_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_payment_id TEXT UNIQUE,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status payment_status NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_transactions_subscription_id ON payment_transactions(subscription_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);

-- ============================================
-- CONSENTS TABLE
-- ============================================

CREATE TABLE consents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type consent_type NOT NULL,
  granted BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  version TEXT DEFAULT '1.0'
);

CREATE INDEX idx_consents_user_id ON consents(user_id);
CREATE INDEX idx_consents_type ON consents(type);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON families FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_family_members_updated_at BEFORE UPDATE ON family_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_child_profiles_updated_at BEFORE UPDATE ON child_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendars_updated_at BEFORE UPDATE ON calendars FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_event_participants_updated_at BEFORE UPDATE ON event_participants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recurrence_rules_updated_at BEFORE UPDATE ON recurrence_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_saved_places_updated_at BEFORE UPDATE ON saved_places FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_location_settings_updated_at BEFORE UPDATE ON location_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reminder_settings_updated_at BEFORE UPDATE ON reminder_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
