# 05 — Roadmap de entrega

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
