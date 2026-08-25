-- =========================================================
-- Check-list de Visita Técnica — Backend (Supabase / Postgres)
-- SST-BE-1: modelagem (documento jsonb), autenticação (perfis/papéis) e RLS.
-- Rode este script no SQL Editor do seu projeto Supabase.
-- Idempotente: pode ser executado novamente com segurança.
-- =========================================================

-- ============ PERFIS (papel do usuário) ============
create table if not exists public.perfis (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nome       text,
  papel      text not null default 'tecnico' check (papel in ('tecnico','admin')),
  criado_em  timestamptz not null default now()
);

alter table public.perfis enable row level security;

-- Usuário atual é admin?
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.perfis p
    where p.user_id = auth.uid() and p.papel = 'admin'
  );
$$;

drop policy if exists "perfil: ler proprio ou admin" on public.perfis;
create policy "perfil: ler proprio ou admin" on public.perfis
  for select using (user_id = auth.uid() or public.is_admin());

-- Painel Admin: o próprio usuário atualiza seu perfil; admin atualiza qualquer
-- perfil (gestão de papéis técnico/admin).
drop policy if exists "perfil: atualizar proprio" on public.perfis;
drop policy if exists "perfil: atualizar proprio ou admin" on public.perfis;
create policy "perfil: atualizar proprio ou admin" on public.perfis
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Cria o perfil automaticamente no cadastro de um novo usuário.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.perfis (user_id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ VISITAS (documento jsonb) ============
create table if not exists public.visitas (
  id            uuid primary key,                    -- id gerado no dispositivo
  tecnico_id    uuid not null default auth.uid()
                  references auth.users(id) on delete cascade,
  status        text not null default 'rascunho',
  data_visita   date,
  cliente_razao text,                                -- espelho p/ listagem/busca
  dados         jsonb not null,                      -- a visita completa (schema 1.7.0)
  atualizado_em timestamptz not null default now(),
  criado_em     timestamptz not null default now()
);

create index if not exists visitas_tecnico_idx    on public.visitas (tecnico_id);
create index if not exists visitas_atualizado_idx  on public.visitas (atualizado_em desc);

alter table public.visitas enable row level security;

-- Técnico gerencia as próprias; admin enxerga/gerencia todas.
drop policy if exists "visita: ler proprias ou admin" on public.visitas;
create policy "visita: ler proprias ou admin" on public.visitas
  for select using (tecnico_id = auth.uid() or public.is_admin());

drop policy if exists "visita: inserir propria" on public.visitas;
create policy "visita: inserir propria" on public.visitas
  for insert with check (tecnico_id = auth.uid());

-- Técnico atualiza as próprias; admin atualiza qualquer visita (Painel Admin).
drop policy if exists "visita: atualizar propria" on public.visitas;
drop policy if exists "visita: atualizar propria ou admin" on public.visitas;
create policy "visita: atualizar propria ou admin" on public.visitas
  for update using (tecnico_id = auth.uid() or public.is_admin())
  with check (tecnico_id = auth.uid() or public.is_admin());

drop policy if exists "visita: excluir propria ou admin" on public.visitas;
create policy "visita: excluir propria ou admin" on public.visitas
  for delete using (tecnico_id = auth.uid() or public.is_admin());

-- Mantém atualizado_em em cada UPDATE.
create or replace function public.touch_atualizado_em()
returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end;
$$;

drop trigger if exists visitas_touch on public.visitas;
create trigger visitas_touch before update on public.visitas
  for each row execute function public.touch_atualizado_em();

-- ============ STORAGE: bucket de evidências (fotos/assinaturas) ============
-- Usado a partir da SST-BE-4 (mover binários do jsonb para o storage).
insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict (id) do nothing;

drop policy if exists "evidencias: ler proprias ou admin" on storage.objects;
create policy "evidencias: ler proprias ou admin" on storage.objects
  for select using (bucket_id = 'evidencias' and (owner = auth.uid() or public.is_admin()));

drop policy if exists "evidencias: enviar proprias" on storage.objects;
create policy "evidencias: enviar proprias" on storage.objects
  for insert with check (bucket_id = 'evidencias' and owner = auth.uid());

drop policy if exists "evidencias: excluir proprias" on storage.objects;
create policy "evidencias: excluir proprias" on storage.objects
  for delete using (bucket_id = 'evidencias' and owner = auth.uid());

-- =========================================================
-- Para tornar um usuário ADMIN (após ele se cadastrar):
--   update public.perfis set papel = 'admin' where user_id = '<uuid-do-usuario>';
-- =========================================================
