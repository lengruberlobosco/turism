import { describe, it, expect } from "vitest";
import { buildZip, readZip } from "@/lib/backup";

describe("zip mínimo", () => {
  it("faz round-trip de entradas binárias e texto", async () => {
    const entries = [
      { name: "trip.json", data: new TextEncoder().encode('{"a":1}') },
      { name: "files/x", data: new Uint8Array([0, 1, 2, 255]) },
    ];
    const blob = buildZip(entries);
    const back = await readZip(new Uint8Array(await blob.arrayBuffer()));
    expect(back.map((e) => e.name)).toEqual(["trip.json", "files/x"]);
    expect(Array.from(back[1]!.data)).toEqual([0, 1, 2, 255]);
    expect(new TextDecoder().decode(back[0]!.data)).toBe('{"a":1}');
  });
});
