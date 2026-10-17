"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { importCsvAction } from "@/app/actions/admin-catalog";
import type { ImportPreview } from "@/lib/services/admin-catalog";
import { Button } from "../ui/button";
import { Notice } from "../ui/misc";

export function ImportForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<{ preview: ImportPreview; committed: boolean } | null>(null);
  const [pending, start] = useTransition();
  function run(commit: boolean) {
    const form = ref.current;
    if (!form) return;
    const fd = new FormData(form);
    fd.set("commit", commit ? "yes" : "no");
    start(async () => {
      const r = await importCsvAction(fd);
      if (!r.ok) return void toast.error(r.message);
      setResult({ preview: r.data!, committed: commit && r.data!.ok });
      if (commit && r.data!.ok) toast.success("Import complete.");
    });
  }
  return (
    <div className="space-y-5">
      <form ref={ref} onSubmit={(e) => { e.preventDefault(); run(false); }} className="space-y-4 border border-line bg-paper p-5">
        <label htmlFor="csv" className="block text-xs font-medium">CSV file (max 2 MB, 2,000 rows)</label>
        <input id="csv" name="file" type="file" accept=".csv,text/csv" required className="text-sm" onChange={() => setResult(null)} />
        <div className="flex gap-3">
          <Button type="submit" variant="secondary" loading={pending}>Validate (dry run)</Button>
          <Button type="button" loading={pending} disabled={!result?.preview.ok || result.committed} onClick={() => run(true)}>Import</Button>
        </div>
      </form>
      {result && (
        <Notice tone={result.preview.ok ? "success" : "danger"} title={result.committed ? "Imported" : result.preview.ok ? "Validation passed" : "Validation failed — nothing was imported"}>
          <p>{result.preview.created} to create · {result.preview.updated} to update</p>
          {result.preview.errors.length > 0 && (
            <ul className="mt-2 max-h-72 list-disc overflow-y-auto pl-5 text-xs">
              {result.preview.errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
        </Notice>
      )}
    </div>
  );
}
