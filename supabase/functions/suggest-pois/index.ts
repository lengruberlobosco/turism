import { handleOptions, json } from "../_shared/cors.ts";
import { makeClient, suggestPois, findReferenceImage } from "../_shared/ai.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  try {
    const body = (await req.json()) as { trip_id: string; days: Array<{ day_index: number; date: string | null; title: string | null; narrative: string | null }> };
    const client = makeClient(Deno.env.get("ANTHROPIC_API_KEY"));
    const { suggestions } = await suggestPois(client, body.days);
    // imagem de referência do destino de cada dia (licença livre, com atribuição)
    const images = await Promise.all(body.days.filter((d) => d.title).map(async (d) => ({ d, img: await findReferenceImage(d.title!).catch(() => null) })));
    const out = [
      ...suggestions.map((s) => ({ day_index: s.day_index, kind: s.kind, reason: s.reason, payload: { title: s.title, place_name: s.place_name, type: s.type, start_time: s.start_time, url: s.source_url } })),
      ...images.filter((x) => x.img).map(({ d, img }) => ({ day_index: d.day_index, kind: "image" as const, reason: `Imagem de referência de ${d.title}`, payload: { title: d.title, image_url: img!.url, url: img!.page_url, attribution: img!.attribution } })),
    ];
    return json({ suggestions: out });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
