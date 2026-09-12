/** Parser de GPX/KML e estatísticas de trilha, para visualização offline sem tiles (docs/04 L6). */

export interface TrackPoint {
  lat: number;
  lng: number;
  ele: number | null;
  time: string | null;
}

export interface Track {
  name: string | null;
  points: TrackPoint[];
  waypoints: Array<{ name: string; lat: number; lng: number }>;
  distance_km: number;
  ascent_m: number;
  descent_m: number;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
}

export function parseTrack(xml: string): Track {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const points: TrackPoint[] = [];
  const waypoints: Track["waypoints"] = [];
  let name: string | null = doc.querySelector("trk > name, metadata > name, Document > name")?.textContent?.trim() ?? null;
  if (doc.documentElement.nodeName.toLowerCase() === "gpx") {
    for (const el of Array.from(doc.querySelectorAll("trkpt, rtept"))) {
      points.push({ lat: Number(el.getAttribute("lat")), lng: Number(el.getAttribute("lon")), ele: num(el.querySelector("ele")?.textContent), time: el.querySelector("time")?.textContent?.trim() ?? null });
    }
    for (const el of Array.from(doc.querySelectorAll("wpt"))) {
      waypoints.push({ name: el.querySelector("name")?.textContent?.trim() ?? "", lat: Number(el.getAttribute("lat")), lng: Number(el.getAttribute("lon")) });
    }
  } else {
    // KML: LineString coordinates "lng,lat,ele lng,lat,ele …"; Placemark/Point como waypoint
    for (const ls of Array.from(doc.getElementsByTagName("LineString"))) {
      const coords = ls.getElementsByTagName("coordinates")[0]?.textContent ?? "";
      for (const c of coords.trim().split(/\s+/)) {
        const [lng, lat, ele] = c.split(",").map(Number);
        if (Number.isFinite(lat) && Number.isFinite(lng)) points.push({ lat: lat!, lng: lng!, ele: Number.isFinite(ele) ? ele! : null, time: null });
      }
    }
    for (const pm of Array.from(doc.getElementsByTagName("Placemark"))) {
      const pt = pm.getElementsByTagName("Point")[0];
      if (!pt) continue;
      const [lng, lat] = (pt.getElementsByTagName("coordinates")[0]?.textContent ?? "").trim().split(",").map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lng)) waypoints.push({ name: pm.getElementsByTagName("name")[0]?.textContent?.trim() ?? "", lat: lat!, lng: lng! });
    }
    name ??= doc.getElementsByTagName("name")[0]?.textContent?.trim() ?? null;
  }
  return { name, points, waypoints, ...stats(points) };
}

function num(s: string | null | undefined): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function stats(points: TrackPoint[]) {
  let distance_km = 0, ascent_m = 0, descent_m = 0;
  let bounds: Track["bounds"] = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    bounds = bounds ? { minLat: Math.min(bounds.minLat, p.lat), maxLat: Math.max(bounds.maxLat, p.lat), minLng: Math.min(bounds.minLng, p.lng), maxLng: Math.max(bounds.maxLng, p.lng) } : { minLat: p.lat, maxLat: p.lat, minLng: p.lng, maxLng: p.lng };
    if (i === 0) continue;
    const q = points[i - 1]!;
    distance_km += haversineKm(q, p);
    if (p.ele != null && q.ele != null) {
      const d = p.ele - q.ele;
      if (d > 0) ascent_m += d; else descent_m -= d;
    }
  }
  return { distance_km: Math.round(distance_km * 10) / 10, ascent_m: Math.round(ascent_m), descent_m: Math.round(descent_m), bounds };
}

/** Projeta a trilha em coordenadas SVG (equiretangular com correção de latitude). */
export function trackToSvgPath(track: Track, width: number, height: number, pad = 8): string {
  const b = track.bounds;
  if (!b || track.points.length < 2) return "";
  const cos = Math.cos(((b.minLat + b.maxLat) / 2) * (Math.PI / 180));
  const w = Math.max((b.maxLng - b.minLng) * cos, 1e-6), h = Math.max(b.maxLat - b.minLat, 1e-6);
  const scale = Math.min((width - pad * 2) / w, (height - pad * 2) / h);
  const ox = (width - w * scale) / 2, oy = (height - h * scale) / 2;
  return track.points
    .map((p, i) => `${i ? "L" : "M"}${(ox + (p.lng - b.minLng) * cos * scale).toFixed(1)} ${(oy + (b.maxLat - p.lat) * scale).toFixed(1)}`)
    .join(" ");
}

export function isTrackFile(name: string | null | undefined, mime: string | null | undefined): boolean {
  return /\.(gpx|kml)$/i.test(name ?? "") || /gpx|kml/i.test(mime ?? "");
}
