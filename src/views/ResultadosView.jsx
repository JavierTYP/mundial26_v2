import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import Flag from "../components/Flag.jsx";
import { apiResults, apiScoreboard } from "../utils/api.js";

function matchNumber(id) {
  const m = String(id ?? "").match(/(\d+)(?!.*\d)/);
  return m ? Number.parseInt(m[0], 10) : Number.NaN;
}

function buildTeamsIndex(grupos) {
  const map = new Map();
  for (const g of Object.values(grupos ?? {})) {
    const equipos = Array.isArray(g?.equipos)
      ? g.equipos
      : g?.equipos && typeof g.equipos === "object"
        ? Object.values(g.equipos)
        : [];
    for (const e of equipos) {
      if (!e?.id) continue;
      map.set(e.id, e);
    }
  }
  return map;
}

function matchLocalId(match) {
  return match?.local ?? match?.idLocal ?? null;
}

function matchAwayId(match) {
  return match?.visitante ?? match?.idVisitante ?? null;
}

function formatScore(prediction) {
  const l = prediction?.local;
  const v = prediction?.visitante;
  if (l == null || v == null) return "-";
  return `${l}-${v}`;
}

function formatUserLabel(user) {
  const label = String(user?.label ?? user?.nick ?? user?.email ?? "").trim();
  if (label.length <= 6) return label;
  return `${label.slice(0, 5)}...`;
}

function formatTeamCode(team, fallback) {
  const label = String(team?.nombre ?? fallback ?? "").trim();
  const compact = label.replace(/\s+/g, "");
  return (compact || label).slice(0, 3).toLocaleUpperCase("es");
}

function sameScore(a, b) {
  if (!a || !b) return false;
  if (a.local == null || a.visitante == null || b.local == null || b.visitante == null) return false;
  return Number(a.local) === Number(b.local) && Number(a.visitante) === Number(b.visitante);
}

function TeamLabel({ team, fallback }) {
  const label = team?.nombre ?? fallback ?? "Por definir";
  const code = formatTeamCode(team, fallback);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={label}>
      <Flag team={team} name={label} className="h-4 w-5 shrink-0 rounded-[2px] object-cover" />
      <span className="font-mono text-xs font-black text-slate-100">{code || "---"}</span>
    </span>
  );
}

