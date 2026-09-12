# 05 — Roadmap de entrega

## Estado atual (após a primeira implementação)

| Fase | Status | Evidência |
|---|---|---|
| 0 — Fundação | ✅ | Monorepo pnpm; PWA instalável com Workbox; Dexie; CI (`.github/workflows/ci.yml`) |
| 1 — Módulos 1 e 2 | ✅ | Tela do dia (mobile e desktop), timeline, documentos vinculados a dias, viewer "modo balcão", captura de foto/áudio, gesto de deslizar, fixar dia, modo estrada. E2E `viagem completa funciona offline` |
| 2 — Módulo 3 | ✅ | Gastos com taxa congelada, câmbio Frankfurter com cache, OCR em camadas (Claude visão via Edge Function; Tesseract.js local), CSV. E2E `OCR no dispositivo lê o total de um recibo` |
| 3 — Módulo 4 | ✅ código / ⏳ deploy | `_shared/ai.ts` (structured outputs, PDF nativo, web search, Wikimedia com licença), Edge Functions, worker pg-boss, parser local de texto como fallback. E2E `importa roteiro em texto`. Exige `ANTHROPIC_API_KEY` e projeto Supabase para a parte online |
| 4 — Diferenciais | parcial | **Feito**: Web Share Target com arquivos (SW `injectManifest`), divisão de despesas entre viajantes com acerto de contas mínimo, cartão de emergência offline, checklists (mala, fronteira, veículo, por dia) com modelos, validade de documentos com alertas, orçamento planejado × realizado, livro da viagem (impressão/PDF), backup ZIP, modo estrada, vinculação automática de fotos por data EXIF (com GPS), visualizador de rotas GPX/KML offline (traçado, distância, desnível, navegação), módulo veículo (litros, odômetro, km/L, custo/km), configuração de deploy (Vercel/Netlify/Docker). E2E `Web Share Target` e `viajantes`. **Pendentes**: ingestão por e-mail, rastreamento de voos/trens, mapa offline com tiles (PMTiles), geofencing, transcrição de áudio, colaboração em tempo real |

### Como ativar o backend

1. `supabase init` / `supabase link`; `supabase db push` aplica `supabase/migrations/0001_init.sql`.
2. `supabase secrets set ANTHROPIC_API_KEY=…` e `supabase functions deploy parse-itinerary ocr-receipt suggest-pois fx-refresh`.
3. No app: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (`apps/web/.env`). Login por magic link em Configurações.
4. (Opcional) `apps/ai-worker` para jobs longos: `.env` a partir de `.env.example`, `pnpm --filter @turism/ai-worker start`.
5. (Opcional) agendar `fx-refresh` a cada 6 h via pg_cron (comentário no final da migration).


## Fase 0 — Fundação (2 semanas)

- Monorepo (pnpm + Turborepo), design system, CI (lint, typecheck, testes, build do SW).
- Supabase: migrations do `02-modelo-de-dados.md`, RLS, buckets de Storage.
- PowerSync configurado com regras de sync por viagem.
- PWA instalável com app shell em cache e página "você está offline" funcional.

**Critério de aceite**: instalar o app, criar uma viagem, desligar a rede, reabrir o app e ver a viagem.

## Fase 1 — Módulos 1 e 2 (4 semanas)

- Linha do tempo de dias (criar, reordenar, datas relativas e absolutas, fuso).
- Atividades com ordenação fracionária e edição inline da dinâmica do dia.
- Upload de documentos, categorias, vínculo N:N com dias, Web Share Target.
- "Preparar para offline" com prioridade e progresso; visualizador interno (PDF.js, imagem, áudio); modo balcão.
- Tela do dia conforme `03-ux-tela-do-dia.md` (mobile e desktop).

**Critério de aceite**: em modo avião, abrir o app no dia corrente e exibir o voucher do hotel em menos de 3 s.

## Fase 2 — Módulo 3 (3 semanas)

- Lançamento de gastos com categorias, moeda, taxa congelada, resumo por dia e por viagem.
- Edge Function de câmbio com cache e sync das moedas da viagem.
- OCR online (Claude visão, structured output) e offline (Tesseract.js) com card de sugestão.
- Divisão de despesas entre membros e exportação CSV/XLSX.

**Critério de aceite**: fotografar um recibo em euro sem rede, confirmar o valor sugerido e ver o total em reais atualizado.

## Fase 3 — Módulo 4 (4 semanas)

- Worker de IA com fila; job `parse_itinerary` (PDF/TXT → dias e atividades) com tela de revisão.
- Job `find_images` (Wikimedia/Unsplash com atribuição) e `suggest_pois` (Places + Claude).
- Ingestão por e-mail (`forward-to-trip`).

**Critério de aceite**: enviar um PDF de roteiro de 7 dias e obter, em menos de 2 minutos, os dias nomeados, com imagem e 3 sugestões por dia para revisão.

## Fase 4 — Diferenciais (contínuo)

Priorização conforme `04-lacunas-e-novas-funcionalidades.md`: rastreamento de voos, mapa offline, geofencing, módulo veículo, livro da viagem, colaboração em tempo real.
