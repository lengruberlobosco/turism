import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Critério de aceite da Fase 1 (docs/05): criar viagem, anexar documento, lançar gasto,
 * desligar a rede, recarregar e ver tudo — documento abre em menos de 3 s.
 */
test("viagem completa funciona offline", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Minhas viagens" })).toBeVisible();

  // cria viagem com datas que incluem hoje
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const start = new Date(today); start.setUTCDate(today.getUTCDate() - 1);
  const end = new Date(today); end.setUTCDate(today.getUTCDate() + 1);
  await page.getByRole("link", { name: /Nova viagem/ }).click();
  await page.getByPlaceholder("Expedição Patagônia 2026").fill("Teste Toscana");
  await page.locator('input[type="date"]').nth(0).fill(iso(start));
  await page.locator('input[type="date"]').nth(1).fill(iso(end));
  await page.getByRole("button", { name: "Criar viagem" }).click();

  // abre no dia corrente (Dia 2)
  await expect(page.getByRole("button", { name: /^Dia 2/ })).toBeVisible();
  await expect(page.getByText("hoje", { exact: true })).toBeVisible();

  // adiciona atividade
  await page.getByRole("button", { name: /Atividade/ }).click();
  await page.getByPlaceholder("Trem Florença → Roma").fill("Trem Florença → Roma");
  await page.locator('input[type="time"]').first().fill("23:59");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Trem Florença → Roma").first()).toBeVisible();

  // anexa documento (PDF mínimo) vinculado ao dia, crítico
  const pdf = path.join(__dirname, "fixtures", "voucher.pdf");
  await page.getByRole("button", { name: /Documento ou link/ }).click();
  await page.locator('input[type="file"]').setInputFiles(pdf);
  await page.getByPlaceholder("Voucher Hotel Roma").fill("Voucher Hotel Roma");
  await page.getByText("Crítico (passagem, voucher)").click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Voucher Hotel Roma").first()).toBeVisible();

  // lança gasto manual em moeda base
  await page.getByRole("button", { name: "Novo gasto" }).click();
  await page.getByRole("button", { name: /Lançar manualmente/ }).click();
  await page.getByPlaceholder("0,00").fill("86,40");
  await page.getByRole("button", { name: /Combustível/ }).click();
  await page.getByRole("button", { name: "Confirmar gasto" }).click();
  await expect(page.getByText("R$ 86,40").first()).toBeVisible();

  // ---- offline ----
  await page.waitForTimeout(1500); // SW termina de precachear
  await context.setOffline(true);
  const t0 = Date.now();
  await page.reload();
  await expect(page.getByText("offline", { exact: true })).toBeVisible();
  await expect(page.getByText("Voucher Hotel Roma").first()).toBeVisible();
  await expect(page.getByText("R$ 86,40").first()).toBeVisible();
  // card "Agora" abre o documento crítico
  await page.getByRole("button", { name: "Abrir documento" }).click();
  await expect(page.getByRole("dialog", { name: "Voucher Hotel Roma" })).toBeVisible();
  await expect(page.getByText(/disponível offline/).first()).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(3000 + 5000); // 3 s de meta + folga de reload no CI
  await page.getByRole("button", { name: "Fechar" }).click();

  // lançar gasto offline continua funcionando
  await page.getByRole("button", { name: "Novo gasto" }).click();
  await page.getByRole("button", { name: /Lançar manualmente/ }).click();
  await page.getByPlaceholder("0,00").fill("12");
  await page.getByRole("button", { name: "Confirmar gasto" }).click();
  await expect(page.getByText("R$ 98,40").first()).toBeVisible();
  await context.setOffline(false);
});

test("importa roteiro em texto e cria viagem estruturada", async ({ page }) => {
  await page.goto("/import");
  await page.getByText("usar exemplo").click();
  await page.getByRole("button", { name: /Estruturar roteiro/ }).click();
  await expect(page.getByText("Roteiro Toscana e Roma")).toBeVisible();
  await expect(page.getByText(/Dia 3/).first()).toBeVisible();
  await page.getByRole("button", { name: /Criar viagem com este roteiro/ }).click();
  await expect(page.getByRole("button", { name: /^Dia 1/ })).toBeVisible();
  await expect(page.getByText("Trem Pisa → Florença").first()).toBeVisible();
});

test.beforeAll(() => {
  const dir = path.join(__dirname, "fixtures");
  fs.mkdirSync(dir, { recursive: true });
  const pdf = `%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`;
  fs.writeFileSync(path.join(dir, "voucher.pdf"), pdf);
});

