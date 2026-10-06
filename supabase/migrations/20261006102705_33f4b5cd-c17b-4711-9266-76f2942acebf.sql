CREATE OR REPLACE FUNCTION public.can_submit_point_adjustment(_admin_id uuid, _work_date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles employee
    JOIN public.companies company ON company.id = employee.company_id AND company.active
    JOIN public.profiles responsible ON responsible.id = employee.manager_admin_id
      AND responsible.company_id = employee.company_id AND responsible.active
    JOIN public.user_roles responsible_role ON responsible_role.user_id = responsible.id AND responsible_role.role = 'admin'
    WHERE employee.id = auth.uid() AND employee.active
      AND responsible.id = _admin_id
      AND NOT EXISTS (
        SELECT 1 FROM public.monthly_closings closing
        WHERE closing.company_id = employee.company_id
          AND closing.year = EXTRACT(YEAR FROM _work_date)::smallint
          AND closing.month = EXTRACT(MONTH FROM _work_date)::smallint
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_submit_point_adjustment(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_submit_point_adjustment(uuid, date) TO authenticated, service_role;
DROP POLICY point_adjustment_requests_insert_employee ON public.point_adjustment_requests;
CREATE POLICY point_adjustment_requests_insert_employee ON public.point_adjustment_requests
FOR INSERT TO authenticated WITH CHECK (
  company_id = public.current_company_id()
  AND employee_id = auth.uid()
  AND status = 'pending'
  AND public.can_submit_point_adjustment(assigned_admin_id, work_date)
);
