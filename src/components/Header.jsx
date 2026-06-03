import { differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";
import Badge from "./Badge.jsx";
import Button from "./Button.jsx";
import logoImg from "../assets/logo.png";
import userImg from "../assets/user.png";

function countdownParts(targetDate) {
  const now = new Date();
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return null;
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0 };

  const days = differenceInDays(target, now);
  const afterDays = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const hours = differenceInHours(target, afterDays);
  const afterHours = new Date(afterDays.getTime() + hours * 60 * 60 * 1000);
  const minutes = differenceInMinutes(target, afterHours);

  return { days, hours, minutes };
}

export default function Header({
  torneo,
  lastSavedLabel,
  onExport,
  onSaveBackup,
  onRestore,
  onReset,
  onToggleSidebar,
  userEmail,
  onLogout,
  onExportPredictions,
  onOpenPlayer,
}) {
  const parts = countdownParts(torneo?.fechaInicio);
  const avatarInner = (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900/60 ring-1 ring-slate-800">
      <img
        src={userImg}
        alt="Usuario"
        className="h-8 w-8 rounded-full object-cover"
        loading="eager"
        decoding="async"
      />
    </div>
  );

  const avatar = onOpenPlayer ? (
    <button
      type="button"
      className="rounded-2xl outline-none ring-offset-2 ring-offset-slate-950 focus-visible:ring-2 focus-visible:ring-red-500/70"
      aria-label="Ver jugador"
      onClick={onOpenPlayer}
    >
      {avatarInner}
    </button>
  ) : (
    avatarInner
  );

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
          {/* Mobile: menú arriba + título + línea separadora */}
          <div className="md:hidden">
            <div className="flex items-center gap-3">
              {onToggleSidebar ? (
                <button
                  type="button"
                  className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900/60 ring-1 ring-slate-800"
                  aria-label="Abrir menú"
                  onClick={onToggleSidebar}
                >
                  <span className="text-lg font-black text-slate-200">≡</span>
                </button>
              ) : (
                <div className="h-11 w-11" aria-hidden="true" />
              )}
              <div className="flex-1 text-center text-lg font-black tracking-tight text-slate-100">
                MUNDIAL 2026 <span className="text-red-500">— TYPSA</span>
              </div>
              {avatar}
            </div>
            <div className="mt-3 h-px w-full bg-red-500/60" />
          </div>

          {/* Logo + metadatos (desktop incluye también el título) */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600/15 p-1 ring-1 ring-red-500/40">
              <img
                src={logoImg}
                alt="Logo TYPSA"
                className="h-full w-full object-contain"
                loading="eager"
                decoding="async"
              />
            </div>
            <div>
              <div className="hidden text-lg font-black tracking-tight md:block">
                MUNDIAL 2026 <span className="text-red-500">— TYPSA</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <Badge tone="red">{torneo?.nombre ?? "FIFA World Cup 2026"}</Badge>
                {parts && (
                  <Badge tone="neutral">
                    Comienza en {parts.days}d {parts.hours}h {parts.minutes}m
                  </Badge>
                )}
                {lastSavedLabel && (
                  <span className="text-slate-400">{lastSavedLabel}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {userEmail ? (
            <div className="mr-2 flex w-full min-w-0 items-center gap-2 text-xs text-slate-300 md:w-auto">
              <span className="min-w-0 flex-1 truncate rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1">
                {userEmail}
              </span>
              {onLogout ? (
                <button
                  type="button"
                  className="shrink-0 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-1 font-bold uppercase tracking-wide text-slate-200 hover:bg-slate-900/70"
                  onClick={onLogout}
                >
                  Salir
                </button>
              ) : null}
            </div>
          ) : null}
          {onExportPredictions ? (
            <Button variant="secondary" onClick={onExportPredictions}>
              Exportar pronósticos
            </Button>
          ) : null}
          {onExport ? (
            <Button variant="secondary" onClick={onExport}>
              Exportar JSON
            </Button>
          ) : null}
          {onSaveBackup ? (
            <Button variant="secondary" onClick={onSaveBackup}>
              Guardar backup
            </Button>
          ) : null}
          {onRestore ? (
            <Button variant="secondary" onClick={onRestore}>
              Restaurar backup
            </Button>
          ) : null}
          {onReset ? (
            <Button variant="danger" onClick={onReset}>
              Reiniciar
            </Button>
          ) : null}
          <div className="hidden md:block">{avatar}</div>
        </div>
      </div>
    </header>
  );
}
