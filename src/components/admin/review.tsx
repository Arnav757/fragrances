"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deletePhotosAction, overridesAction, releaseAction, removeOutfitAction, saveNoteAction, updateOutfitAction } from "@/app/actions/admin";
import type { ActionResult } from "@/lib/forms";
import type { Outfit, Swatch } from "@/lib/style/types";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/form";
import { Notice } from "../ui/misc";

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run(fn: () => Promise<ActionResult>, after?: () => void) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.message) toast.success(r.message);
        after?.();
        router.refresh();
      } else toast.error(r.message);
    });
  }
  return { pending, run };
}

type Opt = { value: string; label: string };

export function OverridesForm({
  analysisId,
  fields,
  current,
  detected,
  edited,
}: {
  analysisId: string;
  fields: { key: string; label: string; options: Opt[] }[];
  current: Record<string, string | undefined>;
  detected: Record<string, string>;
  edited: boolean;
}) {
  const { pending, run } = useAct();
  return (
    <form
      action={(f) => {
        const raw: Record<string, string> = {};
        for (const fl of fields) {
          const v = String(f.get(fl.key) ?? "");
          if (v) raw[fl.key] = v;
        }
        if (edited && !confirm("Rebuilding replaces the outfits you've edited by hand. Continue?")) return;
        run(() => overridesAction(analysisId, raw));
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((fl) => (
          <Field key={fl.key} label={fl.label} htmlFor={`ov-${fl.key}`} hint={`Detected: ${fl.options.find((o) => o.value === detected[fl.key])?.label ?? detected[fl.key]}`}>
            <Select id={`ov-${fl.key}`} name={fl.key} defaultValue={current[fl.key] ?? ""}>
              <option value="">Use detected</option>
              {fl.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        ))}
      </div>
      <Button type="submit" variant="outline" loading={pending}>
        Apply corrections & rebuild report
      </Button>
    </form>
  );
}

export function NoteForm({ analysisId, note }: { analysisId: string; note: string }) {
  const { pending, run } = useAct();
  return (
    <form action={(f) => run(() => saveNoteAction(analysisId, String(f.get("note") ?? "")))} className="space-y-3">
      <Field label="Personal note shown at the top of the final report" htmlFor="note" hint="Be specific: the one or two changes that will make the biggest difference for him.">
        <Textarea id="note" name="note" defaultValue={note} rows={6} maxLength={4000} />
      </Field>
      <Button type="submit" variant="outline" loading={pending}>
        Save note
      </Button>
    </form>
  );
}

export function OutfitEditor({ analysisId, outfit, index, swatches }: { analysisId: string; outfit: Outfit; index: number; swatches: Swatch[] }) {
  const { pending, run } = useAct();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(outfit);
  if (!open) {
    return (
      <div className="flex items-start justify-between gap-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {String(index + 1).padStart(2, "0")} · {outfit.title} <span className="text-xs font-normal text-stone">({outfit.occasion.replace(/_/g, " ")})</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone">
            {outfit.pieces.map((p) => (
              <span key={p.slot + p.name} className="inline-flex items-center gap-1">
                <span className="h-3 w-3 rounded-sm ring-1 ring-black/10" style={{ backgroundColor: p.colour.hex }} /> {p.name}
              </span>
            ))}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm("Remove this outfit?") && run(() => removeOutfitAction(analysisId, outfit.id))}>
            Remove
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-xl border border-line bg-ivory p-4 my-2">
      <Field label="Title" htmlFor={`t-${outfit.id}`}>
        <Input id={`t-${outfit.id}`} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </Field>
      {draft.pieces.map((p, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[90px_1fr_1fr_160px]">
          <span className="self-center text-xs text-stone">{p.slot}</span>
          <Input aria-label="Piece name" value={p.name} onChange={(e) => setDraft({ ...draft, pieces: draft.pieces.map((x, j) => (j === i ? { ...x, name: e.target.value, query: `${e.target.value} men`.toLowerCase().slice(0, 120) } : x)) })} />
          <Input aria-label="Fit" value={p.fit ?? ""} placeholder="Fit (optional)" onChange={(e) => setDraft({ ...draft, pieces: draft.pieces.map((x, j) => (j === i ? { ...x, fit: e.target.value || undefined } : x)) })} />
          <Select
            aria-label="Colour"
            value={p.colour.name}
            onChange={(e) => {
              const s = swatches.find((x) => x.name === e.target.value);
              if (s) setDraft({ ...draft, pieces: draft.pieces.map((x, j) => (j === i ? { ...x, colour: s } : x)) });
            }}
          >
            {!swatches.some((s) => s.name === p.colour.name) && <option value={p.colour.name}>{p.colour.name}</option>}
            {swatches.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      ))}
      <Field label="Why it works" htmlFor={`w-${outfit.id}`}>
        <Textarea id={`w-${outfit.id}`} value={draft.why} onChange={(e) => setDraft({ ...draft, why: e.target.value })} rows={2} />
      </Field>
      <div className="flex gap-2">
        <Button size="sm" loading={pending} onClick={() => run(() => updateOutfitAction(analysisId, outfit.id, { title: draft.title, why: draft.why, pieces: draft.pieces }), () => setOpen(false))}>
          Save outfit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(outfit);
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function ReleasePanel({ analysisId, canRelease, hasNote, revision }: { analysisId: string; canRelease: boolean; hasNote: boolean; revision: string | null }) {
  const { pending, run } = useAct();
  const [response, setResponse] = useState("");
  if (!canRelease) return <Notice>This analysis hasn&apos;t been paid for — there&apos;s nothing to release.</Notice>;
  return (
    <div className="space-y-4">
      {revision && (
        <Notice tone="warning" title="Customer's revision request">
          {revision}
        </Notice>
      )}
      {revision && (
        <Field label="What you changed (internal record)" htmlFor="rev-response">
          <Textarea id="rev-response" value={response} onChange={(e) => setResponse(e.target.value)} rows={3} />
        </Field>
      )}
      {!hasNote && <p className="text-sm text-warning">Save a personal note before releasing.</p>}
      <Button size="lg" loading={pending} disabled={!hasNote} onClick={() => confirm("Release the final report and email the customer?") && run(() => releaseAction(analysisId, response))} data-testid="release">
        {revision ? "Release revised report" : "Release final report"}
      </Button>
    </div>
  );
}

export function DeletePhotosButton({ analysisId }: { analysisId: string }) {
  const { pending, run } = useAct();
  return (
    <Button size="sm" variant="ghost" loading={pending} onClick={() => confirm("Permanently delete this customer's photos?") && run(() => deletePhotosAction(analysisId))}>
      Delete photos now
    </Button>
  );
}
