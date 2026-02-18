-- Migration: Provider payment details for receiving earnings
-- Adds bank account and UPI payment methods for providers

-- Provider bank accounts table
CREATE TABLE IF NOT EXISTS provider_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    account_holder_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    branch_name TEXT,
    account_type TEXT DEFAULT 'savings' CHECK (account_type IN ('savings', 'current')),
    is_primary BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider_id, account_number)
);

-- Provider UPI details table
CREATE TABLE IF NOT EXISTS provider_upi_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    upi_id TEXT NOT NULL,
    upi_provider TEXT, -- 'gpay', 'phonepe', 'paytm', 'bhim', 'other'
    is_primary BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider_id, upi_id)
);

-- Provider payout history
CREATE TABLE IF NOT EXISTS provider_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payout_method TEXT NOT NULL CHECK (payout_method IN ('bank_transfer', 'upi')),
    payment_account_id UUID, -- References either bank_account or upi_details
    transaction_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    failure_reason TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_provider_bank_accounts_provider_id ON provider_bank_accounts(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_upi_details_provider_id ON provider_upi_details(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_payouts_provider_id ON provider_payouts(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_payouts_status ON provider_payouts(status);

-- Update trigger for bank accounts
DROP TRIGGER IF EXISTS update_provider_bank_accounts_updated_at ON provider_bank_accounts;
CREATE TRIGGER update_provider_bank_accounts_updated_at
    BEFORE UPDATE ON provider_bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update trigger for UPI details
DROP TRIGGER IF EXISTS update_provider_upi_details_updated_at ON provider_upi_details;
CREATE TRIGGER update_provider_upi_details_updated_at
    BEFORE UPDATE ON provider_upi_details
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Also update the document types to include aadhaar_card as single document
ALTER TABLE provider_documents DROP CONSTRAINT IF EXISTS provider_documents_document_type_check;
ALTER TABLE provider_documents ADD CONSTRAINT provider_documents_document_type_check 
    CHECK (document_type IN (
        'aadhaar_card',
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
    ));
