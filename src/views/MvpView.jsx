import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import SelectMenu from "../components/SelectMenu.jsx";
import { parseCsv } from "../utils/csv.js";
import { apiGetMyMvp, apiPutMyMvp } from "../utils/api.js";
import { loadMvp, saveMvp } from "../utils/mvpStorage.js";
import goleadoresCsv from "../../data/goleadores.csv?raw";

function normalizePick(pick) {
  const row = pick && typeof pick === "object" ? pick : {};
  return {
    team: String(row?.team ?? ""),
    player: String(row?.player ?? ""),
  };
}

export default function MvpView({ userEmail, predictionsLocked = false }) {
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

  const [pick, setPick] = useState(() => normalizePick(null));
  const skipSaveRef = useRef(true);
  const lastSavedRef = useRef(JSON.stringify(normalizePick(null)));
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // "saved" | "error" | null

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userEmail) {
        skipSaveRef.current = true;
        setPick(normalizePick(null));
        lastSavedRef.current = JSON.stringify(normalizePick(null));
        return;
      }
      try {
        const r = await apiGetMyMvp();
        if (cancelled) return;
        const normalized = normalizePick(r?.pick ?? null);
        skipSaveRef.current = true;
        setPick(normalized);
        lastSavedRef.current = JSON.stringify(normalized);
        setSaveStatus(null);
      } catch {
        const loaded = loadMvp(userEmail);
        if (cancelled) return;
        const normalized = normalizePick(loaded.pick);
        skipSaveRef.current = true;
        setPick(normalized);
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
  }, [pick]);

  const isDirty = useMemo(() => {
    return JSON.stringify(normalizePick(pick)) !== lastSavedRef.current;
  }, [pick]);

  async function handleSave() {
    if (!userEmail) return;
    if (predictionsLocked) return;
    if (!isDirty) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const normalized = normalizePick(pick);
      await apiPutMyMvp(normalized);
      lastSavedRef.current = JSON.stringify(normalized);
      setSaveStatus("saved");
      saveMvp(userEmail, normalized);
    } catch {
      setSaveStatus("error");
      saveMvp(userEmail, pick);
    } finally {
      setIsSaving(false);
    }
  }

  const teamOptions = useMemo(() => {
    const out = [];
    Object.entries(teamsByGroup).forEach(([group, teams]) => {
      teams.forEach((team) => out.push({ value: team, label: team, group }));
    });
    return out;
  }, [teamsByGroup]);

  const players = pick.team ? playersByTeam[pick.team] ?? [] : [];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-tight">Balón de oro</h2>
            <p className="text-sm text-slate-300">Mejor jugador del torneo.</p>
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SelectMenu
            label="Equipo"
            placeholder="Selecciona equipo"
            value={pick.team}
            disabled={predictionsLocked || !userEmail}
            options={teamOptions}
            onChange={(team) => {
              const allowed = team ? playersByTeam[team] ?? [] : [];
              const nextPlayer = allowed.includes(pick.player) ? pick.player : "";
              setPick((prev) => ({ ...prev, team, player: nextPlayer }));
            }}
          />

          <SelectMenu
            label="Jugador"
            placeholder={pick.team ? "Selecciona jugador" : "Selecciona un equipo primero"}
            value={pick.player}
            disabled={predictionsLocked || !userEmail || !pick.team}
            searchable={players.length > 10}
            options={players.map((p) => ({ value: p, label: p }))}
            onChange={(player) => setPick((prev) => ({ ...prev, player }))}
          />
        </div>
      </Card>
    </section>
  );
}
