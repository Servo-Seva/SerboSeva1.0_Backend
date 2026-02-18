-- Migration: Add 'resume' to provider_documents document_type check constraint

-- Drop the existing constraint (default name usually provider_documents_document_type_check)
ALTER TABLE provider_documents DROP CONSTRAINT IF EXISTS provider_documents_document_type_check;

-- Re-add the constraint with 'resume' included
ALTER TABLE provider_documents ADD CONSTRAINT provider_documents_document_type_check 
CHECK (document_type IN (
    'aadhaar_front', 
    'aadhaar_back', 
    'aadhaar_card',
    'pan_card', 
    'photo', 
    'address_proof',
    'gst_certificate',
    'company_registration',
    'partnership_deed',
    'board_resolution',
    'authorized_signatory_id',
    'resume',
    'other'
));
