-- E22-T07: byudjetni o'chirish ("xavfli zona", BR-014). Faqat owner; tasdiq —
-- byudjet nomini qayta yozish (tasodifiy bosishdan himoya). Ma'lumotlar
-- kaskadda o'chadi; chek fayllari — `purge-files` (byudjeti yo'q obyektlar,
-- `receipt_files_to_delete` 1-holat). A'zolarning `last_household_id` —
-- `on delete set null`.
create or replace function public.delete_household(p_household uuid, p_confirm_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  perform private.require_household_role(p_household, array['owner']::public.member_role[]);
  select h.name into v_name from public.households h where h.id = p_household;
  if lower(btrim(coalesce(p_confirm_name, ''))) <> lower(btrim(v_name)) then
    raise exception 'confirm_mismatch' using errcode = 'P0001';
  end if;
  delete from public.households h where h.id = p_household;
end;
$$;

grant execute on function public.delete_household(uuid, text) to authenticated;
