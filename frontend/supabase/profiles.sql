create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  magical_creatures bigint not null default 0,
  inventory text[] not null default array['basic_spirit']::text[]
);

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own on public.profiles
      for select using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_own'
  ) then
    create policy profiles_insert_own on public.profiles
      for insert with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own on public.profiles
      for update using (auth.uid() = id);
  end if;
end $$;

create or replace function public.purchase_with_creatures(item_id_param text)
returns table (id uuid, magical_creatures bigint, inventory text[])
language plpgsql
security invoker
as $$
declare
  item_cost bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if item_id_param = 'spirit_companion_owl' then
    item_cost := 1000;
  else
    raise exception 'Unknown item id: %', item_id_param;
  end if;

  update public.profiles p
  set
    magical_creatures = p.magical_creatures - item_cost,
    inventory = case
      when item_id_param = any(p.inventory) then p.inventory
      else array_append(p.inventory, item_id_param)
    end
  where p.id = auth.uid()
    and p.magical_creatures >= item_cost
  returning p.id, p.magical_creatures, p.inventory
  into id, magical_creatures, inventory;

  if id is null then
    raise exception 'Not enough magical creatures';
  end if;

  return query select id, magical_creatures, inventory;
end;
$$;
