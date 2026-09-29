REVOKE EXECUTE ON FUNCTION public.company_is_active(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_is_active(uuid) TO service_role;