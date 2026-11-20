import { getCurrentUser } from "@/lib/auth/session";
import { photoFor } from "@/lib/services/analyses";

export const dynamic = "force-dynamic";

/** Staff-only access to a customer's private photo. Never cached by shared caches. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorised", { status: 401 });
  const { id, kind } = await params;
  if (kind !== "headshot" && kind !== "fullbody") return new Response("not found", { status: 404 });
  const photo = await photoFor(id, kind);
  if (!photo) return new Response("not found", { status: 404 });
  return new Response(Buffer.from(photo.bytes), {
    headers: { "Content-Type": photo.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" },
  });
}
