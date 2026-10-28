-- Stage 1, SleeveShelves V61.2: transaction-safe collection assignments.
-- Apply in Supabase SQL editor in staging first. This function uses the caller's
-- RLS rights (SECURITY INVOKER); NEVER switch to SECURITY DEFINER casually.
create or replace function public.ss_set_record_collections(
  p_record_id text,
  p_collection_ids text[] default '{}'::text[]
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in required' using errcode='42501';
  end if;
  -- Row lock serializes concurrent edits for this record.
  select r.user_id into v_owner
  from public.records r
  where r.id::text=p_record_id
  for update;
  if not found or v_owner <> auth.uid() then
    raise exception 'Record not available' using errcode='42501';
  end if;
  -- Fail before changing anything if any requested collection is not owned.
  select count(*) into v_count
  from (select distinct unnest(coalesce(p_collection_ids, '{}'::text[])) as id) ids
  where not exists(
    select 1 from public.collections c
    where c.id::text=ids.id and c.user_id=auth.uid()
  );
  if v_count>0 then
    raise exception 'One or more collection labels are invalid' using errcode='23503';
  end if;
  insert into public.record_collections (user_id,record_id,collection_id)
  select auth.uid(), r.id, c.id
  from public.records r
  join public.collections c on c.user_id=auth.uid()
  where r.id::text=p_record_id
    and c.id::text = any(coalesce(p_collection_ids,'{}'::text[]))
    and not exists (
      select 1 from public.record_collections rc
      where rc.user_id=auth.uid() and rc.record_id=r.id and rc.collection_id=c.id
    );
  delete from public.record_collections rc
  where rc.user_id=auth.uid() and rc.record_id::text=p_record_id
    and not (rc.collection_id::text = any(coalesce(p_collection_ids,'{}'::text[])));
end;
$$;
revoke all on function public.ss_set_record_collections(text,text[]) from public;
grant execute on function public.ss_set_record_collections(text,text[]) to authenticated;
notify pgrst,'reload schema';
-- Precondition: relevant records, collections and record_collections RLS policies
-- must permit authenticated users to read and edit ONLY their own rows.
-- Validate on a staging project with two different logged-in test users.
