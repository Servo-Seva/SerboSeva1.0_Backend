-- Migration: Enhanced provider registration with KYC documents
-- Adds support for individual/company registration with government ID verification

-- Add new columns to providers table for enhanced registration
ALTER TABLE providers ADD COLUMN IF NOT EXISTS provider_type TEXT DEFAULT 'individual' CHECK (provider_type IN ('individual', 'company'));
ALTER TABLE providers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS pincode TEXT;

-- Individual-specific fields
ALTER TABLE providers ADD COLUMN IF NOT EXISTS aadhaar_number TEXT; -- Encrypted/masked
ALTER TABLE providers ADD COLUMN IF NOT EXISTS aadhaar_verified BOOLEAN DEFAULT false;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS aadhaar_verification_date TIMESTAMPTZ;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS digilocker_request_id TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS pan_number TEXT;

-- Company-specific fields
ALTER TABLE providers ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS cin_number TEXT; -- Company Identification Number
ALTER TABLE providers ADD COLUMN IF NOT EXISTS company_type TEXT CHECK (company_type IN ('proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited', NULL));

-- Common fields
ALTER TABLE providers ADD COLUMN IF NOT EXISTS specializations TEXT[]; -- Array of service specializations
ALTER TABLE providers ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'submitted', 'verified', 'rejected'));
ALTER TABLE providers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE providers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Provider documents table for storing uploaded documents
CREATE TABLE IF NOT EXISTS provider_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN (
        'aadhaar_front', 
        'aadhaar_back', 
        'pan_card', 
        'photo', 
        'address_proof',
        'gst_certificate',
        'company_registration',
        'partnership_deed',
        'board_resolution',
        'authorized_signatory_id',
        'other'
    )),
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DigiLocker verification logs
CREATE TABLE IF NOT EXISTS digilocker_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    document_type TEXT NOT NULL, -- 'aadhaar', 'pan', 'driving_license', etc.
    status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated', 'pending', 'success', 'failed', 'expired')),
    response_data JSONB,
    verified_name TEXT,
    verified_dob TEXT,
    verified_address TEXT,
    error_message TEXT,
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Provider activity log for admin tracking
CREATE TABLE IF NOT EXISTS provider_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'registered', 'document_uploaded', 'kyc_verified', 'approved', 'rejected', 'status_changed'
    performed_by UUID REFERENCES users(id), -- NULL for system actions
    old_value JSONB,
    new_value JSONB,
    notes TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_provider_documents_provider_id ON provider_documents(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_documents_type ON provider_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_digilocker_verifications_provider_id ON digilocker_verifications(provider_id);
CREATE INDEX IF NOT EXISTS idx_digilocker_verifications_request_id ON digilocker_verifications(request_id);
CREATE INDEX IF NOT EXISTS idx_provider_activity_log_provider_id ON provider_activity_log(provider_id);
CREATE INDEX IF NOT EXISTS idx_providers_kyc_status ON providers(kyc_status);
CREATE INDEX IF NOT EXISTS idx_providers_provider_type ON providers(provider_type);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_providers_updated_at ON providers;
CREATE TRIGGER update_providers_updated_at
    BEFORE UPDATE ON providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_provider_documents_updated_at ON provider_documents;
CREATE TRIGGER update_provider_documents_updated_at
    BEFORE UPDATE ON provider_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
