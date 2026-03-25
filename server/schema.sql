-- INITIAL DATABASE SCHEMA

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    reset_token TEXT,
    reset_token_expiry TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Files Table
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    filename TEXT,
    original_name TEXT NOT NULL,
    display_name TEXT,
    size BIGINT NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',
    checksum TEXT,
    expiry_date TIMESTAMP,
    password_hash TEXT,
    max_downloads INTEGER,
    download_count INTEGER DEFAULT 0,
    receiver_email TEXT,
    share_token UUID UNIQUE DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Vaults Table
CREATE TABLE IF NOT EXISTS vaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    password_hash TEXT,
    share_token UUID UNIQUE DEFAULT gen_random_uuid(),
    expiry_date TIMESTAMP,
    receiver_email TEXT,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Vault Files (Linking table)
CREATE TABLE IF NOT EXISTS vault_files (
    vault_id UUID REFERENCES vaults(id) ON DELETE CASCADE,
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    PRIMARY KEY (vault_id, file_id)
);

-- 5. Upload Sessions
CREATE TABLE IF NOT EXISTS upload_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    filename TEXT,
    original_name TEXT NOT NULL,
    size BIGINT NOT NULL,
    status TEXT DEFAULT 'pending',
    uploaded_chunks INTEGER DEFAULT 0,
    expiry_date TIMESTAMP,
    password_hash TEXT,
    max_downloads INTEGER,
    receiver_email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
