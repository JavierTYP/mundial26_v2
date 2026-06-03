import { useEffect, useMemo, useRef, useState } from "react";

function normalizeText(v) {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function useOutsideClose({ open, onClose, refs }) {
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      const target = e.target;
      if (!target) return;
      const hit = refs.some((r) => r.current && r.current.contains(target));
      if (!hit) onClose();
    }
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, refs]);
}

export default function SelectMenu({
  label,
  placeholder = "Selecciona…",
  value,
  onChange,
  options = [],
  disabled = false,
  searchable = true,
  className = "",
}) {
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    const q = normalizeText(query).trim();
    if (!q) return options;
    return options.filter((o) => normalizeText(`${o.label} ${o.group ?? ""}`).includes(q));
  }, [options, query]);

  const grouped = useMemo(() => {
    const out = [];
    const seen = new Map();
    for (const o of filtered) {
      const key = String(o.group ?? "");
      if (!seen.has(key)) {
        seen.set(key, []);
        out.push([key, seen.get(key)]);
      }
      seen.get(key).push(o);
    }
    return out;
  }, [filtered]);

  useOutsideClose({
    open,
    onClose: () => setOpen(false),
    refs: [rootRef, panelRef],
  });

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = setTimeout(() => {
      if (searchable) searchRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [open, searchable]);

  const id = useMemo(() => `sm_${Math.random().toString(36).slice(2)}`, []);
  const panelId = `${id}_panel`;

  return (
    <label ref={rootRef} className={`grid gap-2 ${className}`}>
      {label ? (
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
      ) : null}

      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm shadow-sm outline-none transition ${
            disabled
              ? "cursor-not-allowed border-slate-800 bg-slate-950/20 text-slate-500"
              : "border-slate-700/80 bg-slate-950/30 text-slate-100 hover:border-slate-600 focus:border-slate-500 focus:ring-2 focus:ring-blue-500/30"
          }`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={panelId}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen((v) => !v);
          }}
        >
          <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-slate-400"}`}>
            {selected ? selected.label : placeholder}
          </span>
          <span className="text-slate-400">▾</span>
        </button>

        {open ? (
          <div
            ref={panelRef}
            id={panelId}
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl shadow-black/40 backdrop-blur"
          >
            {searchable ? (
              <div className="border-b border-slate-800 p-2">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar…"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none ring-1 ring-black/5 placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            ) : null}

            <div className="max-h-[60vh] overflow-auto p-2">
              {grouped.length ? (
                grouped.map(([group, list]) => (
                  <div key={group || "_"} className="py-1">
                    {group ? (
                      <div className="px-2 pb-1 pt-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                        {group}
                      </div>
                    ) : null}
                    <div className="grid gap-1">
                      {list.map((o) => {
                        const isSelected = o.value === value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                              isSelected
                                ? "bg-blue-500/20 text-blue-100 ring-1 ring-blue-500/30"
                                : "text-slate-100 hover:bg-slate-900/70"
                            }`}
                            onClick={() => {
                              onChange?.(o.value);
                              setOpen(false);
                            }}
                          >
                            <div className="min-w-0 truncate">{o.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-3 py-6 text-center text-sm text-slate-400">Sin resultados</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </label>
  );
}

