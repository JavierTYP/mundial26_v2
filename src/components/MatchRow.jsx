import { useEffect, useMemo, useRef, useState } from "react";
import Button from "./Button.jsx";
import Flag from "./Flag.jsx";

function clampGoals(value) {
  if (value === "" || value == null) return null;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(10, n));
}

export default function MatchRow({
  partido,
  equipoLocal,
  equipoVisitante,
  resultado,
  onUpdate,
  onDraft,
  readOnly = false,
  saveLabel = "Actualizar",
  autoSave = false,
  fallbackToPartidoResultado = true,
}) {
  const effectiveResultado = fallbackToPartidoResultado ? resultado ?? partido.resultado : resultado ?? null;
  const [local, setLocal] = useState(effectiveResultado?.local ?? "");
  const [visitante, setVisitante] = useState(effectiveResultado?.visitante ?? "");
  const [flash, setFlash] = useState(false);
  const timeoutRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const lastAutoSavedRef = useRef({ local: null, visitante: null });

  const canSave = useMemo(() => {
    const l = clampGoals(local);
    const v = clampGoals(visitante);
    return l != null && v != null;
  }, [local, visitante]);

  useEffect(() => {
    setLocal(effectiveResultado?.local ?? "");
    setVisitante(effectiveResultado?.visitante ?? "");
    lastAutoSavedRef.current = {
      local: effectiveResultado?.local ?? null,
      visitante: effectiveResultado?.visitante ?? null,
    };
  }, [partido.id, effectiveResultado?.local, effectiveResultado?.visitante]);

  useEffect(() => {
    return () => {
      if (autoSave && !readOnly) {
        const l = clampGoals(local);
        const v = clampGoals(visitante);
        if (l != null && v != null) {
          const last = lastAutoSavedRef.current;
          if (last.local !== l || last.visitante !== v) {
            lastAutoSavedRef.current = { local: l, visitante: v };
            onUpdate(l, v);
          }
        }
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [autoSave, local, onUpdate, readOnly, visitante]);

  useEffect(() => {
    if (!autoSave) return;
    if (readOnly) return;
    if (!canSave) return;

    const l = clampGoals(local);
    const v = clampGoals(visitante);
    if (l == null || v == null) return;

    const last = lastAutoSavedRef.current;
    if (last.local === l && last.visitante === v) return;

    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(() => {
      lastAutoSavedRef.current = { local: l, visitante: v };
      onUpdate(l, v);
      setFlash(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setFlash(false), 450);
    }, 550);

    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [autoSave, canSave, local, onUpdate, readOnly, visitante]);

  function save() {
    if (readOnly) return;
    const l = clampGoals(local);
    const v = clampGoals(visitante);
    if (l == null || v == null) return;
    onUpdate(l, v);
    setFlash(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setFlash(false), 450);
  }

  function draft(nextLocal, nextVisitante) {
    if (readOnly) return;
    const l = clampGoals(nextLocal);
    const v = clampGoals(nextVisitante);
    onDraft?.(l, v);
  }

  return (
    <div
      className={`rounded-2xl border px-3 py-3 ${
        flash ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-800 bg-slate-950/30"
      }`}
    >
      <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr] md:gap-6">
        <div className="min-w-0 md:justify-self-end md:text-right">
          <div className="truncate font-semibold">
            <span className="mr-2 inline-flex align-middle">
              <Flag team={equipoLocal} className="h-4 w-4" />
            </span>
            <span className="align-middle">{equipoLocal?.nombre ?? "—"}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          <label className="sr-only" htmlFor={`${partido.id}-l`}>
            Goles local
          </label>
          <input
            id={`${partido.id}-l`}
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-14 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-center font-black text-slate-100 outline-none ring-blue-500/30 focus:ring-2"
            type="number"
            min={0}
            max={10}
            value={local}
            disabled={readOnly}
            onChange={(e) => {
              const next = e.target.value;
              setLocal(next);
              draft(next, visitante);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) save();
            }}
          />
          <span className="text-slate-400">vs</span>
          <label className="sr-only" htmlFor={`${partido.id}-v`}>
            Goles visitante
          </label>
          <input
            id={`${partido.id}-v`}
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-14 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-center font-black text-slate-100 outline-none ring-blue-500/30 focus:ring-2"
            type="number"
            min={0}
            max={10}
            value={visitante}
            disabled={readOnly}
            onChange={(e) => {
              const next = e.target.value;
              setVisitante(next);
              draft(local, next);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) save();
            }}
          />
        </div>

        <div className="min-w-0 md:justify-self-start md:text-left">
          <div className="truncate font-semibold">
            <span className="align-middle">{equipoVisitante?.nombre ?? "—"}</span>{" "}
            <span className="ml-2 inline-flex align-middle">
              <Flag team={equipoVisitante} className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      {!readOnly && !autoSave ? (
        <div className="mt-2 flex justify-end md:mt-0">
          <Button variant="secondary" onClick={save} disabled={!canSave}>
            {saveLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
