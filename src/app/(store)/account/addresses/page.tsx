import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AddressBook, type Addr } from "@/components/store/address-book";

export const metadata: Metadata = { title: "Saved addresses", robots: { index: false } };

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const addresses = await db()<Addr[]>`
    select id, label, full_name, phone, line1, line2, landmark, city, state, pincode, is_default
    from addresses where user_id = ${user.id} order by is_default desc, created_at desc`;
  return (
    <section>
      <h1 className="mb-6 text-2xl text-ink">Saved addresses</h1>
      <AddressBook addresses={addresses} />
    </section>
  );
}
