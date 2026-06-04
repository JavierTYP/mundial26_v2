import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import { apiAdminExportPredictions, apiAdminPredictions, apiAdminPredictionsSummary } from "../utils/api.js";
import { normalizeKnockoutPicks } from "./EliminatoriasView.jsx";

const KNOCKOUT_ROUNDS = [
  { key: "16avos", label: "16avos" },
  { key: "8avos", label: "8avos" },
  { key: "4tos", label: "4tos" },
  { key: "semis", label: "Semis" },
  { key: "final", label: "Final" },
  { key: "campeon", label: "Campeón" },
];

function allGroupIds(grupos) {
  return Object.keys(grupos ?? {}).sort((a, b) => a.localeCompare(b, "es"));
}

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
      if (e?.id) map.set(e.id, e);
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

function formatPrediction(prediction) {
  if (!prediction) return "Pendiente";
  const l = prediction?.local;
  const v = prediction?.visitante;
  if (l == null || v == null) return "Pendiente";
  return `${l} - ${v}`;
}

function rowKey(row) {
  return `${row.phase}:${row.match?.id ?? row.id}`;
}

function formatTeamName(teamsById, teamId) {
  const id = String(teamId ?? "").trim();
  if (!id) return "Pendiente";
  return teamsById.get(id)?.nombre ?? id;
}

