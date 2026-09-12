# 04 — Análise do escopo, lacunas operacionais e novas funcionalidades

## 1. Lacunas no escopo original (o que quebra na estrada se não for previsto)

| # | Lacuna | Risco operacional | Recomendação |
|---|---|---|---|
| L1 | **Fuso horário** não está no modelo | "Dia corrente" errado após voo; alarmes disparam na hora errada | `timezone` por dia; horários de atividade gravados em local + UTC |
| L2 | **Múltiplos viajantes** e divisão de custos | Expedições raramente são solitárias; a planilha final precisa de "quem pagou / quem deve" | `trip_members`, `paid_by`, `split` por gasto, acerto de contas ao final |
| L3 | **Documentos sensíveis** (passaporte, seguro, cartões) | Vazamento em caso de perda do celular ou de conta | Criptografia no cliente, bloqueio biométrico para abrir, campo `sensitive` |
| L4 | **Validade de documentos** | Passaporte a vencer, visto, CNH internacional, vacina | Datas de validade em assets + alerta 90/30/7 dias antes da viagem |
| L5 | **Alterações de terceiros** (voo atrasado, hotel cancelado) | Roteiro desatualizado no dia mais crítico | Rastreamento de voo (AeroDataBox/FlightAware) e trem; ingestão de e-mails de alteração |
| L6 | **Mapa offline de verdade** | Link do Google Maps não abre sem rede | Tiles PMTiles por região + visualizador GPX/KML embutido |
| L7 | **Licenciamento de imagens** | "Buscar imagens na internet" gera risco jurídico | Fontes com licença (Wikimedia, Unsplash), atribuição gravada, download para o Storage |
| L8 | **Precisão do OCR** em recibos térmicos, amassados, em idiomas diversos | Valores errados na planilha | Confiança por campo, revisão obrigatória abaixo de um limiar, segunda passada online |
| L9 | **Imutabilidade de câmbio** | Total da viagem "muda" a cada abertura | Taxa congelada no gasto (já incorporado no modelo) |
| L10 | **Cota e despejo de storage no iOS** | Documentos somem no meio da viagem | Instalação obrigatória antes do modo offline, `storage.persist()`, prioridade de download |
| L11 | **Importação de reservas** manual | Fricção alta no cadastro; usuário desiste | Encaminhar e-mail de confirmação para `viagem+id@…` → IA extrai dados e cria asset + atividade |
| L12 | **Backup / portabilidade** | Vendor lock-in e medo de perder tudo | Exportar viagem como ZIP (JSON + arquivos) e PDF "livro da viagem"; importar de volta |
| L13 | **Veículo próprio** em expedições (combustível, quilometragem) | Custo por km e autonomia ignorados | Odômetro por dia, consumo, previsão de abastecimento na rota |
| L14 | **Emergência** | Sem rede, sem idioma, sem documentos | Cartão de emergência offline: embaixada, seguro, tipo sanguíneo, contatos, frases-chave |

## 2. Novas funcionalidades, priorizadas

Escala de esforço: **P** (dias), **M** (semanas), **G** (mês ou mais). Valor: ★ a ★★★.

### 2.1 Alta prioridade (entram no MVP+1)

| Funcionalidade | Valor | Esforço | Descrição |
|---|---|---|---|
| **Ingestão por e-mail** (`forward-to-trip`) — pendente | ★★★ | M | Encaminhar confirmações de hotel, voo, trem e ingressos. Worker com Claude extrai datas, códigos, endereços e anexa PDF ao dia certo. Elimina a maior parte do cadastro manual. |
| ✅ **Web Share Target** | ★★★ | P | Compartilhar um PDF ou link de qualquer app do celular direto para a viagem/dia. |
| ✅ **Modo balcão** para documentos | ★★★ | P | Tela cheia, brilho máximo, QR/código de barras ampliado, rotação travada. |
| ✅ **Divisão de despesas** entre membros | ★★★ | M | `paid_by` + `split` (igual, por pessoa, por percentual), acerto final e exportação. |
| ✅ **Cartão de emergência offline** | ★★★ | P | Dados vitais, seguro, embaixada, contatos, com acesso rápido sem login. |
| ✅ **Checklists por dia e de mala** | ★★ | P | Itens com estado, templates por tipo de viagem, lembretes na véspera. |
| ✅ **Exportação ZIP e PDF** ("livro da viagem") | ★★ | M | Backup completo e relato final com fotos, mapa e planilha. |
| ✅ **Validade de documentos** com alertas | ★★ | P | Passaporte, visto, CNH, vacinas, seguro. |

