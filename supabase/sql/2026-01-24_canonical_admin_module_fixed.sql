-- 2026-01-24: Canonical Admin Module - Fixed Version
-- Secure setup for admin access control and audit trail

-- Step 1: Create simplified admin audit table
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

-- Policy: only admin-v2 module users can read audit logs (create if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'admin_audit' AND policyname = 'admin_audit_read'
    ) THEN
        CREATE POLICY admin_audit_read ON public.admin_audit FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.user_permissions_canonical upc
                WHERE upc.user_id::text = auth.uid()::text
                AND upc.target = 'module:admin-v2'
                AND upc.can_view = true
            )
        );
    END IF;
END;
$$;

-- Step 2: Create audit logging function
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

-- Step 3: Create RPC to get admin audit logs
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

-- Step 4: Grant exclusive admin access to your user
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

-- Step 5: Log the admin module setup
INSERT INTO public.admin_audit (action_type, admin_user_id, details)
VALUES ('SETUP', 'dff17104-c02a-4bca-95b1-e8ddff46a9b6', 'Canonical admin module initialized with exclusive access');