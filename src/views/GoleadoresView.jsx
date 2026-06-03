import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import SelectMenu from "../components/SelectMenu.jsx";
import { parseCsv } from "../utils/csv.js";
import { apiGetMyGoleadores, apiPutMyGoleadores } from "../utils/api.js";
import { loadGoleadores, saveGoleadores } from "../utils/goleadoresStorage.js";
import goleadoresCsv from "../../data/goleadores.csv?raw";

function normalizePicks(picks) {
  const base = Array.isArray(picks) ? picks : [];
  return [
    {
      team: String(base[0]?.team ?? ""),
      player: String(base[0]?.player ?? ""),
    },
  ];
}

export default function GoleadoresView({ userEmail, predictionsLocked = false }) {
  const { teamsByGroup, playersByTeam } = useMemo(() => {
    const rows = parseCsv(goleadoresCsv);
    const byGroup = new Map();
    const players = new Map();

    rows.forEach((r) => {
      const grupo = String(r.grupo ?? "").trim();
      const equipo = String(r.equipo ?? "").trim();
      const jugador = String(r.jugador ?? "").trim();
      if (!equipo || !jugador) return;
      const groupKey = grupo || "Otros";
      if (!byGroup.has(groupKey)) byGroup.set(groupKey, new Set());
      byGroup.get(groupKey).add(equipo);
      if (!players.has(equipo)) players.set(equipo, new Set());
      players.get(equipo).add(jugador);
    });

    const teamsByGroupObj = {};
    [...byGroup.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "es"))
      .forEach(([group, set]) => {
        teamsByGroupObj[group] = [...set].sort((a, b) => a.localeCompare(b, "es"));
      });

    const playersByTeamObj = {};
    [...players.entries()].forEach(([team, set]) => {
      playersByTeamObj[team] = [...set].sort((a, b) => a.localeCompare(b, "es"));
    });

    return { teamsByGroup: teamsByGroupObj, playersByTeam: playersByTeamObj };
  }, []);

  const [picks, setPicks] = useState(() => normalizePicks([]));
  const skipSaveRef = useRef(true);
  const lastSavedRef = useRef(JSON.stringify(normalizePicks([])));
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // "saved" | "error" | null

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userEmail) {
        skipSaveRef.current = true;
        setPicks(normalizePicks([]));
        lastSavedRef.current = JSON.stringify(normalizePicks([]));
        return;
      }
      try {
        const r = await apiGetMyGoleadores();
        if (cancelled) return;
        const normalized = normalizePicks(r?.picks ?? []);
        skipSaveRef.current = true;
        setPicks(normalized);
        lastSavedRef.current = JSON.stringify(normalized);
        setSaveStatus(null);
      } catch {
        // Fallback: local storage (useful in dev/offline).
        const loaded = loadGoleadores(userEmail);
        if (cancelled) return;
        const normalized = normalizePicks(loaded.picks);
        skipSaveRef.current = true;
        setPicks(normalized);
        lastSavedRef.current = JSON.stringify(normalized);
        setSaveStatus(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    setSaveStatus(null);
  }, [picks]);

  const isDirty = useMemo(() => {
    return JSON.stringify(normalizePicks(picks)) !== lastSavedRef.current;
  }, [picks]);

  async function handleSave() {
    if (!userEmail) return;
    if (predictionsLocked) return;
    if (!isDirty) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const normalized = normalizePicks(picks);
      await apiPutMyGoleadores(normalized);
      lastSavedRef.current = JSON.stringify(normalized);
      setSaveStatus("saved");
      // Keep a local fallback copy too.
      saveGoleadores(userEmail, normalized);
    } catch {
      setSaveStatus("error");
      // Fallback to local storage if backend is unavailable.
      saveGoleadores(userEmail, picks);
    } finally {
      setIsSaving(false);
    }
  }

  const updatePick = (idx, next) => {
    setPicks((prev) => {
      const copy = prev.slice();
      copy[idx] = { ...copy[idx], ...next };
      return copy;
    });
  };

  const teamOptions = useMemo(() => {
    const out = [];
    Object.entries(teamsByGroup).forEach(([group, teams]) => {
      teams.forEach((team) => out.push({ value: team, label: team, group }));
    });
    return out;
  }, [teamsByGroup]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-tight">Bota de oro</h2>
            <p className="text-sm text-slate-300">
              Elige el máximo goleador (equipo + jugador).
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus === "saved" ? (
              <div className="text-xs font-semibold text-emerald-300">Guardado</div>
            ) : saveStatus === "error" ? (
              <div className="text-xs font-semibold text-rose-300">No se pudo guardar</div>
            ) : isDirty ? (
              <div className="text-xs font-semibold text-amber-300">Cambios sin guardar</div>
            ) : (
              <div className="text-xs font-semibold text-slate-400">Sin cambios</div>
            )}
            <Button
              variant="secondary"
              onClick={handleSave}
              disabled={!isDirty || isSaving || !userEmail || predictionsLocked}
            >
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </div>

      <Card className="p-4">
        {(() => {
          const current = picks[0] ?? { team: "", player: "" };
          const players = current.team ? playersByTeam[current.team] ?? [] : [];
          return (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <SelectMenu
                label="Equipo"
                placeholder="Selecciona equipo"
                value={current.team}
                disabled={predictionsLocked || !userEmail}
                options={teamOptions}
                onChange={(team) => {
                  const allowed = team ? playersByTeam[team] ?? [] : [];
                  const nextPlayer = allowed.includes(current.player) ? current.player : "";
                  updatePick(0, { team, player: nextPlayer });
                }}
              />

              <SelectMenu
                label="Jugador"
                placeholder={current.team ? "Selecciona jugador" : "Selecciona un equipo primero"}
                value={current.player}
                disabled={predictionsLocked || !userEmail || !current.team}
                searchable={players.length > 10}
                options={players.map((p) => ({ value: p, label: p }))}
                onChange={(player) => updatePick(0, { player })}
              />
            </div>
          );
        })()}
      </Card>
    </section>
  );
}