### 2.2 Média prioridade

| Funcionalidade | Valor | Esforço | Descrição |
|---|---|---|---|
| **Rastreamento de voos e trens** | ★★★ | M | Status, portão, atraso; atualização automática da atividade e notificação. |
| **Mapa offline (PMTiles) + GPX viewer** | ★★★ | G | Baixar região da viagem; exibir rota e paradas sem rede; navegação básica. |
| **Geofencing e notificações contextuais** | ★★ | M | "Você chegou ao hotel — abrir voucher?"; "Pedágio em 5 km — registrar gasto?". Requer app instalado. |
| **Transcrição de áudios** (notas de voz) | ★★ | P | Notas gravadas viram texto pesquisável e viram entradas do diário. |
| **Vinculação automática de fotos** | ★★ | P | EXIF (data/GPS) liga a foto ao dia e ao local; sugestão "12 fotos de 12 mai — vincular ao Dia 3?". |
| **Diário do dia gerado por IA** | ★★ | P | Ao fim do dia, resumo com atividades feitas, gastos e fotos; editável. |
| **Previsão de orçamento** | ★★ | M | Comparação planejado vs. realizado por categoria; projeção até o fim da viagem. |
| **Clima e nascer/pôr do sol por dia** | ★ | P | Ajuda a planejar deslocamentos e fotografia. |
| **Colaboração em tempo real** | ★★ | M | Vários membros editando; presença; comentários por atividade. |
| **Calendário (ICS) e Wallet** | ★ | P | Exportar atividades para Google/Apple Calendar; passes para Wallet. |

### 2.3 Expedições e viagens de veículo

| Funcionalidade | Valor | Esforço | Descrição |
|---|---|---|---|
| **Módulo veículo** | ★★★ | M | Odômetro, abastecimentos (litros, preço, posto), consumo médio, custo por km, alerta de autonomia vs. próximo posto. |
| **Fronteiras e requisitos** | ★★ | M | Checklist por país (documentos do veículo, seguro carta verde, moeda, tomada, chip); IA monta a partir do roteiro. |
| **Pontos estratégicos na rota** | ★★ | M | Postos, mecânicas, hospitais, farmácias dentro de um corredor da rota (Google Places + Overpass/OSM). |
| **Telemetria opcional** | ★ | G | Integração com GPS/OBD via app companheiro; trilha real vs. planejada. |

### 2.4 Tecnologias e práticas que agregam valor

- **UUID v7 gerados no cliente** para toda entidade: idempotência de sync e ordenação temporal natural.
- **Compressão de imagens no cliente** (WebP, redimensionamento) antes de guardar/subir.
- **PDF.js** embarcado para vouchers; não depender do visualizador do navegador (quebra em iOS instalado).
- **Passkeys** como login primário: sem senha para lembrar em viagem.
- **Capacitor** como plano B para App Store/Play quando push, geofencing ou Background Sync forem indispensáveis, reaproveitando 100% do código web.
- **Feature flags** e rollout gradual do Service Worker: uma versão quebrada de SW é o pior incidente possível para um app offline.
- **Testes E2E offline** com Playwright (`context.setOffline(true)`) cobrindo os fluxos 5.1 a 5.3 da UX.
- **Message Batches da Claude API** para reprocessar recibos e roteiros em lote com 50 % de desconto (pós-viagem, relatórios).
- **Prompt caching** no worker: sistema + esquema JSON + categorias como prefixo estável.

## 3. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Alucinação de POIs pela IA | IA só ranqueia candidatos vindos de Places/OSM; cada sugestão exibe fonte e link |
| Custo de IA por viagem | Parsing de roteiro com Opus 5 uma vez; OCR e classificação com Haiku 4.5; batches para pós-processamento |
| Dependência de APIs externas | Câmbio com fallback e cache local; imagens baixadas para o Storage; nada crítico depende de terceiro em tempo real |
| Perda do dispositivo | Dados sensíveis criptografados; sessão revogável; tudo restaurável do servidor em novo aparelho |
| Fadiga de notificações | Notificações apenas contextuais (chegada, atraso, véspera); tudo desligável por tipo |
