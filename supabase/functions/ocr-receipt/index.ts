import { handleOptions, json } from "../_shared/cors.ts";
import { makeClient, ocrReceipt } from "../_shared/ai.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const body = (await req.json()) as { image_base64: string; media_type?: string };
    if (!body.image_base64) return json({ error: "image_base64 obrigatório" }, 400);
    const client = makeClient(Deno.env.get("ANTHROPIC_API_KEY"));
    const out = await ocrReceipt(client, body.image_base64, body.media_type ?? "image/jpeg");
    return json({ ...out, source: "ocr_online" });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
