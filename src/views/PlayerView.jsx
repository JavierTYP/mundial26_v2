import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import cromoImg from "../assets/cromo.png";
import { apiScoreboard } from "../utils/api.js";

function fallbackNick(email) {
  const s = String(email ?? "").trim();
  if (!s) return "-";
  const at = s.indexOf("@");
  const nick = (at >= 0 ? s.slice(0, at) : s).trim();
  return nick || s;
}

export default function PlayerView({ userEmail }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void apiScoreboard(null)
      .then((r) => {
        if (!cancelled) setData(r);
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

  const me = useMemo(() => {
    const email = String(userEmail ?? "").trim().toLowerCase();
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    if (!email) return null;
    return rows.find((r) => String(r?.email ?? "").trim().toLowerCase() === email) ?? null;
  }, [data?.rows, userEmail]);

  const nick = me?.nick?.trim() ? me.nick.trim() : fallbackNick(userEmail);
  const emailLabel = String(userEmail ?? "").trim() || "-";
  const pointsRaw = me?.points;
  const pointsNum = typeof pointsRaw === "number" ? pointsRaw : Number(pointsRaw);
  const points = Number.isFinite(pointsNum) ? pointsNum : 0;
  const exactHitsRaw = me?.exactHits;
  const exactHitsNum = typeof exactHitsRaw === "number" ? exactHitsRaw : Number(exactHitsRaw);
  const exactHits = Number.isFinite(exactHitsNum) ? exactHitsNum : 0;
  const outcomeHitsRaw = me?.outcomeHits;
  const outcomeHitsNum = typeof outcomeHitsRaw === "number" ? outcomeHitsRaw : Number(outcomeHitsRaw);
  const outcomeHits = Number.isFinite(outcomeHitsNum) ? outcomeHitsNum : 0;
  const balonDeOroPointsRaw = me?.balonDeOroPoints;
  const balonDeOroPointsNum =
    typeof balonDeOroPointsRaw === "number" ? balonDeOroPointsRaw : Number(balonDeOroPointsRaw);
  const balonDeOroPoints = Number.isFinite(balonDeOroPointsNum) ? balonDeOroPointsNum : 0;
  const botaDeOroPointsRaw = me?.botaDeOroPoints;
  const botaDeOroPointsNum =
    typeof botaDeOroPointsRaw === "number" ? botaDeOroPointsRaw : Number(botaDeOroPointsRaw);
  const botaDeOroPoints = Number.isFinite(botaDeOroPointsNum) ? botaDeOroPointsNum : 0;
  const guanteDeOroPointsRaw = me?.guanteDeOroPoints;
  const guanteDeOroPointsNum =
    typeof guanteDeOroPointsRaw === "number" ? guanteDeOroPointsRaw : Number(guanteDeOroPointsRaw);
  const guanteDeOroPoints = Number.isFinite(guanteDeOroPointsNum) ? guanteDeOroPointsNum : 0;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Jugador</h2>
        <p className="text-sm text-slate-300">Información de jugador.</p>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead className="hidden md:table-header-group">
              <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-300">
                <th className="px-4 py-3">CROMO</th>
                <th className="px-4 py-3">DATOS</th>
              </tr>
            </thead>
            <tbody>
              <tr className="block border-t border-slate-800 align-top md:table-row">
                <td className="block px-4 py-4 md:table-cell">
                  <div className="mb-2 text-left text-xs font-black uppercase tracking-wide text-slate-300 md:hidden">
                    CROMO
                  </div>
                  <div className="w-[min(360px,70vw)]">
                    <div className="relative">
                      <img
                        src={cromoImg}
                        alt="Cromo del jugador"
                        className="h-auto w-full select-none"
                        loading="eager"
                        decoding="async"
                      />
                      <div className="pointer-events-none absolute inset-0">
                        <div className="absolute left-[47%] top-[67%] w-[78%] -translate-x-1/2 text-center font-black leading-none text-slate-950">
                          <div className="text-[clamp(14px,3.7vw,24px)] tracking-wide">
                            {nick.toUpperCase()}
                          </div>
                          <div className="mt-1 text-[clamp(11px,2.9vw,16px)] font-semibold text-slate-950/95">
                            {emailLabel}
                          </div>
                        </div>
                        <div className="absolute left-[47%] top-[84%] w-[86%] -translate-x-1/2 text-center font-black leading-none text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]">
                          <div className="text-[clamp(14px,3.8vw,24px)] tracking-wide">
                            {loading ? "…" : `${points} PUNTOS`}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      {loading ? "Cargando puntuación..." : "Puntuación basada en resultados reales."}
                    </div>
                  </div>
                </td>
                <td className="block px-4 py-4 md:table-cell">
                  <div className="mb-2 text-left text-xs font-black uppercase tracking-wide text-slate-300 md:hidden">
                    DATOS
                  </div>
                  <div className="grid gap-2 text-sm text-slate-200">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">NICK:</div>
                      <div className="font-black text-slate-100">{nick}</div>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">EMAIL:</div>
                      <div className="font-mono text-xs text-slate-200">{emailLabel}</div>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        ACIERTOS (con resultado):
                      </div>
                      <div className="font-black text-slate-100">{loading ? "…" : exactHits}</div>
                      <div className="text-xs font-semibold text-slate-500">Número de aciertos con resultado</div>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        ACIERTOS (sin resultado):
                      </div>
                      <div className="font-black text-slate-100">{loading ? "…" : outcomeHits}</div>
                      <div className="text-xs font-semibold text-slate-500">Número de aciertos sin resultado</div>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">BALÓN DE ORO:</div>
                      <div className="font-black text-slate-100">{loading ? "…" : balonDeOroPoints}</div>
                      <div className="text-xs font-semibold text-slate-500">+10 puntos extra</div>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">BOTA DE ORO:</div>
                      <div className="font-black text-slate-100">{loading ? "…" : botaDeOroPoints}</div>
                      <div className="text-xs font-semibold text-slate-500">+10 puntos extra</div>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">GUANTE DE ORO:</div>
                      <div className="font-black text-slate-100">{loading ? "…" : guanteDeOroPoints}</div>
                      <div className="text-xs font-semibold text-slate-500">+10 puntos extra</div>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">PUNTOS:</div>
                      <div className="font-black text-blue-200">{loading ? "…" : points}</div>
                      <div className="text-xs font-semibold text-slate-500">Numero total de puntos</div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
