# 06 — Deploy e operação

## 1. PWA (apps/web)

Build estático: `pnpm --filter @turism/web build` → `apps/web/dist`. Requisitos do host:

- **HTTPS** obrigatório (Service Worker, câmera, `storage.persist()`).
- **Fallback de SPA** para `index.html` em todas as rotas, exceto `/share-target` (POST tratado pelo SW) e arquivos estáticos.
- `sw.js` com `Cache-Control: no-cache` (atualizações detectadas); `assets/*` e `ocr/*` imutáveis.
- Variáveis de build opcionais: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Configurações prontas: `apps/web/vercel.json` (Vercel, com *Root Directory* = `apps/web`; o `vercel.json` da raiz cobre o caso de root vazio) e `netlify.toml` (Netlify). Os assets de OCR (≈ 18 MB) são gerados no `prebuild` e não vão para o Git.

## 2. Backend (Supabase)

```bash
supabase link --project-ref <ref>
supabase db push                                   # migrations 0001..0003
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # opcional: AI_MODEL_MAIN / AI_MODEL_FAST
supabase functions deploy parse-itinerary ocr-receipt suggest-pois fx-refresh
```

Auth: habilitar **Email (magic link)** e, quando desejado, **passkeys**. Storage: o bucket `assets` é criado pela migration com política por membro da viagem.

As funções `parse-itinerary`, `ocr-receipt` e `suggest-pois` exigem usuário autenticado (o app envia o JWT da sessão). `fx-refresh` exige a service role key ou `FX_REFRESH_TOKEN` no header `Authorization`.

Agendar câmbio (SQL Editor, com pg_cron e pg_net ativos):

```sql
select cron.schedule('fx-refresh', '0 */6 * * *', $$
  select net.http_post(url := 'https://<ref>.functions.supabase.co/fx-refresh', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.fx_refresh_token')), body := '{}'::jsonb)
$$);
```

## 3. Worker de IA (apps/ai-worker)

Necessário apenas para jobs longos (PDFs grandes, lotes). `docker build -f apps/ai-worker/Dockerfile -t turism-ai-worker .` e executar com as variáveis de `apps/ai-worker/.env.example` (`DATABASE_URL` com pooler em modo *session*). Healthcheck em `GET /health`.

## 4. Checklist de go-live

- [ ] Domínio com HTTPS e manifest servido em `/manifest.webmanifest`.
- [ ] Testar instalação na tela inicial (Android/Chrome e iOS/Safari) e abrir o app em modo avião.
- [ ] Testar compartilhamento de um PDF de outro app (Share Target) no dispositivo instalado.
- [ ] Rodar `pnpm test` e `pnpm --filter @turism/web test:e2e` no CI (workflow em `.github/workflows/ci.yml`).
- [ ] Definir política de retenção/backup do Storage e do Postgres (Supabase PITR).
- [ ] Revisar consentimento de envio de recibos/roteiros à IA na tela de configurações antes de ativar o backend.
