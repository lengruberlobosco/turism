# 07 — Primeiros passos (guia para quem não é da área)

## O que você tem hoje

Um aplicativo de viagem pronto, guardado no GitHub (o "cofre" do código). Ele funciona **sem nenhum serviço pago**: tudo fica no seu celular ou computador e funciona sem internet. Serviços extras (sincronizar entre aparelhos, ler PDF com IA) são opcionais e vêm depois.

## Etapa 1 — Colocar o app no ar (cerca de 15 minutos, grátis)

O app precisa de um "endereço na internet" para ser instalado no celular. A forma mais simples é a Vercel, que lê o código direto do GitHub.

1. Entre em https://vercel.com e clique em **Sign Up** → **Continue with GitHub**. Autorize.
2. Clique em **Add New… → Project**. Escolha o repositório **turism**. Se ele não aparecer, clique em *Adjust GitHub App Permissions* e libere o repositório.
3. Na tela de configuração: em **Root Directory**, clique em *Edit* e escolha a pasta **apps/web**; em **Framework Preset**, deixe **Vite**; em **Branch**, escolha `claude/travel-management-platform-dplfg0`. O resto o arquivo `apps/web/vercel.json` já define.
4. Clique em **Deploy** e aguarde uns 3 minutos. Ao final aparece um endereço como `turism-xxxx.vercel.app`. Esse é o seu app.

Se preferir a Netlify, o processo é igual (o arquivo `netlify.toml` já está pronto).

## Etapa 2 — Instalar no celular (2 minutos)

- **Android (Chrome):** abra o endereço, toque nos três pontos → **Adicionar à tela inicial** (ou **Instalar app**).
- **iPhone (Safari):** abra o endereço, toque no botão de compartilhar (quadrado com seta) → **Adicionar à Tela de Início**.

Instalar é importante: no iPhone, um site não instalado pode ter os dados apagados depois de uma semana sem uso. Instalado, os documentos ficam guardados.

## Etapa 3 — Usar (sem internet mesmo)

1. Abra o app → **Nova viagem** (nome, datas, moeda) ou **Importar roteiro** (cole o texto do seu roteiro; use "usar exemplo" para ver como funciona).
2. Na tela do dia, toque em **+ Documento ou link** para guardar vouchers, passagens e ingressos. Marque **Crítico** nos mais importantes: eles aparecem no card "Agora".
3. Para gastos, toque em **+ Gasto** → **Fotografar recibo**. O app lê o valor sozinho (revise e confirme).
4. Em **Mais**, cadastre os viajantes (para dividir contas), o cartão de emergência e os checklists de mala.
5. Antes de viajar, em **Configurações**, toque em **Preparar OCR offline** para a leitura de recibos funcionar sem internet.

Teste: coloque o celular em modo avião e abra o app. Tudo deve continuar funcionando.

## Etapa 4 (opcional, mais tarde) — Sincronizar entre aparelhos e ligar a IA

Só vale a pena quando você quiser usar o mesmo roteiro em dois aparelhos, compartilhar com outra pessoa ou ler PDFs por IA. Exige duas contas:

- **Supabase** (banco de dados online; tem plano grátis): https://supabase.com
- **Claude API** (a inteligência artificial; cobra por uso, centavos por roteiro): https://console.anthropic.com

O passo a passo técnico está em `docs/06-deploy.md`. Nessa etapa é melhor ter ajuda de alguém técnico ou pedir a mim para executar com você.

## Se algo der errado

- **A Vercel deu erro no deploy:** confira em *Settings → Build and Deployment* se **Root Directory** é `apps/web` e **Framework Preset** é Vite; depois *Deployments → Redeploy*. Se persistir, copie o texto do erro e me envie.
- **O app não abre offline:** confirme que foi instalado na tela inicial e abra-o uma vez com internet antes.
- **Quer mudar algo no app:** descreva o que deseja; as alterações são feitas no código e a Vercel publica sozinha a cada atualização.
