import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { randomToken } from "./auth/crypto";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Detect the real image type from magic bytes — never trust the browser-supplied MIME type or extension. */
export function sniffImageType(buf: Uint8Array): { mime: string; ext: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buf[i] === b)) return { mime: "image/png", ext: "png" };
  if (
    buf.length >= 12 &&
    String.fromCharCode(...buf.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...buf.slice(8, 12)) === "WEBP"
  )
    return { mime: "image/webp", ext: "webp" };
  if (buf.length >= 12 && String.fromCharCode(...buf.slice(4, 12)) === "ftypavif") return { mime: "image/avif", ext: "avif" };
  return null;
}

export class UploadError extends Error {}

export async function storeProductImage(file: File): Promise<{ url: string; storagePath: string }> {
  if (file.size === 0) throw new UploadError("The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Images must be 5 MB or smaller.");
  const buf = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(buf);
  if (!type) throw new UploadError("Only JPEG, PNG, WebP or AVIF images are allowed.");
  const name = `products/${new Date().toISOString().slice(0, 7)}/${randomToken(12).replace(/[^A-Za-z0-9]/g, "")}.${type.ext}`;

  const e = env();
  if (e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) {
    const res = await fetch(`${e.SUPABASE_URL}/storage/v1/object/${e.SUPABASE_STORAGE_BUCKET}/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": type.mime,
        "x-upsert": "false",
        "cache-control": "31536000",
      },
      body: buf,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new UploadError(`Upload to storage failed (${res.status}).`);
    return { url: `${e.SUPABASE_URL}/storage/v1/object/public/${e.SUPABASE_STORAGE_BUCKET}/${name}`, storagePath: `supabase:${name}` };
  }

  // Local development fallback: files are written under public/uploads (not suitable for serverless hosting).
  const dest = path.join(process.cwd(), "public", "uploads", name);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return { url: `/uploads/${name}`, storagePath: `local:${name}` };
}

export async function deleteStoredImage(storagePath: string | null) {
  if (!storagePath) return;
  const e = env();
  if (storagePath.startsWith("supabase:") && e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) {
    const name = storagePath.slice("supabase:".length);
    await fetch(`${e.SUPABASE_URL}/storage/v1/object/${e.SUPABASE_STORAGE_BUCKET}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [name] }),
    }).catch(() => {});
  } else if (storagePath.startsWith("local:")) {
    const name = storagePath.slice("local:".length);
    if (!name.includes("..")) await unlink(path.join(process.cwd(), "public", "uploads", name)).catch(() => {});
  }
}
