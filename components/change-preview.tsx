interface ChangePreviewProps {
  previews: Array<{ before: string; after: string; field: string }>;
}

export function ChangePreview({ previews }: ChangePreviewProps) {
  if (!previews.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Preview changes after selecting cleanup rules.
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-slate-900">Preview Changes</h2>
      <div className="space-y-3">
        {previews.map((item, index) => (
          <div key={`${item.field}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">{item.field}</div>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Before</div>
                <div className="rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-700">
                  {item.before || "—"}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">After</div>
                <div className="rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-700">
                  {item.after || "—"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
