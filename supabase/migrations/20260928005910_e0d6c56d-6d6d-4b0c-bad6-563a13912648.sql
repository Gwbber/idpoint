
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- empresa padrão para os dados existentes
INSERT INTO public.companies (id, name)
SELECT '00000000-0000-0000-0000-000000000001',
  COALESCE((SELECT value->>'name' FROM public.app_settings WHERE key='company'), 'Minha Empresa');

ALTER TABLE public.profiles ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
UPDATE public.profiles SET company_id='00000000-0000-0000-0000-000000000001';
ALTER TABLE public.profiles ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX ON public.profiles(company_id);

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.current_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated, service_role;

ALTER TABLE public.profiles ALTER COLUMN company_id SET DEFAULT public.current_company_id();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['work_schedules','time_records','holidays','monthly_closings','time_adjustments','audit_logs','app_settings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE public.%I SET company_id = %L', t, '00000000-0000-0000-0000-000000000001');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET DEFAULT public.current_company_id()', t);
    EXECUTE format('CREATE INDEX ON public.%I(company_id)', t);
  END LOOP;
END $$;

-- unicidades por empresa
ALTER TABLE public.monthly_closings DROP CONSTRAINT monthly_closings_year_month_key;
ALTER TABLE public.monthly_closings ADD CONSTRAINT monthly_closings_company_year_month_key UNIQUE (company_id, year, month);
ALTER TABLE public.holidays DROP CONSTRAINT holidays_holiday_date_key;
ALTER TABLE public.holidays ADD CONSTRAINT holidays_company_date_key UNIQUE (company_id, holiday_date);
ALTER TABLE public.app_settings DROP CONSTRAINT app_settings_pkey;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (company_id, key);

-- helpers com escopo de empresa
CREATE OR REPLACE FUNCTION public.is_active_employee()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND active)
$$;

CREATE OR REPLACE FUNCTION public.block_closed_month()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d DATE; c uuid;
BEGIN
  d := COALESCE(NEW.work_date, OLD.work_date);
  c := COALESCE(NEW.company_id, OLD.company_id);
  IF public.is_admin() THEN RETURN COALESCE(NEW, OLD); END IF;
  IF EXISTS (
    SELECT 1 FROM public.monthly_closings
    WHERE company_id = c AND year = EXTRACT(YEAR FROM d)::SMALLINT AND month = EXTRACT(MONTH FROM d)::SMALLINT
  ) THEN
    RAISE EXCEPTION 'Mês fechado: registros não podem ser alterados.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

-- companies
CREATE POLICY companies_select_own ON public.companies FOR SELECT TO authenticated USING (id = public.current_company_id());
CREATE POLICY companies_update_admin ON public.companies FOR UPDATE TO authenticated
  USING (id = public.current_company_id() AND public.is_admin()) WITH CHECK (id = public.current_company_id() AND public.is_admin());

-- profiles
DROP POLICY profiles_delete_admin ON public.profiles;
DROP POLICY profiles_insert_admin ON public.profiles;
DROP POLICY profiles_select_own_or_admin ON public.profiles;
DROP POLICY profiles_update_admin ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (public.is_admin() AND company_id = public.current_company_id()));
CREATE POLICY profiles_insert_admin ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND company_id = public.current_company_id());
CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin() AND company_id = public.current_company_id())
  WITH CHECK (public.is_admin() AND company_id = public.current_company_id());
CREATE POLICY profiles_delete_admin ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin() AND company_id = public.current_company_id());

-- user_roles
DROP POLICY roles_select_own_or_admin ON public.user_roles;
CREATE POLICY roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (public.is_admin() AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = user_roles.user_id AND p.company_id = public.current_company_id())));

-- work_schedules
DROP POLICY schedules_select ON public.work_schedules;
DROP POLICY schedules_write_admin ON public.work_schedules;
CREATE POLICY schedules_select ON public.work_schedules FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND (user_id = auth.uid() OR public.is_admin()));
CREATE POLICY schedules_write_admin ON public.work_schedules FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_admin());

-- time_records
DROP POLICY records_delete_admin ON public.time_records;
DROP POLICY records_insert_own ON public.time_records;
DROP POLICY records_select ON public.time_records;
DROP POLICY records_update_own ON public.time_records;
CREATE POLICY records_select ON public.time_records FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND (user_id = auth.uid() OR public.is_admin()));
CREATE POLICY records_insert ON public.time_records FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND (user_id = auth.uid() OR public.is_admin()));
CREATE POLICY records_update ON public.time_records FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND (user_id = auth.uid() OR public.is_admin()))
  WITH CHECK (company_id = public.current_company_id() AND (user_id = auth.uid() OR public.is_admin()));
CREATE POLICY records_delete_admin ON public.time_records FOR DELETE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin());

-- holidays, closings, settings
DROP POLICY holidays_select ON public.holidays;
DROP POLICY holidays_write_admin ON public.holidays;
CREATE POLICY holidays_select ON public.holidays FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_active_employee());
CREATE POLICY holidays_write_admin ON public.holidays FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_admin());

DROP POLICY closings_select ON public.monthly_closings;
DROP POLICY closings_write_admin ON public.monthly_closings;
CREATE POLICY closings_select ON public.monthly_closings FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_active_employee());
CREATE POLICY closings_write_admin ON public.monthly_closings FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_admin());

DROP POLICY settings_select ON public.app_settings;
DROP POLICY settings_write_admin ON public.app_settings;
CREATE POLICY settings_select ON public.app_settings FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_active_employee());
CREATE POLICY settings_write_admin ON public.app_settings FOR ALL TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_admin());

-- adjustments, audit
DROP POLICY adjustments_insert_admin ON public.time_adjustments;
DROP POLICY adjustments_select ON public.time_adjustments;
CREATE POLICY adjustments_select ON public.time_adjustments FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND (employee_id = auth.uid() OR public.is_admin()));
CREATE POLICY adjustments_insert_admin ON public.time_adjustments FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.is_admin() AND admin_id = auth.uid());

DROP POLICY audit_insert_auth ON public.audit_logs;
DROP POLICY audit_select_admin ON public.audit_logs;
CREATE POLICY audit_insert_auth ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND company_id = public.current_company_id());
CREATE POLICY audit_select_admin ON public.audit_logs FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin());
