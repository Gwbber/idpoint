CREATE OR REPLACE FUNCTION public.is_active_employee()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND active)
$$;
REVOKE EXECUTE ON FUNCTION public.is_active_employee() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_employee() TO authenticated, service_role;

DROP POLICY IF EXISTS closings_select ON public.monthly_closings;
CREATE POLICY closings_select ON public.monthly_closings FOR SELECT TO authenticated USING (public.is_active_employee());
DROP POLICY IF EXISTS holidays_select ON public.holidays;
CREATE POLICY holidays_select ON public.holidays FOR SELECT TO authenticated USING (public.is_active_employee());
DROP POLICY IF EXISTS settings_select ON public.app_settings;
CREATE POLICY settings_select ON public.app_settings FOR SELECT TO authenticated USING (public.is_active_employee());