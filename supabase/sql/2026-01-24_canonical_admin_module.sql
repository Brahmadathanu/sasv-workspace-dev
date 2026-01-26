-- 2026-01-24: Canonical Admin Module Security & Audit
-- Lock down RPC grants and add audit table for admin actions

-- Step 1: Secure RPC grants (remove anon/public access)
REVOKE EXECUTE ON FUNCTION public.get_user_permissions(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_permissions(text) FROM anon;

-- Grant to intended roles only
GRANT EXECUTE ON FUNCTION public.get_user_permissions(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(text) TO service_role;

-- Secure other admin RPCs if they exist
DO $$
BEGIN
    -- set_user_access_by_email_key
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_user_access_by_email_key') THEN
        REVOKE EXECUTE ON FUNCTION public.set_user_access_by_email_key FROM PUBLIC;
        REVOKE EXECUTE ON FUNCTION public.set_user_access_by_email_key FROM anon;
        GRANT EXECUTE ON FUNCTION public.set_user_access_by_email_key TO authenticated;
        GRANT EXECUTE ON FUNCTION public.set_user_access_by_email_key TO service_role;
    END IF;
    
    -- revoke_user_access
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'revoke_user_access') THEN
        REVOKE EXECUTE ON FUNCTION public.revoke_user_access FROM PUBLIC;
        REVOKE EXECUTE ON FUNCTION public.revoke_user_access FROM anon;
        GRANT EXECUTE ON FUNCTION public.revoke_user_access TO authenticated;
        GRANT EXECUTE ON FUNCTION public.revoke_user_access TO service_role;
    END IF;
    
    -- list_hub_access_by_email
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'list_hub_access_by_email') THEN
        REVOKE EXECUTE ON FUNCTION public.list_hub_access_by_email FROM PUBLIC;
        REVOKE EXECUTE ON FUNCTION public.list_hub_access_by_email FROM anon;
        GRANT EXECUTE ON FUNCTION public.list_hub_access_by_email TO authenticated;
        GRANT EXECUTE ON FUNCTION public.list_hub_access_by_email TO service_role;
    END IF;
END $$;

-- Step 2: Create admin audit table
CREATE TABLE IF NOT EXISTS public.admin_audit (
    id BIGSERIAL PRIMARY KEY,
    action_type TEXT NOT NULL,
    admin_user_id UUID REFERENCES auth.users(id),
    target_user_id UUID,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on audit table
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;

-- Policy: only admins can read audit logs
CREATE POLICY "admin_audit_read" ON public.admin_audit FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_permissions_canonical upc
        WHERE upc.user_id::text = auth.uid()::text
        AND upc.target = 'module:admin-v2'
        AND upc.can_view = true
    )
);

-- Step 3: Create audit logging function
CREATE OR REPLACE FUNCTION public.log_admin_action(
    admin_id TEXT,
    action_type TEXT,
    target_id TEXT DEFAULT NULL,
    action_details TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO public.admin_audit (
        action_type, admin_user_id, target_user_id, details
    ) VALUES (
        action_type, admin_id::uuid, target_id::uuid, action_details
    ) RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$;

-- Set function owner and grants
ALTER FUNCTION public.log_admin_action OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.log_admin_action TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action TO service_role;

-- Step 4: Create RPC to get admin audit logs
CREATE OR REPLACE FUNCTION public.get_admin_audit_logs(
    limit_count INTEGER DEFAULT 100
)
RETURNS TABLE (
    id BIGINT,
    action_type TEXT,
    admin_user_id UUID,
    target_user_id UUID,
    details TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user has admin-v2 module access
    IF NOT EXISTS (
        SELECT 1 FROM public.user_permissions_canonical upc
        WHERE upc.user_id::text = auth.uid()::text
        AND upc.target = 'module:admin-v2'
        AND upc.can_view = true
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    RETURN QUERY
    SELECT 
        a.id,
        a.action_type,
        a.admin_user_id,
        a.target_user_id,
        a.details,
        a.created_at
    FROM public.admin_audit a
    ORDER BY a.created_at DESC
    LIMIT limit_count;
END;
$$;

-- Set function owner and grants
ALTER FUNCTION public.get_admin_audit_logs OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_logs TO service_role;

-- Step 5: Grant exclusive admin access to your user
-- Replace with your actual user ID: dff17104-c02a-4bca-95b1-e8ddff46a9b6
INSERT INTO public.user_permissions_canonical (user_id, target, can_view, can_edit, meta)
VALUES (
    'dff17104-c02a-4bca-95b1-e8ddff46a9b6',
    'module:admin-v2',
    true,
    true,
    '{"level":"use","source":"migration","exclusive":true}'::jsonb
) ON CONFLICT (user_id, target) DO UPDATE SET
    can_view = EXCLUDED.can_view,
    can_edit = EXCLUDED.can_edit,
    meta = EXCLUDED.meta,
    updated_at = NOW();