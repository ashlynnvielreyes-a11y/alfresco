-- =============================================
-- OTP (One-Time Password) Table for Email Verification
-- Al Fresco Cafe POS System
-- =============================================

-- Drop existing objects if they exist (for clean re-runs)
DROP TRIGGER IF EXISTS cleanup_expired_otps_trigger ON otp_codes;
DROP FUNCTION IF EXISTS cleanup_expired_otps();
DROP FUNCTION IF EXISTS generate_otp_code();
DROP FUNCTION IF EXISTS verify_otp(TEXT, TEXT);
DROP FUNCTION IF EXISTS create_otp(TEXT);
DROP TABLE IF EXISTS otp_codes;

-- =============================================
-- 1. Create OTP Codes Table
-- =============================================
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_otp ON otp_codes(email, otp_code);

-- =============================================
-- 2. Function to Generate Random 6-Digit OTP
-- =============================================
CREATE OR REPLACE FUNCTION generate_otp_code()
RETURNS VARCHAR(6)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$;

-- =============================================
-- 3. Function to Create OTP for Email
-- =============================================
CREATE OR REPLACE FUNCTION create_otp(p_email TEXT, p_ip_address TEXT DEFAULT NULL, p_user_agent TEXT DEFAULT NULL)
RETURNS TABLE(otp_code VARCHAR(6), expires_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_otp_code VARCHAR(6);
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_recent_count INTEGER;
BEGIN
    -- Check for rate limiting (max 5 OTPs per email per hour)
    SELECT COUNT(*) INTO v_recent_count
    FROM otp_codes
    WHERE otp_codes.email = LOWER(p_email)
    AND otp_codes.created_at > NOW() - INTERVAL '1 hour';
    
    IF v_recent_count >= 5 THEN
        RAISE EXCEPTION 'Too many OTP requests. Please try again later.';
    END IF;
    
    -- Invalidate any existing unused OTPs for this email
    UPDATE otp_codes
    SET is_used = TRUE
    WHERE otp_codes.email = LOWER(p_email)
    AND otp_codes.is_used = FALSE;
    
    -- Generate new OTP
    v_otp_code := generate_otp_code();
    v_expires_at := NOW() + INTERVAL '10 minutes';
    
    -- Insert new OTP
    INSERT INTO otp_codes (email, otp_code, expires_at, ip_address, user_agent)
    VALUES (LOWER(p_email), v_otp_code, v_expires_at, p_ip_address, p_user_agent);
    
    RETURN QUERY SELECT v_otp_code, v_expires_at;
END;
$$;

-- =============================================
-- 4. Function to Verify OTP
-- =============================================
CREATE OR REPLACE FUNCTION verify_otp(p_email TEXT, p_otp_code TEXT)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_otp_record RECORD;
BEGIN
    -- Find the OTP record
    SELECT * INTO v_otp_record
    FROM otp_codes
    WHERE otp_codes.email = LOWER(p_email)
    AND otp_codes.otp_code = p_otp_code
    AND otp_codes.is_used = FALSE
    ORDER BY otp_codes.created_at DESC
    LIMIT 1;
    
    -- Check if OTP exists
    IF v_otp_record IS NULL THEN
        -- Increment attempts on the latest OTP for this email
        UPDATE otp_codes
        SET attempts = attempts + 1
        WHERE id = (
            SELECT id FROM otp_codes
            WHERE otp_codes.email = LOWER(p_email)
            AND otp_codes.is_used = FALSE
            ORDER BY otp_codes.created_at DESC
            LIMIT 1
        );
        
        RETURN QUERY SELECT FALSE, 'Invalid OTP code'::TEXT;
        RETURN;
    END IF;
    
    -- Check if OTP is expired
    IF v_otp_record.expires_at < NOW() THEN
        UPDATE otp_codes SET is_used = TRUE WHERE id = v_otp_record.id;
        RETURN QUERY SELECT FALSE, 'OTP has expired. Please request a new one.'::TEXT;
        RETURN;
    END IF;
    
    -- Check if max attempts exceeded
    IF v_otp_record.attempts >= v_otp_record.max_attempts THEN
        UPDATE otp_codes SET is_used = TRUE WHERE id = v_otp_record.id;
        RETURN QUERY SELECT FALSE, 'Maximum attempts exceeded. Please request a new OTP.'::TEXT;
        RETURN;
    END IF;
    
    -- OTP is valid - mark as used
    UPDATE otp_codes
    SET is_used = TRUE, verified_at = NOW()
    WHERE id = v_otp_record.id;
    
    RETURN QUERY SELECT TRUE, 'OTP verified successfully'::TEXT;
END;
$$;

-- =============================================
-- 5. Function to Cleanup Expired OTPs (Auto-cleanup)
-- =============================================
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Delete OTPs older than 24 hours
    DELETE FROM otp_codes
    WHERE created_at < NOW() - INTERVAL '24 hours';
    
    RETURN NEW;
END;
$$;

-- Create trigger to auto-cleanup on new OTP insert
CREATE TRIGGER cleanup_expired_otps_trigger
    AFTER INSERT ON otp_codes
    EXECUTE FUNCTION cleanup_expired_otps();

-- =============================================
-- 6. Row Level Security (RLS)
-- =============================================
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow service role full access to otp_codes" ON otp_codes;
DROP POLICY IF EXISTS "Deny public access to otp_codes" ON otp_codes;

-- Only allow service role to access OTP codes (for security)
CREATE POLICY "Allow service role full access to otp_codes"
    ON otp_codes
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- 7. Grant Permissions
-- =============================================
-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION generate_otp_code() TO authenticated;
GRANT EXECUTE ON FUNCTION create_otp(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION create_otp(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_otp(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_otp(TEXT, TEXT) TO authenticated;

-- =============================================
-- USAGE EXAMPLES:
-- =============================================
-- 
-- To create an OTP:
-- SELECT * FROM create_otp('user@example.com', '192.168.1.1', 'Mozilla/5.0...');
-- 
-- To verify an OTP:
-- SELECT * FROM verify_otp('user@example.com', '123456');
--
-- =============================================
