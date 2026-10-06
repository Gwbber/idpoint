CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
ALTER FUNCTION public.can_submit_point_adjustment(uuid, date) SET SCHEMA private;
DROP POLICY point_adjustment_requests_insert_employee ON public.point_adjustment_requests;
CREATE POLICY point_adjustment_requests_insert_employee ON public.point_adjustment_requests
FOR INSERT TO authenticated WITH CHECK (
  company_id = public.current_company_id()
  AND employee_id = auth.uid()
  AND status = 'pending'
  AND private.can_submit_point_adjustment(assigned_admin_id, work_date)
);