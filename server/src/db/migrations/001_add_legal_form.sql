-- Add legalForm, ogrnip, downloadPath to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS legal_form varchar(50) DEFAULT 'ООО';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ogrnip varchar(15);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS download_path varchar(1000) DEFAULT '';
