import "server-only";
import { db, type Queryable } from "../db";
import type { DiscountRule } from "../pricing";

export type DiscountLookup = { rule: DiscountRule | null; error: string | null };

export async function findValidDiscount(code: string | null | undefined, q: Queryable = db()): Promise<DiscountLookup> {
  const clean = code?.trim();
  if (!clean) return { rule: null, error: null };
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(clean)) return { rule: null, error: "That code isn't valid." };
  const rows = await q<
    {
      code: string;
      type: "percent" | "fixed";
      value: number;
      minSubtotalPaise: number;
      maxDiscountPaise: number | null;
      maxUses: number | null;
      usedCount: number;
      startsAt: Date | null;
      endsAt: Date | null;
      isActive: boolean;
    }[]
  >`select code, type, value, min_subtotal_paise, max_discount_paise, max_uses, used_count, starts_at, ends_at, is_active
    from discounts where code = ${clean}`;
  const d = rows[0];
  const now = Date.now();
  if (!d || !d.isActive) return { rule: null, error: "That code isn't valid." };
  if (d.startsAt && d.startsAt.getTime() > now) return { rule: null, error: "That code isn't active yet." };
  if (d.endsAt && d.endsAt.getTime() < now) return { rule: null, error: "That code has expired." };
  if (d.maxUses !== null && d.usedCount >= d.maxUses) return { rule: null, error: "That code has reached its usage limit." };
  return {
    rule: {
      code: d.code.toUpperCase(),
      type: d.type,
      value: d.value,
      minSubtotalPaise: d.minSubtotalPaise,
      maxDiscountPaise: d.maxDiscountPaise,
    },
    error: null,
  };
}

/** Atomically reserve one use of a discount code. Returns false if the limit was reached meanwhile. */
export async function reserveDiscountUse(code: string, q: Queryable): Promise<boolean> {
  const rows = await q`
    update discounts set used_count = used_count + 1
    where code = ${code} and is_active and (max_uses is null or used_count < max_uses)
    returning id`;
  return rows.length === 1;
}

export async function releaseDiscountUse(code: string, q: Queryable) {
  await q`update discounts set used_count = greatest(used_count - 1, 0) where code = ${code}`;
}
