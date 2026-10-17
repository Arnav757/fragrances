import { requireAdminPage } from "@/lib/auth/session";
import { getAllSettings, getPages } from "@/lib/settings";
import { integrationStatus } from "@/lib/env";
import { KV, PageHeader, Panel } from "@/components/admin/ui";
import { CommerceSettingsForm, HomepageSettingsForm, PagesForm, StoreSettingsForm } from "@/components/admin/settings-forms";
import { Badge } from "@/components/ui/misc";

export const metadata = { title: "Settings" };

const ok = (b: boolean, yes = "Configured", no = "Not configured") => <Badge tone={b ? "success" : "warning"}>{b ? yes : no}</Badge>;

export default async function SettingsPage() {
  await requireAdminPage();
  const [{ store, commerce, homepage }, pages] = await Promise.all([getAllSettings(), getPages()]);
  const s = integrationStatus();
  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Secrets (API keys) are set as environment variables, never here." />
      <Panel title="Integrations (read-only)">
        <KV items={[
          ["Environment", <Badge key="e" tone={s.appEnv === "production" ? "dark" : "warning"}>{s.appEnv}</Badge>],
          ["Razorpay", <span key="r">{ok(s.razorpay.configured, `Configured (${s.razorpay.mode})`)} {s.mockPayments && <Badge tone="warning">Simulated payments ON</Badge>}</span>],
          ["Razorpay webhook", ok(s.razorpay.webhook)],
          ["Email (Resend)", ok(s.email.configured, "Configured", "Not configured — emails are logged only")],
          ["Image storage", ok(s.storage.configured, `Supabase bucket "${s.storage.bucket}"`, "Local disk (development only)")],
          ["Shiprocket", ok(s.shiprocket.configured, "Configured (serviceability checks)", "Not connected — manual tracking")],
        ]} />
        <p className="mt-4 text-xs text-stone">See README → “External accounts” for how to configure each one.</p>
      </Panel>
      <Panel title="Store details"><StoreSettingsForm initial={store} /></Panel>
      <Panel title="Commerce: tax, shipping, COD"><CommerceSettingsForm initial={commerce} /></Panel>
      <Panel title="Homepage content"><HomepageSettingsForm initial={homepage} /></Panel>
      <Panel title="Policy & information pages"><PagesForm initial={pages} /></Panel>
    </div>
  );
}
