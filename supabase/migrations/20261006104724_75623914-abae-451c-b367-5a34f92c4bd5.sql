ALTER FUNCTION public.is_admin() SET SCHEMA private;
ALTER FUNCTION public.is_active_employee() SET SCHEMA private;
ALTER FUNCTION public.current_company_id() SET SCHEMA private;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.company_is_active(uuid) SET SCHEMA private;

CREATE OR REPLACE FUNCTION private.is_active_employee()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT private.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND active)
$$;

CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.is_admin() $$;
CREATE FUNCTION public.is_active_employee() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.is_active_employee() $$;
CREATE FUNCTION public.current_company_id() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.current_company_id() $$;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 SELECT CASE WHEN _user_id = auth.uid() OR current_user IN ('service_role', 'postgres', 'supabase_admin') THEN private.has_role(_user_id, _role) ELSE false END
$$;
CREATE FUNCTION public.company_is_active(_company_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 SELECT CASE WHEN _company_id = private.current_company_id() OR current_user IN ('service_role', 'postgres', 'supabase_admin') THEN private.company_is_active(_company_id) ELSE false END
$$;
REVOKE ALL ON FUNCTION public.is_admin(), public.is_active_employee(), public.current_company_id(), public.has_role(uuid, public.app_role), public.company_is_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(), public.is_active_employee(), public.current_company_id(), public.has_role(uuid, public.app_role), public.company_is_active(uuid) TO authenticated, service_role;
