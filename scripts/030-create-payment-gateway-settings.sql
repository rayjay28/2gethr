-- Payment Gateway Settings table for merchant processing integrations
CREATE TABLE IF NOT EXISTS payment_gateway_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL, -- 'amex', 'stripe', 'square', 'paypal', etc.
  display_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  is_test_mode BOOLEAN DEFAULT true,
  
  -- Encrypted credentials (store encrypted in production)
  merchant_id VARCHAR(255),
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  
  -- Provider-specific settings
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- Supported features
  supports_refunds BOOLEAN DEFAULT true,
  supports_partial_refunds BOOLEAN DEFAULT true,
  supports_recurring BOOLEAN DEFAULT false,
  
  -- Webhook configuration
  webhook_url VARCHAR(500),
  webhook_secret_encrypted TEXT,
  
  -- Audit fields
  configured_by_admin_id uuid REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_tested_at TIMESTAMPTZ,
  last_test_result VARCHAR(50),
  last_test_message TEXT
);

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_payment_gateway_provider ON payment_gateway_settings(provider);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_active ON payment_gateway_settings(is_active);

-- Insert default AMEX gateway configuration (inactive by default)
INSERT INTO payment_gateway_settings (provider, display_name, is_active, is_test_mode, settings)
VALUES (
  'amex',
  'American Express',
  false,
  true,
  '{
    "currency": "USD",
    "supported_card_types": ["amex"],
    "api_version": "v1",
    "endpoint_url": "https://api.americanexpress.com"
  }'::jsonb
) ON CONFLICT DO NOTHING;
