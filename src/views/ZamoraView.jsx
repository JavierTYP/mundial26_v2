import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import SelectMenu from "../components/SelectMenu.jsx";
import { parseCsv } from "../utils/csv.js";
import { apiGetMyZamora, apiPutMyZamora } from "../utils/api.js";
import { loadZamora, saveZamora } from "../utils/zamoraStorage.js";
import porterosCsv from "../../data/porteros.csv?raw";

function normalizePick(pick) {
  const row = pick && typeof pick === "object" ? pick : {};
  return {
    team: String(row?.team ?? ""),
    goalkeeper: String(row?.goalkeeper ?? ""),
  };
}

export default function ZamoraView({ userEmail, predictionsLocked = false }) {
  const { teamsByGroup, goalkeepersByTeam } = useMemo(() => {
    const rows = parseCsv(porterosCsv);
    const byGroup = new Map();
    const goalkeepers = new Map();

    rows.forEach((r) => {
      const grupo = String(r.grupo ?? "").trim();
      const equipo = String(r.equipo ?? "").trim();
      const portero = String(r.portero ?? "").trim();
      if (!equipo || !portero) return;
      const groupKey = grupo || "Otros";
      if (!byGroup.has(groupKey)) byGroup.set(groupKey, new Set());
      byGroup.get(groupKey).add(equipo);
      if (!goalkeepers.has(equipo)) goalkeepers.set(equipo, new Set());
      goalkeepers.get(equipo).add(portero);
    });

    const teamsByGroupObj = {};
    [...byGroup.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "es"))
      .forEach(([group, set]) => {
        teamsByGroupObj[group] = [...set].sort((a, b) => a.localeCompare(b, "es"));
      });

    const goalkeepersByTeamObj = {};
    [...goalkeepers.entries()].forEach(([team, set]) => {
      goalkeepersByTeamObj[team] = [...set].sort((a, b) => a.localeCompare(b, "es"));
    });

    return { teamsByGroup: teamsByGroupObj, goalkeepersByTeam: goalkeepersByTeamObj };
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
        const r = await apiGetMyZamora();
        if (cancelled) return;
        const normalized = normalizePick(r?.pick ?? null);
        skipSaveRef.current = true;
        setPick(normalized);
        lastSavedRef.current = JSON.stringify(normalized);
        setSaveStatus(null);
      } catch {
        const loaded = loadZamora(userEmail);
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
      await apiPutMyZamora(normalized);
      lastSavedRef.current = JSON.stringify(normalized);
      setSaveStatus("saved");
      saveZamora(userEmail, normalized);
    } catch {
      setSaveStatus("error");
      saveZamora(userEmail, pick);
    } finally {
      setIsSaving(false);
    }
  }

  const keepers = pick.team ? goalkeepersByTeam[pick.team] ?? [] : [];
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
            <h2 className="text-2xl font-black tracking-tight">Guante de oro</h2>
            <p className="text-sm text-slate-300">Portero menos goleado</p>
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
              const allowed = team ? goalkeepersByTeam[team] ?? [] : [];
              const nextKeeper = allowed.includes(pick.goalkeeper) ? pick.goalkeeper : "";
              setPick((prev) => ({ ...prev, team, goalkeeper: nextKeeper }));
            }}
          />

          <SelectMenu
            label="Portero"
            placeholder={pick.team ? "Selecciona portero" : "Selecciona un equipo primero"}
            value={pick.goalkeeper}
            disabled={predictionsLocked || !userEmail || !pick.team}
            searchable={keepers.length > 10}
            options={keepers.map((gk) => ({ value: gk, label: gk }))}
            onChange={(goalkeeper) => setPick((prev) => ({ ...prev, goalkeeper }))}
          />
        </div>
      </Card>
    </section>
  );
}
