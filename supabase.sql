-- À coller dans Supabase → SQL Editor → Run

create table if not exists public.matches (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  game   text not null check (char_length(game)   between 1 and 40),
  winner text not null check (char_length(winner) between 1 and 20),
  loser  text not null check (char_length(loser)  between 1 and 20)
);

alter table public.matches enable row level security;

create policy "lecture publique" on public.matches for select using (true);
create policy "ajout public"     on public.matches for insert with check (true);
-- Pas de policy update/delete : personne ne peut modifier ou effacer via l'appli.

create or replace view public.leaderboard as
  select winner as name, count(*)::int as wins
  from public.matches
  group by winner
  order by wins desc, name
  limit 50;

grant select on public.leaderboard to anon, authenticated;
