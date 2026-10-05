DROP POLICY profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR (public.is_admin() AND company_id = public.current_company_id()));

DROP FUNCTION public.get_my_responsible_admin();