import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { randomToken } from "./auth/crypto";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Detect the real image type from magic bytes — never trust the browser-supplied MIME type or extension. */
export function sniffImageType(buf: Uint8Array): { mime: "image/jpeg" | "image/png" | "image/webp"; ext: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buf[i] === b)) return { mime: "image/png", ext: "png" };
  if (buf.length >= 12 && String.fromCharCode(...buf.slice(0, 4)) === "RIFF" && String.fromCharCode(...buf.slice(8, 12)) === "WEBP")
    return { mime: "image/webp", ext: "webp" };
  return null;
}

export class UploadError extends Error {}

export type StoredPhoto = { path: string; mime: "image/jpeg" | "image/png" | "image/webp"; bytes: Uint8Array };

/** Local fallback directory. Deliberately outside `public/`, so photos are never served statically. */
const LOCAL_DIR = () => path.join(process.cwd(), ".data", "photos");

/**
 * Validates and stores a customer photo in PRIVATE storage. Photos are only ever read back through
 * server code (the AI analysis and the staff-only photo route), never by public URL.
 */
export async function storePhoto(file: File): Promise<StoredPhoto> {
  if (file.size === 0) throw new UploadError("The photo is empty.");
  if (file.size > MAX_PHOTO_BYTES) throw new UploadError("Photos must be 8 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) throw new UploadError("Please upload a JPEG, PNG or WebP photo.");
  const name = `${new Date().toISOString().slice(0, 7)}/${randomToken(18).replace(/[^A-Za-z0-9]/g, "")}.${type.ext}`;

  const e = env();
  if (e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) {
    const res = await fetch(`${e.SUPABASE_URL}/storage/v1/object/${e.SUPABASE_PHOTO_BUCKET}/${name}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": type.mime, "x-upsert": "false" },
      body: bytes,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new UploadError(`Photo upload failed (${res.status}). Please try again.`);
    return { path: `supabase:${name}`, mime: type.mime, bytes };
  }
  if (e.APP_ENV === "production") throw new UploadError("Photo storage is not configured.");
  const dest = path.join(LOCAL_DIR(), name);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, bytes);
  return { path: `local:${name}`, mime: type.mime, bytes };
}

function safeName(p: string, prefix: string): string | null {
  const name = p.slice(prefix.length);
  return /^[0-9]{4}-[0-9]{2}\/[A-Za-z0-9]+\.(jpg|png|webp)$/.test(name) ? name : null;
}

export async function readPhoto(storagePath: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const e = env();
  if (storagePath.startsWith("supabase:")) {
    const name = safeName(storagePath, "supabase:");
    if (!name || !e.SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) return null;
    const res = await fetch(`${e.SUPABASE_URL}/storage/v1/object/authenticated/${e.SUPABASE_PHOTO_BUCKET}/${name}`, {
      headers: { Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}` },
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, mime: sniffImageType(bytes)?.mime ?? "application/octet-stream" };
  }
  if (storagePath.startsWith("local:")) {
    const name = safeName(storagePath, "local:");
    if (!name) return null;
    try {
      const bytes = new Uint8Array(await readFile(path.join(LOCAL_DIR(), name)));
      return { bytes, mime: sniffImageType(bytes)?.mime ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }
  return null;
}

export async function deletePhoto(storagePath: string | null): Promise<void> {
  if (!storagePath) return;
  const e = env();
  if (storagePath.startsWith("supabase:") && e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) {
    const name = safeName(storagePath, "supabase:");
    if (!name) return;
    const res = await fetch(`${e.SUPABASE_URL}/storage/v1/object/${e.SUPABASE_PHOTO_BUCKET}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [name] }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Photo deletion failed (${res.status})`);
  } else if (storagePath.startsWith("local:")) {
    const name = safeName(storagePath, "local:");
    if (name) await unlink(path.join(LOCAL_DIR(), name)).catch(() => {});
  }
}
