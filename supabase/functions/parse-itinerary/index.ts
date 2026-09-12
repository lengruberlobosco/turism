import { handleOptions, json } from "../_shared/cors.ts";
import { makeClient, parseItinerary } from "../_shared/ai.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const body = (await req.json()) as { text?: string; pdf_base64?: string; start_date?: string | null };
    if (!body.text && !body.pdf_base64) return json({ error: "text ou pdf_base64 obrigatório" }, 400);
    const client = makeClient(Deno.env.get("ANTHROPIC_API_KEY"));
    const parsed = await parseItinerary(client, body);
    return json(parsed);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
