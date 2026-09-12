/** Leitura mínima de EXIF em JPEG (DateTimeOriginal e GPS) para vincular fotos ao dia (docs/04 §2.2). Sem dependências. */

export interface ExifInfo {
  taken_at: string | null; // ISO local sem fuso: "YYYY-MM-DDTHH:MM:SS"
  date: string | null; // YYYY-MM-DD
  lat: number | null;
  lng: number | null;
}

export function parseExif(buf: ArrayBuffer): ExifInfo {
  const out: ExifInfo = { taken_at: null, date: null, lat: null, lng: null };
  const dv = new DataView(buf);
  if (dv.byteLength < 4 || dv.getUint16(0) !== 0xffd8) return out;
  let p = 2;
  while (p + 4 <= dv.byteLength) {
    if (dv.getUint8(p) !== 0xff) break;
    const marker = dv.getUint8(p + 1);
    const len = dv.getUint16(p + 2);
    if (marker === 0xe1 && p + 10 <= dv.byteLength && dv.getUint32(p + 4) === 0x45786966) {
      parseTiff(dv, p + 10, out);
      break;
    }
    if (marker === 0xda) break; // início dos dados da imagem
    p += 2 + len;
  }
  return out;
}

function parseTiff(dv: DataView, base: number, out: ExifInfo) {
  if (base + 8 > dv.byteLength) return;
  const le = dv.getUint16(base) === 0x4949;
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);
  const ifd0 = base + u32(base + 4);
  let exifIfd = 0, gpsIfd = 0;
  const readIfd = (off: number, cb: (tag: number, type: number, count: number, valOff: number) => void) => {
    if (off + 2 > dv.byteLength) return;
    const n = u16(off);
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      if (e + 12 > dv.byteLength) return;
      cb(u16(e), u16(e + 2), u32(e + 4), e + 8);
    }
  };
  readIfd(ifd0, (tag, _t, _c, v) => {
    if (tag === 0x8769) exifIfd = base + u32(v);
    if (tag === 0x8825) gpsIfd = base + u32(v);
  });
  const ascii = (count: number, v: number) => {
    const off = count > 4 ? base + u32(v) : v;
    let s = "";
    for (let i = 0; i < count - 1 && off + i < dv.byteLength; i++) s += String.fromCharCode(dv.getUint8(off + i));
    return s;
  };
  const rationals = (count: number, v: number) => {
    const off = base + u32(v);
    const arr: number[] = [];
    for (let i = 0; i < count && off + i * 8 + 8 <= dv.byteLength; i++) {
      const d = u32(off + i * 8 + 4);
      arr.push(d ? u32(off + i * 8) / d : 0);
    }
    return arr;
  };
  if (exifIfd) {
    readIfd(exifIfd, (tag, type, count, v) => {
      if (tag === 0x9003 && type === 2) {
        const s = ascii(count, v); // "YYYY:MM:DD HH:MM:SS"
        const m = s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
        if (m) {
          out.date = `${m[1]}-${m[2]}-${m[3]}`;
          out.taken_at = `${out.date}T${m[4]}:${m[5]}:${m[6]}`;
        }
      }
    });
  }
  if (gpsIfd) {
    let latRef = "N", lngRef = "E", lat: number[] | null = null, lng: number[] | null = null;
    readIfd(gpsIfd, (tag, type, count, v) => {
      if (tag === 1 && type === 2) latRef = ascii(count, v);
      if (tag === 3 && type === 2) lngRef = ascii(count, v);
      if (tag === 2 && type === 5) lat = rationals(count, v);
      if (tag === 4 && type === 5) lng = rationals(count, v);
    });
    const dms = (a: number[]) => (a[0] ?? 0) + (a[1] ?? 0) / 60 + (a[2] ?? 0) / 3600;
    if (lat && lng) {
      out.lat = dms(lat) * (latRef.startsWith("S") ? -1 : 1);
      out.lng = dms(lng) * (lngRef.startsWith("W") ? -1 : 1);
    }
  }
}
