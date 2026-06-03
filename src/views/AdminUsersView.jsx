import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import { ADMIN_EMAIL } from "../utils/authStorage.js";

function PaidToggle({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={[
        "relative h-8 w-[86px] select-none rounded-full border p-1 transition",
        checked ? "border-emerald-500/40 bg-emerald-500/80" : "border-red-500/40 bg-red-500/80",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/30",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3 text-[11px] font-black tracking-wide text-white/95",
          "drop-shadow-sm",
        ].join(" ")}
      >
        <span className={checked ? "opacity-100" : "opacity-40"}>ON</span>
        <span className={checked ? "opacity-40" : "opacity-100"}>OFF</span>
      </span>

      <span
        aria-hidden="true"
        className={[
          "pointer-events-none relative block h-6 w-6 rounded-full bg-white shadow-md ring-1 ring-black/10 transition-transform",
          checked ? "translate-x-[52px]" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

export default function AdminUsersView({
  users,
  onDeleteUser,
  onClearNonAdminUsers,
  onSetUserPaid,
  predictionsLocked,
  onTogglePredictionsLocked,
  resultsLocked,
  onToggleResultsLocked,
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Usuarios</h2>
        <p className="text-sm text-slate-300">
          Administración (usuarios en base de datos).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={predictionsLocked ? "danger" : "secondary"}
          onClick={() => onTogglePredictionsLocked?.(!predictionsLocked)}
        >
          {predictionsLocked ? "Desbloquear pronósticos" : "Bloquear pronósticos"}
        </Button>
        <Button
          variant={resultsLocked ? "danger" : "secondary"}
          onClick={() => onToggleResultsLocked?.(!resultsLocked)}
        >
          {resultsLocked ? "Desbloquear resultados" : "Bloquear resultados"}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            // eslint-disable-next-line no-alert
            if (!confirm("¿Borrar todos los usuarios no-admin?")) return;
            onClearNonAdminUsers();
          }}
        >
          Borrar no-admin
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-2">
          {users.length ? (
            users.map((u) => {
              const isAdmin = u.email === ADMIN_EMAIL || u.role === "admin";
              return (
                <div
                  key={u.email}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-100">
                      {u.email}
                    </div>
                    {u.nick ? (
                      <div className="truncate text-xs font-semibold text-slate-300">
                        Nick: {u.nick}
                      </div>
                    ) : null}
                    <div className="text-xs text-slate-400">
                      {isAdmin ? "admin" : "user"} · creado {u.createdAt ?? "—"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                      <PaidToggle
                        checked={Boolean(u.paid)}
                        disabled={!onSetUserPaid}
                        onChange={(next) => onSetUserPaid?.(u.email, next)}
                      />
                      <span>Paid</span>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={isAdmin}
                      onClick={() => {
                        // eslint-disable-next-line no-alert
                        if (!confirm(`¿Borrar usuario ${u.email}?`)) return;
                        onDeleteUser(u.email);
                      }}
                    >
                      Borrar
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-slate-300">No hay usuarios registrados.</div>
          )}
        </div>
      </Card>
    </section>
  );
}
