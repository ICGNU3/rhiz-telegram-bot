-- Authorization fields for users table
-- Run this in your Supabase SQL Editor to add authorization support

-- Add authorization fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejected_by VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unsuspended_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unsuspended_by VARCHAR(255);

-- Drop existing policies that depend on subscription_tier first
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- Update subscription_tier to include admin
ALTER TABLE users ALTER COLUMN subscription_tier TYPE VARCHAR(50);

-- Add check constraint for status
ALTER TABLE users ADD CONSTRAINT check_user_status 
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));

-- Add check constraint for subscription tier
ALTER TABLE users ADD CONSTRAINT check_subscription_tier 
    CHECK (subscription_tier IN ('root_alpha', 'beta', 'premium', 'admin'));

-- Create index for status lookups
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);

-- Create function to get pending users
CREATE OR REPLACE FUNCTION get_pending_users()
RETURNS TABLE(
    id UUID,
    telegram_id BIGINT,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    requested_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.telegram_id, u.username, u.first_name, u.last_name, u.requested_at
    FROM users u
    WHERE u.status = 'pending'
    ORDER BY u.requested_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user stats by status
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS TABLE(
    total_users BIGINT,
    approved_users BIGINT,
    pending_users BIGINT,
    rejected_users BIGINT,
    suspended_users BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_users,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_users,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_users,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended_users
    FROM users;
END;
$$ LANGUAGE plpgsql;

-- Update RLS policies to include status check
DROP POLICY IF EXISTS "Users can view own data" ON users;
CREATE POLICY "Users can view own data" ON users 
    FOR ALL USING (
        telegram_id = (current_setting('app.current_user_telegram_id'))::bigint 
        AND status = 'approved'
    );

DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
CREATE POLICY "Users can view own contacts" ON contacts 
    FOR ALL USING (user_id IN (
        SELECT id FROM users 
        WHERE telegram_id = (current_setting('app.current_user_telegram_id'))::bigint
        AND status = 'approved'
    ));

-- Recreate admin policy for user management
CREATE POLICY "Admins can manage all users" ON users
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users admin_user 
            WHERE admin_user.telegram_id = (current_setting('app.current_user_telegram_id'))::bigint
            AND admin_user.subscription_tier = 'admin'
        )
    );

-- Set default status for existing users to approved (migration)
UPDATE users SET status = 'approved' WHERE status IS NULL;
UPDATE users SET approved_at = created_at WHERE status = 'approved' AND approved_at IS NULL;
UPDATE users SET approved_by = 'migration' WHERE status = 'approved' AND approved_by IS NULL;