export default function ResultadosView({ torneo }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([apiResults(), apiScoreboard(null)])
      .then(([results, scoreboard]) => {
        if (!cancelled) {
          setData({
            ...results,
            scoreboardRows: Array.isArray(scoreboard?.rows) ? scoreboard.rows : [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const teamsById = useMemo(() => buildTeamsIndex(torneo?.grupos), [torneo?.grupos]);

  const rows = useMemo(() => {
    const out = [];
    const groupOrder = Object.keys(torneo?.grupos ?? {}).sort((a, b) => a.localeCompare(b, "es"));
    for (const gid of groupOrder) {
      const group = torneo?.grupos?.[gid] ?? null;
      const matches = Array.isArray(group?.partidos) ? [...group.partidos] : [];
      matches.sort((a, b) => matchNumber(a?.id) - matchNumber(b?.id));
      for (const match of matches) {
        out.push({
          phase: `Grupo ${gid}`,
          match,
          localId: matchLocalId(match),
          awayId: matchAwayId(match),
        });
      }
    }
    return out;
  }, [torneo?.grupos]);

  const users = useMemo(() => {
    const rawUsers = data?.users ?? [];
    const adminEmail = data?.adminEmail ?? rawUsers[0]?.email ?? null;
    const adminUser = rawUsers.find((u) => u.email === adminEmail) ?? null;
    const rankByEmail = new Map(
      (data?.scoreboardRows ?? []).map((row, index) => [row.email, index]),
    );
    const rest = rawUsers
      .filter((u) => u.email !== adminEmail)
      .sort((a, b) => {
        const rankA = rankByEmail.has(a.email) ? rankByEmail.get(a.email) : Number.POSITIVE_INFINITY;
        const rankB = rankByEmail.has(b.email) ? rankByEmail.get(b.email) : Number.POSITIVE_INFINITY;
        if (rankA !== rankB) return rankA - rankB;
        const labelA = String(a.label ?? a.nick ?? a.email ?? "");
        const labelB = String(b.label ?? b.nick ?? b.email ?? "");
        return labelA.localeCompare(labelB, "es", { sensitivity: "base" });
      });

    return adminUser ? [adminUser, ...rest] : rest;
  }, [data?.adminEmail, data?.scoreboardRows, data?.users]);

  const adminEmail = data?.adminEmail ?? users[0]?.email ?? null;
  const predictionsByUser = data?.predictionsByUser ?? {};
  const minTableWidth = `${Math.max(740, 150 + users.length * 72)}px`;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Resultados</h2>
        <p className="text-sm text-slate-300">
          Pronosticos de fase de grupos por participante. Los marcadores iguales al admin se marcan en verde.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Partidos</div>
            <div className="mt-1 font-black text-slate-100">{rows.length}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Participantes</div>
            <div className="mt-1 font-black text-slate-100">
              {loading ? "Cargando..." : users.length}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Referencia</div>
            <div className="mt-1 font-black text-red-200">ADMIN</div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-200">
            Fase de grupos
          </h3>
        </div>

        <div className="max-h-[72vh] overflow-auto">
          <table
            className="w-full border-separate border-spacing-0 text-sm"
            style={{ minWidth: minTableWidth }}
          >
            <thead>
              <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-300">
                <th className="sticky left-0 top-0 z-30 w-[150px] bg-slate-950 px-3 py-3 shadow-[1px_0_0_0_rgba(30,41,59,1)]">
                  Partido
                </th>
                {users.map((u) => (
                  <th
                    key={u.email}
                    className="sticky top-0 z-20 w-[72px] border-l border-slate-800 bg-slate-950 px-2 py-3 text-center"
                    title={u.label ?? u.nick ?? u.email}
                  >
                    <span className="block whitespace-nowrap">{formatUserLabel(u)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-300" colSpan={Math.max(1, users.length + 1)}>
                    No hay partidos de fase de grupos para mostrar todavia.
                  </td>
                </tr>
              ) : null}

              {rows.map((row) => {
                const localTeam = row.localId ? teamsById.get(row.localId) : null;
                const awayTeam = row.awayId ? teamsById.get(row.awayId) : null;
                const adminResult = row.match?.resultado ?? null;

                return (
                  <tr key={`${row.phase}:${row.match?.id}`} className="group">
                    <td className="sticky left-0 z-10 border-t border-slate-800 bg-slate-950 px-3 py-3 shadow-[1px_0_0_0_rgba(30,41,59,1)] group-hover:bg-slate-900">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex min-w-0 items-center gap-1.5 font-semibold text-slate-100">
                          <TeamLabel team={localTeam} fallback={row.localId} />
                          <span className="shrink-0 text-[10px] font-black uppercase text-slate-500">vs</span>
                          <TeamLabel team={awayTeam} fallback={row.awayId} />
                        </div>
                        <div className="font-mono text-[11px] font-semibold text-slate-500">
                          {row.phase} - {row.match?.id ?? "-"}
                        </div>
                      </div>
                    </td>
                    {users.map((u) => {
                      const isAdminColumn = u.email === adminEmail;
                      const score = isAdminColumn
                        ? adminResult
                        : predictionsByUser?.[u.email]?.[row.match?.id] ?? null;
                      const matchesAdmin = !isAdminColumn && sameScore(score, adminResult);
                      const isPending = score?.local == null || score?.visitante == null;

                      return (
                        <td
                          key={`${u.email}:${row.match?.id}`}
                          className="border-l border-t border-slate-800 px-2 py-3 text-center align-middle group-hover:bg-slate-900/70"
                        >
                          <span
                            className={`inline-flex min-w-[44px] justify-center rounded-md px-2 py-1 font-black ${
                              isAdminColumn
                                ? "text-red-200"
                                : matchesAdmin
                                ? "bg-emerald-950/50 text-emerald-200 ring-1 ring-emerald-500/50"
                                : isPending
                                  ? "text-slate-600"
                                  : "text-slate-100"
                            }`}
                          >
                            {formatScore(score)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-300" colSpan={Math.max(1, users.length + 1)}>
                    Cargando resultados...
                  </td>
                </tr>
              ) : null}

              {!loading && !users.length ? (
                <tr>
                  <td className="px-4 py-6 text-slate-300" colSpan={1}>
                    No se pudieron cargar los participantes.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
