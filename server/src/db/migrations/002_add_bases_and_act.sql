-- Add bases (JSONB array) to counterparties
ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS bases jsonb DEFAULT '[]'::jsonb;

-- Migrate existing basis text to bases array
UPDATE counterparties SET bases = json_build_array(basis)::jsonb WHERE basis IS NOT NULL AND basis != '' AND (bases IS NULL OR bases = '[]'::jsonb);

-- Add bases (JSONB array) to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bases jsonb DEFAULT '[]'::jsonb;

-- Migrate existing basis text to bases array
UPDATE invoices SET bases = json_build_array(basis)::jsonb WHERE basis IS NOT NULL AND basis != '' AND (bases IS NULL OR bases = '[]'::jsonb);
