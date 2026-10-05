DROP POLICY profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR (public.is_admin() AND company_id = public.current_company_id())
  OR id = (SELECT employee.manager_admin_id FROM public.profiles employee WHERE employee.id = auth.uid())
);

ALTER FUNCTION public.get_my_responsible_admin() SECURITY INVOKER;
ALTER FUNCTION public.complete_point_adjustment(uuid, timestamptz, timestamptz, timestamptz, timestamptz, text) SECURITY INVOKER;
ALTER FUNCTION public.reject_point_adjustment(uuid, text) SECURITY INVOKER;