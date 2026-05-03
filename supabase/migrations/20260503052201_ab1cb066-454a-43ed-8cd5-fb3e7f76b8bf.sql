
create or replace function public.validate_support_impersonation(p_target_account_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_grant_id uuid;
begin
  if v_uid is null or p_target_account_id is null then
    return null;
  end if;

  -- Caller must be a Recouply admin
  select public.is_recouply_admin(v_uid) into v_is_admin;
  if not coalesce(v_is_admin, false) then
    return null;
  end if;

  -- Active grant must exist
  select id into v_grant_id
  from public.support_access_grants
  where account_id = p_target_account_id
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if v_grant_id is null then
    return null;
  end if;

  return p_target_account_id;
end;
$$;

grant execute on function public.validate_support_impersonation(uuid) to authenticated;