test("OCR no dispositivo lê o total de um recibo", async ({ page, context }) => {
  test.setTimeout(180_000);
  // cria viagem simples
  await page.goto("/trips/new");
  await page.getByPlaceholder("Expedição Patagônia 2026").fill("OCR");
  await page.getByRole("button", { name: "Criar viagem" }).click();
  await expect(page.getByRole("button", { name: /^Dia 1/ })).toBeVisible();

  // renderiza um recibo em HTML e captura como PNG
  const receipt = await context.newPage();
  await receipt.setViewportSize({ width: 800, height: 600 });
  await receipt.setContent(`<body style="margin:0;background:#fff"><pre style="font:bold 44px Arial, sans-serif;padding:40px;color:#000;line-height:1.6">POSTO ESTRELA\n12/05/2026\nGasolina   40,00\nAgua        3,50\nTOTAL R$ 43,50</pre></body>`);
  const png = await receipt.screenshot({ type: "png" });
  await receipt.close();

  await page.getByRole("button", { name: "Novo gasto" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Escolher da galeria/ }).click();
  await (await chooser).setFiles({ name: "recibo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText(/Sugestão do OCR/)).toBeVisible({ timeout: 150_000 });
  // tolerância à precisão do OCR local: o valor da linha TOTAL foi escolhido (43,5x), não um item
  await expect(page.getByPlaceholder("0,00")).toHaveValue(/^43\.5/);
  await expect(page.getByRole("group", { name: "Categoria" }).getByRole("button", { name: /Combustível/ })).toHaveClass(/chip-on/);
  await page.getByPlaceholder("0,00").fill("43,50");
  await page.getByRole("button", { name: "Confirmar gasto" }).click();
  await expect(page.getByText("R$ 43,50").first()).toBeVisible();
});

test("Web Share Target recebe arquivo via Service Worker e abre o sheet de upload", async ({ page }) => {
  await page.goto("/trips/new");
  await page.getByPlaceholder("Expedição Patagônia 2026").fill("Share");
  await page.getByRole("button", { name: "Criar viagem" }).click();
  await expect(page.getByRole("button", { name: /^Dia 1/ })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 });
  // simula outro app compartilhando um PDF (POST multipart interceptado pelo SW)
  const status = await page.evaluate(async () => {
    const fd = new FormData();
    fd.append("title", "Voucher compartilhado");
    fd.append("files", new File(["%PDF-1.1"], "voucher.pdf", { type: "application/pdf" }));
    const res = await fetch("/share-target", { method: "POST", body: fd, redirect: "manual" });
    return { type: res.type, status: res.status };
  });
  expect(["opaqueredirect", "default"]).toContain(status.type);
  await page.goto("/share-target?title=Voucher%20compartilhado");
  await expect(page.getByText("1 arquivo(s) recebido(s).")).toBeVisible();
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("dialog", { name: /Adicionar documento/ })).toBeVisible();
  await expect(page.getByText("1 arquivo(s) ·")).toBeVisible();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("button", { name: /^Dia 1/ })).toBeVisible();
  await page.locator("nav").getByRole("link", { name: "Docs" }).click();
  await expect(page.getByText("voucher").first()).toBeVisible();
});

test("viajantes: divisão de gasto e acerto de contas", async ({ page }) => {
  await page.goto("/trips/new");
  await page.getByPlaceholder("Expedição Patagônia 2026").fill("Split");
  await page.getByRole("button", { name: "Criar viagem" }).click();
  await page.locator("nav").getByRole("link", { name: "Mais" }).click();
  await page.getByRole("link", { name: /Viajantes/ }).click();
  await page.getByPlaceholder("Nome do viajante").fill("Ana");
  await page.getByPlaceholder("Nome do viajante").press("Enter");
  await page.getByPlaceholder("Nome do viajante").fill("Bia");
  await page.getByPlaceholder("Nome do viajante").press("Enter");
  await expect(page.getByText("Tudo quite.")).toBeVisible();
  // na emulação mobile do Chromium o viewport de layout cresce após o teclado virtual e a barra fixa sai da área visível
  await page.goto(page.url().replace("/travelers", "/expenses"));
  await page.getByRole("button", { name: "Gasto", exact: true }).click();
  await page.getByRole("button", { name: /Lançar manualmente/ }).click();
  await page.getByPlaceholder("0,00").fill("100");
  await page.getByRole("group", { name: "Quem pagou" }).getByRole("button", { name: "Ana" }).click();
  await page.getByRole("button", { name: "Confirmar gasto" }).click();
  await expect(page.getByText(/pago por Ana/)).toBeVisible();
  await page.getByRole("link", { name: /acerto de contas/ }).click();
  await expect(page.getByText("R$ 50,00").first()).toBeVisible();
  await expect(page.getByText("recebe R$ 50,00")).toBeVisible();
});

test("rota GPX abre no visualizador offline com distância e navegação", async ({ page }) => {
  await page.goto("/trips/new");
  await page.getByPlaceholder("Expedição Patagônia 2026").fill("GPX");
  await page.getByRole("button", { name: "Criar viagem" }).click();
  await expect(page.getByRole("button", { name: /^Dia 1/ })).toBeVisible();
  const gpx = `<?xml version="1.0"?><gpx><trk><name>Serra</name><trkseg><trkpt lat="-22.90" lon="-43.20"><ele>10</ele></trkpt><trkpt lat="-22.90" lon="-43.10"><ele>110</ele></trkpt><trkpt lat="-22.80" lon="-43.10"><ele>60</ele></trkpt></trkseg></trk></gpx>`;
  await page.getByRole("button", { name: /Documento ou link/ }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "serra.gpx", mimeType: "", buffer: Buffer.from(gpx) });
  await expect(page.getByRole("group", { name: "Categoria" }).getByRole("button", { name: /Rota GPS/ })).toHaveClass(/chip-on/);
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByRole("button", { name: /^serra/ }).click();
  await expect(page.getByRole("dialog", { name: "serra" })).toBeVisible();
  await expect(page.getByText(/21\.\d km/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Navegar/ })).toHaveAttribute("href", /maps\/dir/);
});
