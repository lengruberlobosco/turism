# 03 — Fluxo de UX: tela principal de um dia de viagem

## 1. Princípio

A tela do dia é o **cockpit** da viagem. Ela existe para responder, em menos de três segundos e sem rede, três perguntas:

1. **O que eu faço agora?** (próxima atividade, para onde ir, quanto tempo de deslocamento)
2. **Qual documento eu preciso mostrar?** (voucher, passagem, ingresso, sem procurar)
3. **Quanto gastei hoje e no total?** (com um toque para registrar mais um gasto)

Tudo o mais (planejamento, revisão de IA, relatórios) fica a um nível de distância.

## 2. Modos da aplicação e como o dia é escolhido

| Modo | Quando | Comportamento da tela do dia |
|---|---|---|
| **Planejamento** | antes de `start_date` | Abre no Dia 1; cabeçalho mostra "Faltam N dias"; ações de edição em destaque; botão "Preparar para offline" |
| **Em viagem** | entre `start_date` e `end_date` | Abre automaticamente no **dia corrente** (data do dispositivo convertida ao fuso do dia); documentos do dia acesos; botão flutuante "+ Gasto" |
| **Pós-viagem** | após `end_date` | Abre no resumo financeiro e no diário; tela do dia vira leitura com fotos |

Regras de "dia corrente":

- Entre 00:00 e 04:00 no fuso do dia, a tela mostra um aviso "Ainda no Dia N?" com opção de continuar no dia anterior (chegadas noturnas).
- Se o dispositivo estiver em um fuso diferente do dia planejado (voo longo), o cabeçalho exibe os dois horários.
- O usuário pode **fixar** manualmente um dia como corrente (ícone de alfinete); a fixação expira à meia-noite local.

## 3. Wireframe — mobile (≤ 480 px)

```
┌──────────────────────────────────────────┐
│ ‹ Dia 3 ▾            12 mai · Florença   │  ← cabeçalho fixo: seletor de dia (sheet),
│ ● offline · 3 docs prontos · ☀ 24°       │    data, cidade, estado de rede/offline
├──────────────────────────────────────────┤
│  AGORA                                   │
│ ┌──────────────────────────────────────┐ │
│ │ 09:40  Trem Florença → Roma          │ │  ← card "Agora": próxima atividade,
│ │ Plataforma 6 · sai em 35 min         │ │    contagem regressiva, ação principal
│ │ [ Abrir bilhete ]  [ Rota ▸ ]        │ │    (documento crítico já em cache)
│ └──────────────────────────────────────┘ │
├──────────────────────────────────────────┤
│  DOCUMENTOS DO DIA               ver tudo│
│ ┃▣ Bilhete Trenitalia 09:40   ✔ offline │  ← lista "acesa": só assets ligados
│ ┃▣ Voucher Hotel Roma          ✔ offline │    a este dia; ✔ = disponível offline;
│ ┃⌖ Rota GPS Roma centro         (link)  │    barra lateral = crítico/prioridade
│ ┃🎧 Áudio: instruções do guia   ✔       │
├──────────────────────────────────────────┤
│  ROTEIRO                                 │
│  09:40 ─ Trem para Roma           1h35   │  ← timeline vertical; toque expande
│  11:30 ─ Check-in Hotel Roma             │    notas; arrastar reordena;
│  13:00 ─ Almoço Trastevere  (sugestão ✦) │    ✦ = sugestão de IA pendente
│  15:00 ─ Coliseu · ingresso 15:15        │
│  + atividade                             │
├──────────────────────────────────────────┤
│  DINÂMICA DO DIA                    ✎    │
│  "Sair do hotel às 8h50, táxi até…"      │  ← narrative editável inline
├──────────────────────────────────────────┤
│  GASTOS HOJE      € 86,40 · R$ 512,10    │
│  ⛽ 40,00 · 🍽 31,40 · 🎫 15,00           │  ← resumo por categoria; toque abre lista
├──────────────────────────────────────────┤
│  FOTOS E NOTAS (12)      [+📷] [+🎙]     │
└──────────────────────────────────────────┘
                                   ( + Gasto )   ← FAB persistente
```

Gestos: **deslizar horizontalmente** muda de dia; **puxar para baixo** força sync (mostra "sincronizado há 2 min"); **pressionar e segurar** um documento abre "vincular a outros dias".

## 4. Wireframe — desktop (≥ 1024 px)