function formatAwardPick(pick, field = "player") {
  const name = String(pick?.[field] ?? "").trim();
  const team = String(pick?.team ?? "").trim();
  return {
    name: name || "Pendiente",
    team: team || "-",
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeFilename(value) {
  return String(value ?? "usuario")
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "usuario";
}

function buildPredictionsPdfHtml({ email, rows, knockoutPicks, awardRows, teamsById, predictions }) {
  const today = new Date().toLocaleDateString("es-ES");
  const matchRows = rows
    .map((row) => {
      const match = row.match ?? null;
      const localId = matchLocalId(match);
      const awayId = matchAwayId(match);
      const localTeam = localId ? teamsById.get(localId) : null;
      const awayTeam = awayId ? teamsById.get(awayId) : null;
      const prediction = predictions?.[match?.id] ?? null;

      return `
        <tr>
          <td>${escapeHtml(row.phase)}</td>
          <td class="mono">${escapeHtml(match?.id ?? "-")}</td>
          <td>${escapeHtml(localTeam?.nombre ?? (localId ? String(localId) : "Por definir"))}</td>
          <td>${escapeHtml(awayTeam?.nombre ?? (awayId ? String(awayId) : "Por definir"))}</td>
          <td class="score">${escapeHtml(formatPrediction(prediction))}</td>
        </tr>`;
    })
    .join("");

  const knockoutRows = KNOCKOUT_ROUNDS.map((round) => {
    const teams = knockoutPicks?.[round.key] ?? [];
    const names = teams.length
      ? teams.map((teamId) => formatTeamName(teamsById, teamId)).join(", ")
      : "Pendiente";
    return `
        <tr>
          <td>${escapeHtml(round.label)}</td>
          <td>${escapeHtml(names)}</td>
        </tr>`;
  }).join("");

  const awards = awardRows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.award)}</td>
          <td class="score">${escapeHtml(row.name)}</td>
          <td>${escapeHtml(row.team)}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Pronósticos - ${escapeHtml(email)}</title>
  <style>
    @page { margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 11px;
      line-height: 1.35;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-end;
      border-bottom: 2px solid #111827;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    h1 { margin: 0; font-size: 22px; letter-spacing: 0; }
    h2 { margin: 18px 0 8px; font-size: 14px; }
    .meta { color: #475569; text-align: right; }
    .user { margin-top: 4px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th {
      background: #e5e7eb;
      border: 1px solid #cbd5e1;
      color: #0f172a;
      font-size: 9px;
      letter-spacing: .04em;
      padding: 6px;
      text-align: left;
      text-transform: uppercase;
    }
    td {
      border: 1px solid #d7dee8;
      padding: 6px;
      vertical-align: top;
    }
    .mono { font-family: "Cascadia Mono", Consolas, monospace; font-size: 10px; }
    .score { font-weight: 800; white-space: nowrap; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Pronósticos Mundial 2026</h1>
      <div class="user">${escapeHtml(email)}</div>
    </div>
    <div class="meta">Exportado el ${escapeHtml(today)}</div>
  </header>

  <h2>Fase de grupos</h2>
  <table>
    <thead>
      <tr>
        <th>Fase</th>
        <th>Partido</th>
        <th>Local</th>
        <th>Visitante</th>
        <th>Pronóstico</th>
      </tr>
    </thead>
    <tbody>${matchRows || `<tr><td colspan="5">No hay partidos para mostrar todavía.</td></tr>`}</tbody>
  </table>

  <h2>Eliminatorias</h2>
  <table>
    <thead>
      <tr>
        <th>Fase</th>
        <th>Equipos seleccionados</th>
      </tr>
    </thead>
    <tbody>${knockoutRows}</tbody>
  </table>

  <h2>Premios individuales</h2>
  <table>
    <thead>
      <tr>
        <th>Premio</th>
        <th>Pronóstico</th>
        <th>Selección</th>
      </tr>
    </thead>
    <tbody>${awards}</tbody>
  </table>
</body>
</html>`;
}

export default function AdminPredictionsView({ torneo, grupos, users }) {
  const groupIds = useMemo(() => allGroupIds(grupos), [grupos]);
  const [selectedEmail, setSelectedEmail] = useState(users?.[0]?.email ?? "");
  const [predictions, setPredictions] = useState({});
  const [knockoutPicks, setKnockoutPicks] = useState(() => normalizeKnockoutPicks(null));
  const [awards, setAwards] = useState({ goleadores: [], mvp: null, zamora: null });
  const [mode, setMode] = useState("user"); // user | summary
  const [summary, setSummary] = useState(null);
  const [summaryStatus, setSummaryStatus] = useState("idle"); // idle | loading | loaded | error

  useEffect(() => {
    setSelectedEmail((prev) => {
      if (users?.some((u) => u.email === prev)) return prev;
      return users?.[0]?.email ?? "";
    });
  }, [users]);

  useEffect(() => {
    if (!selectedEmail) {
      setPredictions({});
      setKnockoutPicks(normalizeKnockoutPicks(null));
      setAwards({ goleadores: [], mvp: null, zamora: null });
      return;
    }
    void apiAdminPredictions(selectedEmail)
      .then((r) => {
        setPredictions(r.predictions ?? {});
        setKnockoutPicks(normalizeKnockoutPicks(r.knockout?.picks));
        setAwards({
          goleadores: Array.isArray(r.goleadores?.picks) ? r.goleadores.picks : [],
          mvp: r.mvp?.pick ?? null,
          zamora: r.zamora?.pick ?? null,
        });
      })
      .catch(() => {
        setPredictions({});
        setKnockoutPicks(normalizeKnockoutPicks(null));
        setAwards({ goleadores: [], mvp: null, zamora: null });
      });
  }, [selectedEmail]);

  useEffect(() => {
    if (mode !== "summary") return;
    setSummaryStatus("loading");
    void apiAdminPredictionsSummary()
      .then((r) => {
        setSummary(r);
        setSummaryStatus("loaded");
      })
      .catch(() => {
        setSummary(null);
        setSummaryStatus("error");
      });
  }, [mode]);

  const teamsById = useMemo(() => buildTeamsIndex(grupos), [grupos]);
  const normalizedKnockoutPicks = useMemo(
    () => normalizeKnockoutPicks(knockoutPicks),
    [knockoutPicks],
  );

  const rows = useMemo(() => {
    const out = [];
    const groupOrder = groupIds.length ? groupIds : "ABCDEFGHIJKL".split("");
    for (const gid of groupOrder) {
      const group = grupos?.[gid] ?? null;
      const matches = Array.isArray(group?.partidos) ? [...group.partidos] : [];
      matches.sort((a, b) => matchNumber(a?.id) - matchNumber(b?.id));
      for (const match of matches) out.push({ phase: `Grupo ${gid}`, match });
    }
    return out;
  }, [groupIds, grupos]);

  const awardRows = useMemo(() => {
    const mvp = formatAwardPick(awards.mvp, "player");
    const zamora = formatAwardPick(awards.zamora, "goalkeeper");
    const goleadores = Array.isArray(awards.goleadores) ? awards.goleadores : [];
    const goleadoresNames = goleadores.map((p) => formatAwardPick(p, "player").name).filter(Boolean);
    const goleadoresTeams = goleadores.map((p) => formatAwardPick(p, "player").team).filter((v) => v && v !== "-");
    return [
      { award: "Balón de oro", name: mvp.name, team: mvp.team },
      {
        award: "Bota de oro",
        name: goleadoresNames.length ? goleadoresNames.join(", ") : "Pendiente",
        team: goleadoresTeams.length ? goleadoresTeams.join(", ") : "-",
      },
      { award: "Guante de oro", name: zamora.name, team: zamora.team },
    ];
  }, [awards]);

  function exportSelectedUserPdf() {
    if (!selectedEmail) return;
    const html = buildPredictionsPdfHtml({
      email: selectedEmail,
      rows,
      knockoutPicks: normalizedKnockoutPicks,
      awardRows,
      teamsById,
      predictions,
    });
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.document.title = `pronosticos_${safeFilename(selectedEmail)}.pdf`;
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Pronósticos</h2>
        <p className="text-sm text-slate-300">
          Solo ver: se leen desde el servidor del administrador.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,320px)_1fr] md:items-end">
          <label className="block">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-300">
              Usuario
            </div>
            <select
              disabled={mode !== "user"}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-black/5 focus:border-blue-500/50 focus:ring-blue-500/20"
              value={selectedEmail}
              onChange={(e) => setSelectedEmail(e.target.value)}
            >
              {users?.length ? (
                users.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.email}
                  </option>
                ))
              ) : (
                <option value="">(Sin usuarios)</option>
              )}
            </select>
          </label>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <Button
              variant={mode === "user" ? "secondary" : "primary"}
              onClick={() => setMode("user")}
            >
              Por usuario
            </Button>
            <Button
              variant={mode === "summary" ? "secondary" : "primary"}
              onClick={() => setMode("summary")}
            >
              Resumen
            </Button>
            <Button
              variant="secondary"
              disabled={mode !== "user" || !selectedEmail}
              onClick={exportSelectedUserPdf}
            >
              Exportar a PDF
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                const blob = await apiAdminExportPredictions();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `pronosticos_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Exportar todos
            </Button>
          </div>
        </div>
      </Card>

      {mode === "user" ? (
        <>
          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-200">
                Fase de grupos
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full border-collapse text-sm">
                <thead className="bg-slate-950/60">
                  <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Fase</th>
                    <th className="px-4 py-3">Partido</th>
                    <th className="px-4 py-3">Local</th>
                    <th className="px-4 py-3">Visitante</th>
                    <th className="px-4 py-3">Pronóstico</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-300" colSpan={5}>
                        No hay partidos para mostrar todavía.
                      </td>
                    </tr>
                  ) : null}
                  {rows.map((row) => {
                    const match = row.match ?? null;
                    const localId = matchLocalId(match);
                    const awayId = matchAwayId(match);
                    const localTeam = localId ? teamsById.get(localId) : null;
                    const awayTeam = awayId ? teamsById.get(awayId) : null;
                    const prediction = predictions?.[match?.id] ?? null;

                    return (
                      <tr key={rowKey(row)} className="border-t border-slate-800">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-200">
                          {row.phase}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-300">
                          {match?.id ?? "-"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-100">
                          {localTeam?.nombre ?? (localId ? String(localId) : "Por definir")}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-100">
                          {awayTeam?.nombre ?? (awayId ? String(awayId) : "Por definir")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-black text-slate-100">
                          {formatPrediction(prediction)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-200">
                Eliminatorias
              </h3>
            </div>
            <div className="divide-y divide-slate-800">
              {KNOCKOUT_ROUNDS.map((round) => {
                const teams = normalizedKnockoutPicks[round.key] ?? [];
                return (
                  <div key={round.key} className="grid gap-2 px-4 py-4 md:grid-cols-[120px_1fr]">
                    <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                      {round.label}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {teams.length ? (
                        teams.map((teamId) => (
                          <span
                            key={teamId}
                            className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-slate-100 ring-1 ring-slate-700/70"
                          >
                            {formatTeamName(teamsById, teamId)}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">Pendiente</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-200">
                Premios individuales
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[560px] w-full border-collapse text-sm">
                <thead className="bg-slate-950/60">
                  <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Premio</th>
                    <th className="px-4 py-3">Pronóstico</th>
                    <th className="px-4 py-3">Selección</th>
                  </tr>
                </thead>
                <tbody>
                  {awardRows.map((row) => (
                    <tr key={row.award} className="border-t border-slate-800">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-200">
                        {row.award}
                      </td>
                      <td className="px-4 py-3 font-black text-slate-100">{row.name}</td>
                      <td className="px-4 py-3 text-slate-200">{row.team}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}

      {mode === "summary" ? (
        summaryStatus === "loading" ? (
          <Card className="p-4">
            <div className="text-sm text-slate-300">Cargando resumen…</div>
          </Card>
        ) : summaryStatus === "error" ? (
          <Card className="p-4">
            <div className="text-sm text-slate-300">
              No se pudo cargar el resumen. Revisa que el servidor esté levantado y que el endpoint
              de resumen esté disponible.
            </div>
          </Card>
        ) : summary?.matches?.length ? (
          <Card className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-300">
                    <th className="sticky left-0 z-10 bg-slate-950/80 px-3 py-2">Usuario</th>
                    {summary.matches.map((m) => (
                      <th key={m.id} className="whitespace-nowrap border-l border-slate-800 px-3 py-2">
                        {m.localNombre ?? m.idLocal ?? "â€”"} vs {m.visitanteNombre ?? m.idVisitante ?? "â€”"}
                        <div className="text-[11px] font-semibold text-slate-500">{m.id}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.users?.map((u) => (
                    <tr key={u.email} className="border-t border-slate-800">
                      <td className="sticky left-0 z-10 bg-slate-950/80 px-3 py-2 font-semibold text-slate-100">
                        {u.email}
                      </td>
                      {summary.matches.map((m) => {
                        const v = summary.predictionsByUser?.[u.email]?.[m.id];
                        const label =
                          v && v.local != null && v.visitante != null ? `${v.local}-${v.visitante}` : "â€”";
                        return (
                          <td
                            key={`${u.email}:${m.id}`}
                            className="border-l border-slate-800 px-3 py-2 text-center font-black text-slate-100"
                          >
                            {label}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="p-4">
            <div className="text-sm text-slate-300">No hay datos para mostrar.</div>
          </Card>
        )
      ) : null}

    </section>
  );
}
