-- =========================================================
-- Migração — Painel Administrativo
-- Rode este script no SQL Editor do Supabase (idempotente).
-- Ele permite que usuários com papel 'admin':
--   (1) atualizem o papel de qualquer usuário (gestão de papéis);
--   (2) editem a visita de qualquer técnico.
-- A leitura de todas as visitas/perfis por admin já existia no schema base.
-- =========================================================

-- (1) perfis: próprio usuário OU admin podem atualizar.
drop policy if exists "perfil: atualizar proprio" on public.perfis;
drop policy if exists "perfil: atualizar proprio ou admin" on public.perfis;
create policy "perfil: atualizar proprio ou admin" on public.perfis
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- (2) visitas: dono OU admin podem atualizar.
drop policy if exists "visita: atualizar propria" on public.visitas;
drop policy if exists "visita: atualizar propria ou admin" on public.visitas;
create policy "visita: atualizar propria ou admin" on public.visitas
  for update using (tecnico_id = auth.uid() or public.is_admin())
  with check (tecnico_id = auth.uid() or public.is_admin());

-- =========================================================
-- Para tornar o PRIMEIRO admin (necessário para o painel aparecer),
-- rode uma vez com o UUID do seu usuário (Authentication → Users):
--   update public.perfis set papel = 'admin' where user_id = '<uuid-do-usuario>';
-- =========================================================
