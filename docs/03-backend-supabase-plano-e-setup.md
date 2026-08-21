# SST-BE — Backend Supabase: plano e setup

> **Status:** `[EM ANDAMENTO — SST-BE-1]`
> Fundação de backend/autenticação/sincronização, mantendo o app **offline-first**.

## Abordagem
Local-first: o app continua gravando tudo no **IndexedDB** e funcionando offline. O Supabase é a **fonte de convergência** quando há rede. Cada visita é um **documento `jsonb`** (uma linha na tabela `visitas`), espelhando o objeto do dispositivo.

## Sub-issues
| # | Entrega | Depende |
|---|---------|---------|
| **SST-BE-1** | Modelagem (tabelas `perfis`, `visitas`), autenticação (papéis técnico/admin) e **RLS**. Arquivo `supabase/schema.sql`. | Projeto Supabase criado |
| **SST-BE-2** | Cliente Supabase (vendorizado, p/ offline) + **tela de login** (técnico/admin) com sessão em cache. | URL + anon key |
| **SST-BE-3** | **Sincronização**: push/pull das visitas (fila + convergência por `atualizado_em`). | BE-2 |
| **SST-BE-4** | Mover **fotos/assinaturas** do jsonb para o **Storage** (bucket `evidencias`) e guardar só a referência. | BE-3 |

## Setup — o que você precisa fazer (SST-BE-1)
1. No [app.supabase.com](https://app.supabase.com): **New project** → nome (ex.: `check-list-tecnico`), defina a senha do banco (guarde), **Região** mais próxima (ex.: São Paulo). Plano **Free**.
2. Aguarde provisionar (~2 min).
3. **SQL Editor → New query** → cole o conteúdo de [`supabase/schema.sql`](../supabase/schema.sql) → **Run**. Deve concluir sem erros.
4. **Authentication → Providers → Email**: mantenha habilitado. (Para os testes, é prático desativar "Confirm email" em *Authentication → Providers → Email* para não exigir verificação — reavaliar antes de produção.)
5. Me envie, para a próxima etapa (BE-2):
   - **Project URL** (Settings → API → Project URL)
   - **anon public key** (Settings → API → Project API keys → `anon` `public`)

> 🔒 **Sobre a `anon key`:** ela é **pública por design** — é feita para ficar no código do cliente. Quem protege os dados é o **RLS** (as políticas deste schema). Não confundir com a `service_role` key, que é **secreta** e **nunca** vai para o app.

## Segurança / LGPD
- **RLS ativo**: cada técnico só acessa as próprias visitas; admin acessa todas (via tabela `perfis`).
- Papel padrão no cadastro: `tecnico`. Para promover a admin: `update public.perfis set papel='admin' where user_id='<uuid>';`.
- Dados sensíveis (assinaturas, fotos) migram para o Storage privado na BE-4.
- Confirmar retenção/expurgo e base legal antes de produção (ver `docs/02`).
