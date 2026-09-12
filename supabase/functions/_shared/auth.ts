import { createClient } from "@supabase/supabase-js";

/** Exige um usuário autenticado (JWT do app) — impede uso anônimo das funções que consomem a Claude API. */
export async function requireUser(req: Request): Promise<{ id: string } | Response> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "não autenticado" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return new Response(JSON.stringify({ error: "sessão inválida" }), { status: 401, headers: { "Content-Type": "application/json" } });
  return { id: data.user.id };
}
