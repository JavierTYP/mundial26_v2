export default function Notification({ tone = "info", message, onClose }) {
  if (!message) return null;

  const toneStyles =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
      : tone === "error"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
        : "border-blue-500/30 bg-blue-500/10 text-blue-100";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4">
      <div
        className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ring-1 ring-black/5 ${toneStyles}`}
        role="status"
        aria-live="polite"
      >
        <div className="pt-0.5">{message}</div>
        {onClose ? (
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide text-white/80 hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="Cerrar notificación"
          >
            Cerrar
          </button>
        ) : null}
      </div>
    </div>
  );
}

