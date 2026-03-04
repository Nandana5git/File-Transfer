-- Database Schema Update
ALTER TABLE files ADD COLUMN IF NOT EXISTS checksum TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS uploaded_chunks INTEGER DEFAULT 0;
