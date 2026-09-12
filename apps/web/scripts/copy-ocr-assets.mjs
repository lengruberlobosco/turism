// Copia worker e core do Tesseract.js para public/ocr para o OCR funcionar sem CDN (cache runtime do SW após 1º uso).
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const out = path.resolve("public/ocr");
mkdirSync(out, { recursive: true });
const workerSrc = path.join(path.dirname(require.resolve("tesseract.js/package.json")), "dist/worker.min.js");
cpSync(workerSrc, path.join(out, "worker.min.js"));
const coreDir = path.dirname(require.resolve("tesseract.js-core/package.json"));
for (const f of ["tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm", "tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm"]) {
  const src = path.join(coreDir, f);
  if (existsSync(src)) cpSync(src, path.join(out, f));
}
console.log("OCR assets copiados para public/ocr");

// Dados de idioma (por, eng) — baixados uma vez no build para public/ocr/lang, servidos pelo próprio app (sem CDN em viagem).
const LANG_BASE = process.env.TESSDATA_BASE ?? "https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_best_int";
const langDir = path.join(out, "lang");
mkdirSync(langDir, { recursive: true });
for (const lang of ["por", "eng"]) {
  const dest = path.join(langDir, `${lang}.traineddata.gz`);
  if (existsSync(dest)) continue;
  const res = await fetch(`${LANG_BASE}/${lang}.traineddata.gz`);
  if (!res.ok) { console.warn(`aviso: não foi possível baixar ${lang}.traineddata.gz (${res.status}); OCR usará o CDN em runtime`); continue; }
  const { writeFileSync } = await import("node:fs");
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`idioma ${lang} salvo (${(Number(res.headers.get("content-length") ?? 0) / 1e6).toFixed(1)} MB)`);
}
