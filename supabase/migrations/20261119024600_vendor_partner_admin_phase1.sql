-- Phase 1: vendor and external partner administration
CREATE TABLE IF NOT EXISTS vendor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  vendor_type text NOT NULL DEFAULT 'marketplace',
  description text,
  status text NOT NULL DEFAULT 'pending',
  commission_percent numeric(5,2) NOT NULL DEFAULT 10,
  payout_schedule text NOT NULL DEFAULT 'monthly',
  internal_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_status_check CHECK (status IN ('pending','active','suspended','rejected','archived')),
  CONSTRAINT vendor_commission_check CHECK (commission_percent >= 0 AND commission_percent <= 100)
);

CREATE TABLE IF NOT EXISTS external_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name text NOT NULL,
  partner_type text NOT NULL DEFAULT 'community',
  description text,
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  status text NOT NULL DEFAULT 'prospect',
  start_date date,
  end_date date,
  internal_owner_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  public_visibility boolean NOT NULL DEFAULT false,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_status_check CHECK (status IN ('prospect','review','active','suspended','completed'))
);

CREATE TABLE IF NOT EXISTS vendor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at date,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_document_status_check CHECK (status IN ('pending','approved','rejected','expired'))
);

CREATE TABLE IF NOT EXISTS external_partner_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES external_partners(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at date,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_document_status_check CHECK (status IN ('pending','approved','rejected','expired'))
);

CREATE TABLE IF NOT EXISTS admin_partner_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_profiles_status_idx ON vendor_profiles(status);
CREATE INDEX IF NOT EXISTS external_partners_status_idx ON external_partners(status);
CREATE INDEX IF NOT EXISTS partner_audit_entity_idx ON admin_partner_audit_logs(entity_type, entity_id, created_at DESC);

ALTER TABLE vendor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_partner_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_partner_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor profiles admin access" ON vendor_profiles;
CREATE POLICY "Vendor profiles admin access" ON vendor_profiles FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "External partners admin access" ON external_partners;
CREATE POLICY "External partners admin access" ON external_partners FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Vendor documents admin access" ON vendor_documents;
CREATE POLICY "Vendor documents admin access" ON vendor_documents FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "External partner documents admin access" ON external_partner_documents;
CREATE POLICY "External partner documents admin access" ON external_partner_documents FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Partner audit admin access" ON admin_partner_audit_logs;
CREATE POLICY "Partner audit admin access" ON admin_partner_audit_logs FOR SELECT USING (is_admin());
