-- Add metadata columns to files
ALTER TABLE files ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP;
ALTER TABLE files ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS max_downloads INTEGER;
ALTER TABLE files ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;
ALTER TABLE files ADD COLUMN IF NOT EXISTS receiver_email TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS share_token UUID UNIQUE DEFAULT gen_random_uuid();

-- Add metadata columns to upload_sessions (to preserve during upload)
ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP;
ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS max_downloads INTEGER;
ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS receiver_email TEXT;