```
┌────────────┬───────────────────────────────────────┬────────────────────────┐
│ VIAGEM     │  Dia 3 · 12 mai · Florença → Roma      │  DOCUMENTOS DO DIA     │
│ ● Dia 1    │  [Agora] Trem 09:40 · Plataforma 6     │  ▣ Bilhete Trenitalia  │
│ ● Dia 2    │                                        │  ▣ Voucher Hotel Roma  │
│ ▶ Dia 3    │  Roteiro (timeline editável)           │  ⌖ Rota GPS            │
│ ○ Dia 4    │  09:40  Trem → Roma                    │  🎧 Áudio do guia      │
│ ○ Dia 5    │  11:30  Check-in                       │  ─────────────────     │
│ …          │  13:00  Almoço ✦                       │  Outros da viagem (▾)  │
│            │  15:00  Coliseu                        │                        │
│ Resumo €   │                                        │  MAPA DO DIA           │
│ Docs (48)  │  Dinâmica do dia (editor)              │  [mapa com paradas]    │
│ IA ✦ (5)   │  Gastos do dia (tabela) + [+ Gasto]    │                        │
│ Offline ✔  │  Fotos e notas                         │  GASTOS: € 86 / R$ 512 │
└────────────┴───────────────────────────────────────┴────────────────────────┘
```

Três colunas: navegação por dias e módulos à esquerda, conteúdo do dia ao centro, painel contextual à direita (documentos acesos, mapa, totais). Arrastar um documento da coluna direita para outro dia na esquerda cria o vínculo.

## 5. Fluxos principais passo a passo

### 5.1 Abrir o app durante a viagem (offline)

1. SW serve o app shell do cache; sem tela branca.
2. Sessão local válida → abre direto em `/trips/:id/days/current`.
3. Tela calcula o dia corrente no SQLite local e renderiza em < 300 ms.
4. Faixa discreta "Você está offline · dados de 07:12" no cabeçalho; nada bloqueia.
5. Documentos com ✔ abrem em visualizador interno (PDF.js, imagem, áudio); links externos abrem o app de mapas do dispositivo.

### 5.2 Mostrar um documento no balcão

1. Card "Agora" já traz o botão do documento crítico da próxima atividade.
2. Toque → visualizador em tela cheia, brilho máximo, código de barras/QR ampliado, rotação travada.
3. Botão "Próximo documento" percorre os demais do dia sem voltar à lista.

### 5.3 Registrar gasto por foto (OCR)

1. FAB **+ Gasto** → escolha rápida: **Câmera**, **Galeria**, **Manual**.
2. Foto tirada → compressão no cliente → linha "Analisando recibo…" aparece na lista de gastos imediatamente (otimista).
3. Resultado (online ou Tesseract offline) preenche um **card de sugestão**: valor, moeda, data, estabelecimento e categoria sugerida; campos com baixa confiança aparecem em amarelo.
4. Usuário ajusta categoria com chips (⛽ 🍽 🛣 🎫) e confirma. O gasto grava a taxa de câmbio do dia; o resumo do dia atualiza.
5. O recibo vira `asset` (categoria `receipt`) ligado ao dia e ao gasto.

### 5.4 Aceitar uma sugestão da IA

1. Item ✦ na timeline ou notificação "5 sugestões para o Dia 3".
2. Sheet com a sugestão: imagem, motivo ("a 12 km da rota, aberto até 18h"), tempo estimado, custo estimado.
3. **Aceitar** insere a atividade na posição sugerida; **Descartar** oculta; **Depois** mantém pendente. Nada é gravado sem essa ação.

### 5.5 Editar a dinâmica do dia

1. Toque no ✎ do bloco "Dinâmica do dia" → editor inline (Markdown leve, listas, checklists).
2. Salva a cada pausa de digitação no SQLite local; sync em segundo plano.
3. Histórico de versões acessível em "…" → "Ver alterações" (útil em viagens colaborativas).

## 6. Estados que a tela precisa tratar

| Estado | Apresentação |
|---|---|
| Sem documentos vinculados ao dia | Bloco vazio com "Vincular documentos" e sugestão automática ("3 documentos mencionam 12 mai — vincular?") |
| Documento vinculado mas não baixado | Ícone ⬇ cinza; toque tenta baixar; se offline, explica e oferece "Lembrar quando houver rede" |
| Sync com itens pendentes | Contador "3 aguardando envio" no cabeçalho; nunca modal |
| Conflito de edição (raro) | Banner "Outra pessoa editou a dinâmica do dia" com "Ver as duas versões" |
| Cota de armazenamento baixa | Aviso antes de "Preparar para offline"; sugestão de não baixar fotos |
| Dia sem data (roteiro relativo) | Cabeçalho mostra "Dia 3 · sem data" e botão "Definir data de início" |

## 7. Microinterações e acessibilidade

- Alvos de toque ≥ 48 px; ações principais na metade inferior da tela (uso com uma mão, no carro ou na fila).
- **Modo estrada**: fonte maior, contraste alto, botões grandes para "Próxima parada" e "+ Gasto de combustível" (pré-categorizado).
- Documentos e valores em moeda base têm `aria-label` completos ("Voucher Hotel Roma, disponível offline").
- Cores de estado (offline, sugestão, crítico) sempre acompanhadas de ícone ou texto; nunca cor sozinha.
- Skeletons só para dados que vêm da rede; dados locais renderizam de imediato.
- Animação de "acender" dos documentos ao virar o dia (transição de 300 ms na borda esquerda), desligada com `prefers-reduced-motion`.
