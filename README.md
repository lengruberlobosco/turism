# Turism — Hub de gerenciamento de viagens e expedições

Plataforma web responsiva (PWA, desktop e mobile) para gerenciamento **logístico, documental e financeiro** de viagens complexas, com prioridade máxima para **disponibilidade offline** de documentos e dados críticos durante os deslocamentos.

Este repositório contém, nesta fase, o **desenho de arquitetura, modelo de dados e UX** do produto. O código será estruturado seguindo o que está descrito aqui.

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/01-arquitetura.md](docs/01-arquitetura.md) | Arquitetura de software, stack (linguagens/frameworks), estratégia offline-first (PWA), integração com IA, OCR e câmbio |
| [docs/02-modelo-de-dados.md](docs/02-modelo-de-dados.md) | Modelo de dados (Postgres + SQLite local), diagrama ER, DDL, regras de sincronização e de segurança (RLS) |
| [docs/03-ux-tela-do-dia.md](docs/03-ux-tela-do-dia.md) | Fluxo de experiência do usuário da tela principal de um dia de viagem, wireframes mobile/desktop, estados e microinterações |
| [docs/04-lacunas-e-novas-funcionalidades.md](docs/04-lacunas-e-novas-funcionalidades.md) | Análise crítica do escopo, lacunas operacionais e lista priorizada de novas funcionalidades e tecnologias |
| [docs/05-roadmap.md](docs/05-roadmap.md) | Fases de entrega, estrutura do monorepo e critérios de aceite |

## Módulos do produto

1. **Organização cronológica e logística** — linha do tempo por dia (Dia 1, Dia 2…), descrições operacionais, deslocamentos e atividades.
2. **Gestão documental e multimídia contextual** — repositório de vouchers, passagens, ingressos, fotos, áudios e links (GPS, Google Maps), vinculados a dias; a interface "acende" o que é necessário para o dia corrente.
3. **Motor financeiro e conversão de moedas** — lançamentos diários categorizados, câmbio em tempo real (BRL, EUR, USD…), OCR de recibos com sugestão de lançamento.
4. **Automação via IA** — leitura de roteiros em texto/PDF, estruturação automática dos dias, busca de imagens de referência e sugestões contextuais de passeios e paradas.

## Princípios de engenharia

- **Offline-first, não offline-tolerante**: o dispositivo é a fonte de verdade durante a viagem; o servidor sincroniza quando há rede.
- **Documento do dia sempre a um toque**: nenhum documento crítico depende de rede, login ou de terceiros para ser aberto.
- **Valores financeiros imutáveis**: cada gasto guarda a taxa de câmbio do momento; conversões nunca "mudam de ideia" depois.
- **IA sugere, o viajante decide**: toda automação gera propostas revisáveis, nunca grava dados definitivos sem confirmação.
