import { handleOptions, json, corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { makeClient, parseItinerary } from "../_shared/ai.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  const user = await requireUser(req);
  if (user instanceof Response) return new Response(user.body, { status: user.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
