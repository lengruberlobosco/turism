# Turism — guia rápido do repositório

Monorepo pnpm. `pnpm install` na raiz; depois:

- `pnpm dev` — PWA em http://localhost:5173 (funciona sem backend; dados no IndexedDB).
- `pnpm test` — unit (domain, functions, ai-worker). `pnpm --filter @turism/web test:e2e` — Playwright (offline, importação, OCR). Sem download de browser: `PW_CHROMIUM_PATH=/caminho/chromium`.
- `pnpm typecheck` / `pnpm build`.

Estrutura: `packages/domain` (regras puras + Zod), `apps/web` (React PWA, Dexie, Workbox), `supabase/` (migrations, Edge Functions; `_shared/ai.ts` é a lógica de IA), `apps/ai-worker` (Node, pg-boss, reutiliza `_shared/ai.ts`), `docs/` (arquitetura, dados, UX, roadmap).

Regras: toda escrita local passa por `apps/web/src/db/repo.ts` (outbox de sync); IA só grava em `ai_suggestions` com `status=proposed`; gastos congelam `fx_rate`; nunca depender de rede para abrir um documento já baixado.
