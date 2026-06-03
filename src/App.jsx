import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";

import initialData from "./data/mundial2026.json";
import Header from "./components/Header.jsx";
import Card from "./components/Card.jsx";
import GroupTabs from "./components/GroupTabs.jsx";
import GroupCard from "./components/GroupCard.jsx";
import ClassifiedGrid from "./components/ClassifiedGrid.jsx";
import Sidebar from "./components/Sidebar.jsx";
import GroupSummaryCard from "./components/GroupSummaryCard.jsx";
import KnockoutBracket from "./components/KnockoutBracket.jsx";
import KnockoutRoundView from "./views/KnockoutRoundView.jsx";
import LoginView from "./views/LoginView.jsx";
import Notification from "./components/Notification.jsx";
import AdminUsersView from "./views/AdminUsersView.jsx";
import AdminPredictionsView from "./views/AdminPredictionsView.jsx";
import AdminScoreboardView from "./views/AdminScoreboardView.jsx";
import AdminGoleadoresResultView from "./views/AdminGoleadoresResultView.jsx";
import AdminMvpResultView from "./views/AdminMvpResultView.jsx";
import AdminZamoraResultView from "./views/AdminZamoraResultView.jsx";
import ScoreboardView from "./views/ScoreboardView.jsx";
import KnockoutPredictionsView from "./views/KnockoutPredictionsView.jsx";
import ResumenView from "./views/ResumenView.jsx";
import PremiosView from "./views/PremiosView.jsx";
import GoleadoresView from "./views/GoleadoresView.jsx";
import ZamoraView from "./views/ZamoraView.jsx";
import MvpView from "./views/MvpView.jsx";
import PlayerView from "./views/PlayerView.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

import { advanceRound, buildDieciseisavos, winnerId } from "./utils/knockout.js";
import { buildPredictedKnockoutTournament } from "./utils/predictedKnockout.js";
import { withFifaRankingsOnGroups } from "./utils/fifaRanking.js";
import {
  ADMIN_EMAIL,
  clearSession,
} from "./utils/authStorage.js";
import {
  exportPredictionsJson,
} from "./utils/predictionsStorage.js";
import {
  apiAdminClearNonAdminUsers,
  apiAdminDeleteUser,
  apiAdminPredictions,
  apiAdminSettings,
  apiAdminSetUserPaid,
  apiAdminUsers,
  apiGetMyPredictions,
  apiGetTournamentState,
  apiLogout,
  apiMe,
  apiPutMyPrediction,
  apiPutTournamentState,
} from "./utils/api.js";

function mergeParticipants(prev, next) {
  const byId = new Map(prev.map((m) => [m.id, m]));
  return next.map((m) => {
    const old = byId.get(m.id);
    if (!old) return m;
    return {
      ...old,
      local: m.local,
      visitante: m.visitante,
    };
  });
}

function mergeFinal(prev, next) {
  return {
    ...prev,
    local: next.local,
    visitante: next.visitante,
  };
}

function mergeThirdPlace(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  return {
    ...prev,
    local: next.local,
    visitante: next.visitante,
  };
}

function participantsSignature(matches) {
  return matches.map((m) => `${m.id}:${m.local ?? ""}-${m.visitante ?? ""}`).join("|");
}

function matchNumber(id) {
  // Use the last numeric suffix so ids like "16-D10" sort by 10 (not 16).
  const m = String(id ?? "").match(/(\d+)(?!.*\d)/);
  return m ? Number.parseInt(m[0], 10) : Number.NaN;
}

function migrateTournamentStateIds(state) {
  if (!state || typeof state !== "object") return state;

  const isNew =
    Object.values(state.grupos ?? {}).some((g) =>
      (g?.partidos ?? []).some((p) => String(p?.id ?? "").startsWith("FG-")),
    ) ||
    (state.dieciseisavos ?? []).some((m) => String(m?.id ?? "").startsWith("16-")) ||
    (state.octavos ?? []).some((m) => String(m?.id ?? "").startsWith("08-"));

  if (isNew) return state;

  const mapGroupId = (id) => (/^[A-L][1-6]$/.test(String(id ?? "")) ? `FG-${id}` : id);
  const mapKoId = (id) => {
    const s = String(id ?? "");
    if (/^D\\d{1,2}$/.test(s)) return `16-${s}`;
    if (/^O\\d{1,2}$/.test(s)) return `08-${s}`;
    if (/^C\\d{1,2}$/.test(s)) return `04-${s}`;
    if (/^S\\d{1,2}$/.test(s)) return `02-${s}`;
    if (s === "F") return "FI-F1";
    return s;
  };

  const grupos = {};
  for (const [gid, g] of Object.entries(state.grupos ?? {})) {
    grupos[gid] = {
      ...g,
      partidos: (g?.partidos ?? []).map((p) => ({ ...p, id: mapGroupId(p.id) })),
    };
  }

  const dieciseisavos = (state.dieciseisavos ?? []).map((m) => ({ ...m, id: mapKoId(m.id) }));
  const octavos = (state.octavos ?? []).map((m) => ({
    ...m,
    id: mapKoId(m.id),
    emparejamiento:
      typeof m.emparejamiento === "string"
        ? m.emparejamiento.replace(/\\bD(\\d{1,2})\\b/g, (_s, n) => `16-D${n}`)
        : m.emparejamiento,
  }));
  const cuartos = (state.cuartos ?? []).map((m) => ({
    ...m,
    id: mapKoId(m.id),
    emparejamiento:
      typeof m.emparejamiento === "string"
        ? m.emparejamiento.replace(/\\bO(\\d{1,2})\\b/g, (_s, n) => `08-O${n}`)
        : m.emparejamiento,
  }));
  const semifinales = (state.semifinales ?? []).map((m) => ({
    ...m,
    id: mapKoId(m.id),
    emparejamiento:
      typeof m.emparejamiento === "string"
        ? m.emparejamiento.replace(/\\bC(\\d{1,2})\\b/g, (_s, n) => `04-C${n}`)
        : m.emparejamiento,
  }));
  const final = state.final
    ? {
        ...state.final,
        id: mapKoId(state.final.id),
        emparejamiento:
          typeof state.final.emparejamiento === "string"
            ? state.final.emparejamiento.replace(/\\bS(\\d{1,2})\\b/g, (_s, n) => `02-S${n}`)
            : state.final.emparejamiento,
      }
    : state.final;

  return { ...state, grupos, dieciseisavos, octavos, cuartos, semifinales, final };
}

function normalizeTournamentStateAgainstTemplate(state, template) {
  if (!state || typeof state !== "object") return state;
  if (!template || typeof template !== "object") return state;

  const normalizeListByIndex = (tplList, list) => {
    const tpl = Array.isArray(tplList) ? tplList : [];
    const cur = Array.isArray(list) ? list : [];

    const out = [];
    for (let i = 0; i < tpl.length; i += 1) {
      const t = tpl[i] ?? null;
      const m = cur[i] ?? null;
      if (!t) continue;

      const { id: _id, emparejamiento: _emparejamiento, ...rest } = m ?? {};
      out.push({
        ...t,
        ...rest,
        id: t.id,
        emparejamiento: typeof t.emparejamiento === "string" ? t.emparejamiento : rest.emparejamiento,
      });
    }
    return out;
  };

  const groupIds = Object.keys(template?.grupos ?? {});
  const grupos = {};
  for (const gid of groupIds) {
    const tplGroup = template?.grupos?.[gid] ?? null;
    const group = state?.grupos?.[gid] ?? null;
    if (!tplGroup) continue;

    const tplMatches = [...(tplGroup?.partidos ?? [])].sort(
      (a, b) => matchNumber(a?.id) - matchNumber(b?.id),
    );
    const curMatches = [...(group?.partidos ?? [])].sort(
      (a, b) => matchNumber(a?.id) - matchNumber(b?.id),
    );
    grupos[gid] = {
      ...tplGroup,
      ...group,
      partidos: normalizeListByIndex(tplMatches, curMatches),
    };
  }

  const dieciseisavos = normalizeListByIndex(template?.dieciseisavos, state?.dieciseisavos);
  const octavos = normalizeListByIndex(template?.octavos, state?.octavos);
  const cuartos = normalizeListByIndex(template?.cuartos, state?.cuartos);
  const semifinales = normalizeListByIndex(template?.semifinales, state?.semifinales);

  const finalTemplate = template?.final ?? null;
  const finalState = state?.final ?? null;
  const final =
    finalTemplate && finalState
      ? {
          ...finalTemplate,
          ...finalState,
          id: finalTemplate.id,
          emparejamiento:
            typeof finalTemplate.emparejamiento === "string"
              ? finalTemplate.emparejamiento
              : finalState.emparejamiento,
        }
      : finalTemplate ?? finalState;

  return { ...state, grupos, dieciseisavos, octavos, cuartos, semifinales, final };
}

function hydrateTournamentState(rawState) {
  const migrated = migrateTournamentStateIds(rawState ?? initialData);
  const normalized = normalizeTournamentStateAgainstTemplate(migrated, initialData);
  const grupos = withFifaRankingsOnGroups(normalized.grupos);
  if (grupos === normalized.grupos) return normalized;
  return {
    ...normalized,
    grupos,
  };
}

function migratePredictionKeys(predictions) {
  // Migrate old IDs (A1..L6, D1..D16, O1..O8, C1..C4, S1..S2, F, 3P) and legacy KO-prefixed keys
  // to the new unique scheme:
  // - Groups: FG-*
  // - 16avos: 16-*
  // - 8avos: 08-*
  // - 4tos: 04-*
  // - Semis: 02-*
  // - 3er puesto: 3P-31
  // - Final: FI-F1
  const next = {};

  function mapId(rawId, forceKo = false) {
    const id = String(rawId ?? "");
    if (!id) return null;

    // Already new format
    if (
      id.startsWith("FG-") ||
      id.startsWith("16-") ||
      id.startsWith("08-") ||
      id.startsWith("04-") ||
      id.startsWith("02-") ||
      id === "3P-31" ||
      id === "FI-F1"
    ) {
      return id;
    }

    // Group stage (old)
    if (!forceKo && /^[A-L][1-6]$/.test(id)) return `FG-${id}`;

    // Knockout (old)
    if (/^D\d{1,2}$/.test(id)) return `16-${id}`;
    if (/^O\d{1,2}$/.test(id)) return `08-${id}`;
    if (/^C\d{1,2}$/.test(id)) return `04-${id}`;
    if (/^S\d{1,2}$/.test(id)) return `02-${id}`;
    if (id === "3P") return "3P-31";
    if (id === "F") return "FI-F1";

    // Legacy KO-prefixed (from previous fix)
    if (id.startsWith("KO:")) return mapId(id.slice(3), true);

    return id;
  }

  for (const [k, v] of Object.entries(predictions ?? {})) {
    const mappedKey = mapId(k, false);
    if (!mappedKey) continue;
    next[mappedKey] = v;
  }

  return next;
}

function syncKnockoutFromGroups(state) {
  const template = Array.isArray(state.dieciseisavos) ? state.dieciseisavos : initialData.dieciseisavos;
  const syncedDieciseisavos = mergeParticipants(template, buildDieciseisavos(template, state.grupos));
  const nextOctavos = mergeParticipants(state.octavos, advanceRound(state.octavos, syncedDieciseisavos));
  const nextCuartos = mergeParticipants(state.cuartos, advanceRound(state.cuartos, nextOctavos));
  const nextSemis = mergeParticipants(state.semifinales, advanceRound(state.semifinales, nextCuartos));
  const nextFinal = mergeFinal(state.final, advanceRound([state.final], nextSemis)[0]);

  const loserTeamId = (match) => {
    if (!match) return null;
    if (match?.ganador != null) {
      if (match?.local == null || match?.visitante == null) return null;
      if (match.ganador === match.local) return match.visitante;
      if (match.ganador === match.visitante) return match.local;
      return null;
    }
    const l = match?.resultado?.local;
    const v = match?.resultado?.visitante;
    if (l == null || v == null) return null;
    if (match?.local == null || match?.visitante == null) return null;
    if (l > v) return match.visitante;
    if (v > l) return match.local;
    return null;
  };

  const semi1 = nextSemis.find((m) => matchNumber(m?.id) === 1) ?? null;
  const semi2 = nextSemis.find((m) => matchNumber(m?.id) === 2) ?? null;
  const computedThirdPlace = {
    id: "3P-31",
    local: loserTeamId(semi1),
    visitante: loserTeamId(semi2),
    resultado: { local: null, visitante: null },
    ganador: null,
    emparejamiento: "Perdedor 02-S1 vs Perdedor 02-S2",
  };
  const nextThirdPlace = mergeThirdPlace(state.thirdPlace, computedThirdPlace);

  return {
    ...state,
    dieciseisavos: syncedDieciseisavos,
    octavos: nextOctavos,
    cuartos: nextCuartos,
    semifinales: nextSemis,
    final: nextFinal,
    thirdPlace: nextThirdPlace,
  };
}

export default function App() {
  const [user, setUser] = useState(null);
  const [notification, setNotification] = useState(null);
  const [users, setUsers] = useState([]);
  const [predictionsByMatchId, setPredictionsByMatchId] = useState({});
  const [draftPredictionsByMatchId, setDraftPredictionsByMatchId] = useState({});
  const [predictionsLocked, setPredictionsLocked] = useState(false);
  const [resultsLocked, setResultsLocked] = useState(false);

  const [state, setState] = useState(() => syncKnockoutFromGroups(hydrateTournamentState(initialData)));
  const groupIds = useMemo(() => Object.keys(state.grupos), [state.grupos]);
  const [activeGroup, setActiveGroup] = useState(groupIds[0] ?? "A");
  const [activeView, setActiveView] = useState("inicio");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [lastSavedAt, setLastSavedAt] = useState(() => {
    const t = state?.metadata?.ultimaActualizacion;
    return t ? new Date(t) : null;
  });
  const lastSavedAtRef = useRef(lastSavedAt);
  const [nowTick, setNowTick] = useState(() => new Date());
  const importInputRef = useRef(null);

  useEffect(() => {
    if (!notification?.message) return;
    const t = setTimeout(() => setNotification(null), 3500);
    return () => clearTimeout(t);
  }, [notification?.message]);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    lastSavedAtRef.current = lastSavedAt;
  }, [lastSavedAt]);

  async function refreshTournamentState({ force = false } = {}) {
    try {
      const r = await apiGetTournamentState();
      setPredictionsLocked(Boolean(r?.predictionsLocked));
      setResultsLocked(Boolean(r?.resultsLocked));
      const remoteState = r?.state ?? null;
      if (!remoteState) return false;

      const remoteUpdatedAt = r?.updatedAt
        ? new Date(r.updatedAt)
        : remoteState?.metadata?.ultimaActualizacion
          ? new Date(remoteState.metadata.ultimaActualizacion)
          : null;

      const localUpdatedAt = lastSavedAtRef.current;
      const shouldUpdate =
        force ||
        (!localUpdatedAt && remoteUpdatedAt) ||
        (localUpdatedAt && remoteUpdatedAt && remoteUpdatedAt > localUpdatedAt);

      if (!shouldUpdate) return true;

      setState(syncKnockoutFromGroups(hydrateTournamentState(remoteState)));
      setLastSavedAt(remoteUpdatedAt ?? null);
      return true;
    } catch {
      // ignore
      return false;
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const me = await apiMe();
        if (cancelled) return;
        setPredictionsLocked(Boolean(me?.settings?.predictionsLocked));
        setResultsLocked(Boolean(me?.settings?.resultsLocked));
        if (!me?.user) return;
        setUser(me.user);

        const tournamentResp = await apiGetTournamentState();
        const torneoState = tournamentResp?.state ?? null;
        const updatedAt = tournamentResp?.updatedAt ?? null;
        if (!cancelled && torneoState) {
          setState(syncKnockoutFromGroups(hydrateTournamentState(torneoState)));
          const t = updatedAt ?? torneoState?.metadata?.ultimaActualizacion;
          setLastSavedAt(t ? new Date(t) : null);
          setPredictionsLocked(Boolean(tournamentResp?.predictionsLocked));
          setResultsLocked(Boolean(tournamentResp?.resultsLocked));
        }

        if (me.user.role === "admin") {
          const u = await apiAdminUsers();
          if (!cancelled) setUsers(u.users ?? []);
        } else {
          const p = await apiGetMyPredictions();
          if (!cancelled) {
            setPredictionsByMatchId(migratePredictionKeys(p.predictions ?? {}));
            setDraftPredictionsByMatchId({});
            setPredictionsLocked(Boolean(p?.predictionsLocked));
          }
        }
      } catch {
        // ignore: backend might be offline in dev
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.email) return undefined;
    if (isAdmin) return undefined;

    const t = setInterval(() => {
      void refreshTournamentState();
    }, 15_000);

    return () => clearInterval(t);
  }, [isAdmin, user?.email]);

  useEffect(() => {
    if (!user?.email) return;
    if (isAdmin) return;
    if (activeView !== "inicio") return;
    void refreshTournamentState({ force: true });
  }, [activeView, isAdmin, user?.email]);

  useEffect(() => {
    if (!state.grupos[activeGroup]) setActiveGroup(groupIds[0] ?? "A");
  }, [activeGroup, groupIds, state.grupos]);

  useEffect(() => {
    const t = setInterval(() => setNowTick(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setState((prev) => {
      const hydrated = hydrateTournamentState(prev);
      const next = syncKnockoutFromGroups(hydrated);
      if (participantsSignature(prev.dieciseisavos ?? []) === participantsSignature(next.dieciseisavos ?? [])) {
        return hydrated;
      }
      return next;
    });
  }, [state.grupos]);

  useEffect(() => {
    setState((prev) => {
      const next = syncKnockoutFromGroups(prev);
      const octavosSame = participantsSignature(prev.octavos) === participantsSignature(next.octavos);
      const cuartosSame = participantsSignature(prev.cuartos) === participantsSignature(next.cuartos);
      const semisSame = participantsSignature(prev.semifinales) === participantsSignature(next.semifinales);
      const finalSame =
        `${prev.final.local ?? ""}-${prev.final.visitante ?? ""}` === `${next.final.local ?? ""}-${next.final.visitante ?? ""}`;
      if (octavosSame && cuartosSame && semisSame && finalSame) return prev;
      return next;
    });
  }, [state.dieciseisavos, state.octavos, state.cuartos, state.semifinales]);

  const lastSavedLabel = useMemo(() => {
    if (!lastSavedAt) return null;
    const distance = formatDistanceToNowStrict(lastSavedAt, {
      locale: es,
      addSuffix: true,
    });
    return `Guardado ${distance}`;
  }, [lastSavedAt, nowTick]);

  function updateGroupMatch(grupoId, partidoId, local, visitante) {
    if (!isAdmin) {
      setNotification({
        tone: "error",
        message: "Solo el administrador puede introducir resultados reales.",
      });
      return;
    }
    if (resultsLocked) {
      setNotification({ tone: "error", message: "Resultados bloqueados por el administrador." });
      return;
    }

    const hydrated = hydrateTournamentState(state);
    const g = hydrated?.grupos?.[grupoId] ?? null;
    if (!g) return;
    const partidos = (g.partidos ?? []).map((p) => {
      if (p.id !== partidoId) return p;
      return {
        ...p,
        resultado: { local, visitante },
        jugado: local != null && visitante != null,
        confirmado: local != null && visitante != null,
      };
    });
    const nextSnapshot = syncKnockoutFromGroups({
      ...hydrated,
      grupos: {
        ...hydrated.grupos,
        [grupoId]: { ...g, partidos },
      },
      metadata: { ...(hydrated.metadata ?? {}), ultimaActualizacion: new Date().toISOString() },
    });

    setState(nextSnapshot);
    void apiPutTournamentState(nextSnapshot)
      .then((r) => setLastSavedAt(r?.updatedAt ? new Date(r.updatedAt) : new Date()))
      .catch((e) => {
        if (e?.data?.error === "results_locked") setResultsLocked(true);
        void refreshTournamentState({ force: true });
        setNotification({ tone: "error", message: "No se pudieron guardar resultados." });
      });
  }

  function updatePrediction(matchId, local, visitante, winner = undefined) {
    if (!user?.email) return;
    if (isAdmin) return;
    if (predictionsLocked) {
      setNotification({
        tone: "error",
        message: "Pronósticos bloqueados por el administrador.",
      });
      return;
    }
    setPredictionsByMatchId((prev) => {
      const prevRow = prev?.[matchId] ?? null;
      const nextRow = {
        ...(prevRow ?? {}),
        local,
        visitante,
        ...(winner !== undefined ? { winner } : {}),
      };
      const next = { ...(prev ?? {}), [matchId]: nextRow };
      return next;
    });
    setDraftPredictionsByMatchId((prev) => {
      if (!prev?.[matchId]) return prev;
      const { [matchId]: _, ...rest } = prev;
      return rest;
    });
    const winnerToSend =
      winner !== undefined ? winner : (predictionsByMatchId?.[matchId]?.winner ?? null);
    void apiPutMyPrediction(matchId, local, visitante, winnerToSend).catch((e) => {
      if (e?.data?.error === "predictions_locked") {
        setPredictionsLocked(true);
        void apiGetMyPredictions()
          .then((p) => {
            setPredictionsByMatchId(migratePredictionKeys(p.predictions ?? {}));
            setDraftPredictionsByMatchId({});
          })
          .catch(() => {});
      }
      setNotification({
        tone: "error",
        message:
          e?.data?.error === "predictions_locked"
            ? "Pronósticos bloqueados."
            : "Error al guardar pronóstico.",
      });
    });
  }

  function updatePredictionDraft(matchId, local, visitante, winner = undefined) {
    if (!user?.email) return;
    if (isAdmin) return;
    if (predictionsLocked) return;
    setDraftPredictionsByMatchId((prev) => {
      const prevRow = prev?.[matchId] ?? null;
      const nextRow = {
        ...(prevRow ?? {}),
        local,
        visitante,
        ...(winner !== undefined ? { winner } : {}),
      };
      const next = { ...(prev ?? {}), [matchId]: nextRow };
      return next;
    });
  }

  const standingsPredictionsByMatchId = useMemo(() => {
    return { ...(predictionsByMatchId ?? {}), ...(draftPredictionsByMatchId ?? {}) };
  }, [draftPredictionsByMatchId, predictionsByMatchId]);

  const predictedKnockoutTorneo = useMemo(() => {
    return buildPredictedKnockoutTournament(state, standingsPredictionsByMatchId);
  }, [standingsPredictionsByMatchId, state]);

  function updateKnockoutMatch(roundKey, matchId, local, visitante, ganadorPicked = null) {
    if (!isAdmin) {
      setNotification({
        tone: "error",
        message: "Solo el administrador puede introducir resultados reales.",
      });
      return;
    }
    if (resultsLocked) {
      setNotification({ tone: "error", message: "Resultados bloqueados por el administrador." });
      return;
    }

    const hydrated = hydrateTournamentState(state);
    const list = Array.isArray(hydrated?.[roundKey]) ? hydrated[roundKey] : null;
    if (!list) return;

    const nextList = list.map((m) => {
      if (m.id !== matchId) return m;
      const ganador = winnerId({
        ...m,
        resultado: { local, visitante },
        ganador: ganadorPicked ?? m.ganador ?? null,
      });
      return {
        ...m,
        resultado: { local, visitante },
        ganador,
      };
    });

    const nextSnapshot = syncKnockoutFromGroups({
      ...hydrated,
      [roundKey]: nextList,
      metadata: { ...(hydrated.metadata ?? {}), ultimaActualizacion: new Date().toISOString() },
    });

    setState(nextSnapshot);
    void apiPutTournamentState(nextSnapshot)
      .then((r) => setLastSavedAt(r?.updatedAt ? new Date(r.updatedAt) : new Date()))
      .catch((e) => {
        if (e?.data?.error === "results_locked") setResultsLocked(true);
        void refreshTournamentState({ force: true });
        setNotification({ tone: "error", message: "No se pudieron guardar resultados." });
      });
  }

  function updateFinalMatch(matchIdOrLocal, localOrVisitante, visitanteOrGanadorPicked = null, maybeGanadorPicked = null) {
    if (!isAdmin) {
      setNotification({
        tone: "error",
        message: "Solo el administrador puede introducir resultados reales.",
      });
      return;
    }
    if (resultsLocked) {
      setNotification({ tone: "error", message: "Resultados bloqueados por el administrador." });
      return;
    }

    const matchId =
      typeof matchIdOrLocal === "string" ? matchIdOrLocal : "FI-F1";
    const local =
      typeof matchIdOrLocal === "string" ? localOrVisitante : matchIdOrLocal;
    const visitante =
      typeof matchIdOrLocal === "string" ? visitanteOrGanadorPicked : localOrVisitante;
    const ganadorPicked =
      typeof matchIdOrLocal === "string" ? maybeGanadorPicked : visitanteOrGanadorPicked;

    const hydrated = hydrateTournamentState(state);

    const target =
      matchId === "3P-31"
        ? hydrated.thirdPlace ?? { id: "3P-31", local: null, visitante: null, resultado: { local: null, visitante: null } }
        : hydrated.final;

    const ganador = winnerId({
      ...target,
      resultado: { local, visitante },
      ganador: ganadorPicked ?? target?.ganador ?? null,
    });
    const nextSnapshot = syncKnockoutFromGroups({
      ...hydrated,
      ...(matchId === "3P-31"
        ? { thirdPlace: { ...target, resultado: { local, visitante }, ganador } }
        : { final: { ...hydrated.final, resultado: { local, visitante }, ganador } }),
      metadata: { ...(hydrated.metadata ?? {}), ultimaActualizacion: new Date().toISOString() },
    });

    setState(nextSnapshot);
    void apiPutTournamentState(nextSnapshot)
      .then((r) => setLastSavedAt(r?.updatedAt ? new Date(r.updatedAt) : new Date()))
      .catch((e) => {
        if (e?.data?.error === "results_locked") setResultsLocked(true);
        void refreshTournamentState({ force: true });
        setNotification({ tone: "error", message: "No se pudieron guardar resultados." });
      });
  }

  function handleExport() {
    if (!isAdmin) {
      setNotification({ tone: "error", message: "Solo el administrador puede exportar." });
      return;
    }
    const filename = `mundial2026_${new Date().toISOString().slice(0, 10)}`;
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSaveBackup() {
    if (!isAdmin) {
      setNotification({ tone: "error", message: "Solo el administrador puede guardar backups." });
      return;
    }
    const nowIso = new Date().toISOString();
    const filename = `backup_mundial2026_${nowIso.slice(0, 10)}`;
    const payload = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ultimaActualizacion: nowIso },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportPredictions() {
    if (!user?.email) return;
    if (predictionsLocked) {
      setNotification({
        tone: "error",
        message: "El administrador ha bloqueado los pronósticos. No se pueden exportar.",
      });
      return;
    }
    const filename = `pronosticos_${user.email}_${new Date().toISOString().slice(0, 10)}`;
    const payload = exportPredictionsJson(user.email, predictionsByMatchId, state?.torneo);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    if (!isAdmin) {
      setNotification({ tone: "error", message: "Solo el administrador puede reiniciar." });
      return;
    }
    // eslint-disable-next-line no-alert
    if (!confirm("¿Seguro que quieres reiniciar la simulación?")) return;
    setState(initialData);
    setLastSavedAt(new Date());
    setActiveGroup("A");
    setActiveView("inicio");
    void apiPutTournamentState({
      ...initialData,
      metadata: { ...(initialData.metadata ?? {}), ultimaActualizacion: new Date().toISOString() },
    }).catch(() => {
      setNotification({ tone: "error", message: "No se pudo reiniciar en el servidor." });
    });
  }

  function handleRestoreClick() {
    if (!isAdmin) {
      setNotification({
        tone: "error",
        message: "Solo el administrador puede restaurar backups.",
      });
      return;
    }
    importInputRef.current?.click();
  }

  async function handleImportFile(file) {
    if (!isAdmin) {
      setNotification({
        tone: "error",
        message: "Solo el administrador puede restaurar backups.",
      });
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (
        !parsed?.grupos ||
        !parsed?.dieciseisavos ||
        !parsed?.octavos ||
        !parsed?.cuartos ||
        !parsed?.semifinales ||
        !parsed?.final
      ) {
        // eslint-disable-next-line no-alert
        alert("Backup inválido: no parece ser un estado del simulador.");
        return;
      }
      setState(parsed);
      const t = parsed?.metadata?.ultimaActualizacion;
      setLastSavedAt(t ? new Date(t) : new Date());
      void apiPutTournamentState(parsed).catch(() => {
        setNotification({ tone: "error", message: "No se pudo restaurar en el servidor." });
      });
    } catch {
      // eslint-disable-next-line no-alert
      alert("No se pudo leer el archivo. Asegúrate de que sea un JSON válido.");
    }
  }

  function navigate(nextView) {
    setActiveView(nextView);
    setSidebarOpen(false);
    if (!isAdmin && (nextView === "inicio" || nextView === "resumen")) {
      void refreshTournamentState();
    }
  }

  const groupsSorted = useMemo(() => {
    const entries = Object.entries(state.grupos ?? {});
    return entries
      .sort(([a], [b]) => a.localeCompare(b, "es"))
      .map(([, g]) => g);
  }, [state.grupos]);

  if (!user) {
    return (
      <>
        <Notification
          tone={notification?.tone}
          message={notification?.message}
          onClose={() => setNotification(null)}
        />
        <LoginView
          notify={(n) => setNotification(n)}
          onLoggedIn={(nextUser) => {
            setUser(nextUser);
            setSidebarOpen(false);
            setActiveView("inicio");
            setPredictionsLocked(false);
            setPredictionsByMatchId({});
            setUsers([]);
            void apiMe()
              .then((me) => setPredictionsLocked(Boolean(me?.settings?.predictionsLocked)))
              .catch(() => {});
            const tryLoadTournamentState = async () => {
              return refreshTournamentState({ force: true });
            };
            void tryLoadTournamentState().then((ok) => {
              if (!ok) {
                setNotification({
                  tone: "error",
                  message:
                    "No se pudo cargar el estado del torneo. Revisa que el servidor esté activo.",
                });
              }
            });
            // Second attempt shortly after login to avoid rare cookie/proxy timing issues.
            setTimeout(() => {
              void tryLoadTournamentState();
            }, 150);
            if (nextUser?.role === "admin") {
              void apiAdminUsers()
                .then((u) => setUsers(u.users ?? []))
                .catch(() => {});
            } else {
              void apiGetMyPredictions()
                .then((p) => setPredictionsByMatchId(migratePredictionKeys(p.predictions ?? {})))
                .catch(() => {});
            }
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <Notification
        tone={notification?.tone}
        message={notification?.message}
        onClose={() => setNotification(null)}
      />
      <Header
        torneo={state.torneo}
        lastSavedLabel={lastSavedLabel}
        onExport={isAdmin ? handleExport : null}
        onSaveBackup={isAdmin ? handleSaveBackup : null}
        onRestore={isAdmin ? handleRestoreClick : null}
        onReset={isAdmin ? handleReset : null}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        userEmail={user?.email}
        onOpenPlayer={() => navigate("player")}
        onExportPredictions={!isAdmin && !predictionsLocked ? handleExportPredictions : null}
        onLogout={() => {
          void apiLogout().catch(() => {});
          clearSession();
          setUser(null);
          setSidebarOpen(false);
          setActiveView("inicio");
          setNotification({ tone: "info", message: "Sesión cerrada." });
        }}
      />

      <input
        ref={importInputRef}
        className="hidden"
        type="file"
        accept="application/json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
          e.target.value = "";
        }}
      />

      <div className="mx-auto grid w-full max-w-[1760px] grid-cols-1 gap-4 px-3 py-6 sm:px-4 md:grid-cols-[220px_minmax(0,1fr)] lg:px-6">
        {sidebarOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
            aria-label="Cerrar menú"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <Sidebar
          activeView={activeView}
          onNavigate={navigate}
          isAdmin={isAdmin}
          className={`fixed inset-y-0 left-0 z-[60] w-[min(85vw,320px)] md:static md:inset-y-auto md:z-auto md:w-full ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } transition-transform md:transition-none`}
        />

        <main className="min-w-0 space-y-10 pb-10">
          {activeView === "admin-users" ? (
            isAdmin ? (
              <AdminUsersView
                users={users}
                predictionsLocked={predictionsLocked}
                onSetUserPaid={(email, paid) => {
                  const prev = users;
                  setUsers((curr) =>
                    curr.map((u) => (u.email === email ? { ...u, paid: Boolean(paid) } : u)),
                  );
                  void apiAdminSetUserPaid(email, Boolean(paid))
                    .then(() => {
                      setNotification({ tone: "success", message: "Estado Paid actualizado." });
                    })
                    .catch(() => {
                      setUsers(prev);
                      setNotification({ tone: "error", message: "No se pudo actualizar Paid." });
                    });
                }}
                onTogglePredictionsLocked={(locked) => {
                  void apiAdminSettings(Boolean(locked), undefined)
                    .then((r) => {
                      setPredictionsLocked(Boolean(r?.settings?.predictionsLocked));
                      setResultsLocked(Boolean(r?.settings?.resultsLocked));
                      setNotification({
                        tone: "success",
                        message: locked ? "Pronósticos bloqueados." : "Pronósticos desbloqueados.",
                      });
                    })
                    .catch(() => {
                      setNotification({
                        tone: "error",
                        message: "No se pudo actualizar el bloqueo.",
                      });
                    });
                }}
                resultsLocked={resultsLocked}
                onToggleResultsLocked={(locked) => {
                  void apiAdminSettings(undefined, Boolean(locked))
                    .then((r) => {
                      setPredictionsLocked(Boolean(r?.settings?.predictionsLocked));
                      setResultsLocked(Boolean(r?.settings?.resultsLocked));
                      setNotification({
                        tone: "success",
                        message: locked ? "Resultados bloqueados." : "Resultados desbloqueados.",
                      });
                    })
                    .catch(() => {
                      setNotification({
                        tone: "error",
                        message: "No se pudo actualizar el bloqueo.",
                      });
                    });
                }}
                onDeleteUser={(email) => {
                  void apiAdminDeleteUser(email)
                    .then(() => apiAdminUsers())
                    .then((u) => {
                      setUsers(u.users ?? []);
                      setNotification({ tone: "success", message: "Usuario borrado." });
                    })
                    .catch((e) => {
                      setNotification({
                        tone: "error",
                        message:
                          e?.data?.error === "admin_protected"
                            ? "No se puede borrar el administrador."
                            : "No se pudo borrar el usuario.",
                      });
                    });
                }}
                onClearNonAdminUsers={() => {
                  void apiAdminClearNonAdminUsers()
                    .then(() => apiAdminUsers())
                    .then((u) => {
                      setUsers(u.users ?? []);
                      setNotification({ tone: "success", message: "Usuarios no-admin borrados." });
                    })
                    .catch(() => {
                      setNotification({ tone: "error", message: "No se pudieron borrar usuarios." });
                    });
                }}
              />
            ) : (
              <section className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Acceso denegado</h2>
                <p className="text-sm text-slate-300">
                  Esta sección es solo para el administrador.
                </p>
              </section>
            )
          ) : null}

          {activeView === "admin-predictions" ? (
            isAdmin ? (
              <AdminPredictionsView torneo={state} grupos={state.grupos} users={users} />
            ) : (
              <section className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Acceso denegado</h2>
                <p className="text-sm text-slate-300">
                  Esta sección es solo para el administrador.
                </p>
              </section>
            )
          ) : null}

          {activeView === "admin-scoreboard" ? (
            isAdmin ? (
              <AdminScoreboardView grupos={state.grupos} />
            ) : (
              <section className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Acceso denegado</h2>
                <p className="text-sm text-slate-300">
                  Esta sección es solo para el administrador.
                </p>
              </section>
            )
          ) : null}

          {activeView === "admin-goleadores" ? (
            isAdmin ? (
              <AdminGoleadoresResultView resultsLocked={resultsLocked} />
            ) : (
              <section className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Acceso denegado</h2>
                <p className="text-sm text-slate-300">
                  Esta sección es solo para el administrador.
                </p>
              </section>
            )
          ) : null}

          {activeView === "admin-mvp" ? (
            isAdmin ? (
              <AdminMvpResultView resultsLocked={resultsLocked} />
            ) : (
              <section className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Acceso denegado</h2>
                <p className="text-sm text-slate-300">
                  Esta sección es solo para el administrador.
                </p>
              </section>
            )
          ) : null}

          {activeView === "admin-zamora" ? (
            isAdmin ? (
              <AdminZamoraResultView resultsLocked={resultsLocked} />
            ) : (
              <section className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Acceso denegado</h2>
                <p className="text-sm text-slate-300">
                  Esta sección es solo para el administrador.
                </p>
              </section>
            )
          ) : null}

          {activeView === "inicio" ? (
            <>
              <section className="space-y-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-black tracking-tight">Grupos del mundial</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {groupsSorted.map((g) => (
                    <GroupSummaryCard key={g.id} grupo={g} />
                  ))}
                </div>
              </section>

              {!isAdmin ? (
                <section className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-black tracking-tight">
                      Resultados reales (fase de grupos)
                    </h2>
                    <p className="text-sm text-slate-300">
                      Consulta los resultados reales introducidos por el administrador.
                    </p>
                  </div>

                  <Card className="p-4">
                    <GroupTabs
                      groupIds={groupIds}
                      active={activeGroup}
                      onChange={setActiveGroup}
                    />
                    <div className="pt-5">
                      <GroupCard
                        grupo={state.grupos[activeGroup]}
                        onUpdateMatch={updateGroupMatch}
                        mode="results"
                        resultsReadOnly
                      />
                    </div>
                  </Card>
                </section>
              ) : null}

              <section className="space-y-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-black tracking-tight">Eliminatorias</h2>
                  <p className="text-sm text-slate-300">
                    Visualiza el cuadro de eliminatorias según los resultados reales actuales.
                  </p>
                </div>

                <KnockoutBracket torneo={state} />
              </section>
            </>
          ) : null}

          {activeView === "fase-grupos" ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-black tracking-tight">Fase de grupos</h2>
                <p className="text-sm text-slate-300">
                  {isAdmin
                    ? "Introduce resultados reales para actualizar la clasificación."
                    : "Consulta los resultados reales introducidos por el administrador."}
                </p>
              </div>

              <Card className="p-4">
                <GroupTabs
                  groupIds={groupIds}
                  active={activeGroup}
                  onChange={setActiveGroup}
                />
                <div className="pt-5">
                  <GroupCard
                    grupo={state.grupos[activeGroup]}
                    onUpdateMatch={updateGroupMatch}
                    mode="results"
                    resultsReadOnly={!isAdmin || resultsLocked}
                  />
                </div>
              </Card>
            </section>
          ) : null}

          {activeView === "resumen" ? (
            <ErrorBoundary>
              <ResumenView torneo={state} predictionsByMatchId={predictionsByMatchId} />
            </ErrorBoundary>
          ) : null}

          {activeView === "pronosticos-grupos" ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-black tracking-tight">Pronósticos</h2>
                <p className="text-sm text-slate-300">
                  {predictionsLocked
                    ? "Pronósticos bloqueados por el administrador."
                    : "Introduce tus pronósticos de fase de grupos."}
                </p>
              </div>

              <Card className="p-4">
                <GroupTabs groupIds={groupIds} active={activeGroup} onChange={setActiveGroup} />
                <div className="pt-5">
                  <GroupCard
                    grupo={state.grupos[activeGroup]}
                    onUpdateMatch={() => {}}
                    mode="predictions"
                    predictionsByMatchId={predictionsByMatchId}
                    standingsResultsByMatchId={standingsPredictionsByMatchId}
                    onUpdatePrediction={updatePrediction}
                    onUpdatePredictionDraft={updatePredictionDraft}
                    predictionsLocked={predictionsLocked}
                  />
                </div>
              </Card>

              <KnockoutBracket
                torneo={predictedKnockoutTorneo}
                description="Se rellena automáticamente cuando completas los pronósticos de cada grupo."
              />
            </section>
          ) : null}

          {activeView === "pronosticos-dieciseisavos" ? (
            <KnockoutPredictionsView
              torneo={state}
              title="16avos"
              roundKey="dieciseisavos"
              matches={state.dieciseisavos ?? []}
              predictionsByMatchId={predictionsByMatchId}
              standingsPredictionsByMatchId={standingsPredictionsByMatchId}
              predictionsLocked={predictionsLocked}
              onUpdatePrediction={updatePrediction}
              onUpdatePredictionDraft={updatePredictionDraft}
            />
          ) : null}

          {activeView === "pronosticos-octavos" ? (
            <KnockoutPredictionsView
              torneo={state}
              title="8avos"
              roundKey="octavos"
              matches={state.octavos ?? []}
              predictionsByMatchId={predictionsByMatchId}
              standingsPredictionsByMatchId={standingsPredictionsByMatchId}
              predictionsLocked={predictionsLocked}
              onUpdatePrediction={updatePrediction}
              onUpdatePredictionDraft={updatePredictionDraft}
            />
          ) : null}

          {activeView === "pronosticos-cuartos" ? (
            <KnockoutPredictionsView
              torneo={state}
              title="4avos"
              roundKey="cuartos"
              matches={state.cuartos ?? []}
              predictionsByMatchId={predictionsByMatchId}
              standingsPredictionsByMatchId={standingsPredictionsByMatchId}
              predictionsLocked={predictionsLocked}
              onUpdatePrediction={updatePrediction}
              onUpdatePredictionDraft={updatePredictionDraft}
            />
          ) : null}

          {activeView === "pronosticos-semifinal" ? (
            <KnockoutPredictionsView
              torneo={state}
              title="Semifinales"
              roundKey="semifinales"
              matches={state.semifinales ?? []}
              predictionsByMatchId={predictionsByMatchId}
              standingsPredictionsByMatchId={standingsPredictionsByMatchId}
              predictionsLocked={predictionsLocked}
              onUpdatePrediction={updatePrediction}
              onUpdatePredictionDraft={updatePredictionDraft}
            />
          ) : null}

          {activeView === "pronosticos-final" ? (
            <KnockoutPredictionsView
              torneo={state}
              title="Final"
              roundKey="final"
              matches={[state.final].filter(Boolean)}
              predictionsByMatchId={predictionsByMatchId}
              standingsPredictionsByMatchId={standingsPredictionsByMatchId}
              predictionsLocked={predictionsLocked}
              onUpdatePrediction={updatePrediction}
              onUpdatePredictionDraft={updatePredictionDraft}
            />
          ) : null}

          {activeView === "clasificados" ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-black tracking-tight">Clasificados</h2>
                <p className="text-sm text-slate-300">
                  Se habilitan cuando el grupo tiene todos los partidos completados.
                </p>
              </div>
              <ClassifiedGrid grupos={state.grupos} />
            </section>
          ) : null}

          {activeView === "puntuaciones" ? (
            <ScoreboardView grupos={state.grupos} />
          ) : null}

          {activeView === "player" ? <PlayerView userEmail={user?.email} /> : null}

          {activeView === "goleadores" ? (
            <GoleadoresView userEmail={user?.email} predictionsLocked={predictionsLocked} />
          ) : null}

          {activeView === "mvp" ? <MvpView userEmail={user?.email} predictionsLocked={predictionsLocked} /> : null}

          {activeView === "zamora" ? (
            <ZamoraView userEmail={user?.email} predictionsLocked={predictionsLocked} />
          ) : null}

          {activeView === "premios" ? <PremiosView /> : null}

          {activeView === "dieciseisavos" ? (
            <KnockoutRoundView
              torneo={state}
              title="16avos"
              roundKey="dieciseisavos"
              matches={state.dieciseisavos ?? []}
              onUpdateRoundMatch={updateKnockoutMatch}
              onUpdateFinal={updateFinalMatch}
              disabled={!isAdmin || resultsLocked}
            />
          ) : null}

          {activeView === "octavos" ? (
            <KnockoutRoundView
              torneo={state}
              title="Octavos"
              roundKey="octavos"
              matches={state.octavos ?? []}
              onUpdateRoundMatch={updateKnockoutMatch}
              onUpdateFinal={updateFinalMatch}
              disabled={!isAdmin || resultsLocked}
            />
          ) : null}

          {activeView === "cuartos" ? (
            <KnockoutRoundView
              torneo={state}
              title="Cuartos"
              roundKey="cuartos"
              matches={state.cuartos ?? []}
              onUpdateRoundMatch={updateKnockoutMatch}
              onUpdateFinal={updateFinalMatch}
              disabled={!isAdmin || resultsLocked}
            />
          ) : null}

          {activeView === "semifinal" ? (
            <KnockoutRoundView
              torneo={state}
              title="Semifinal"
              roundKey="semifinales"
              matches={state.semifinales ?? []}
              onUpdateRoundMatch={updateKnockoutMatch}
              onUpdateFinal={updateFinalMatch}
              disabled={!isAdmin || resultsLocked}
            />
          ) : null}

          {activeView === "final" ? (
            <KnockoutRoundView
              torneo={state}
              title="Final"
              roundKey="final"
              matches={[state.final, state.thirdPlace].filter(Boolean)}
              onUpdateRoundMatch={updateKnockoutMatch}
              onUpdateFinal={updateFinalMatch}
              disabled={!isAdmin || resultsLocked}
            />
          ) : null}

          <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-400">
            <div>© 2026 Jobiyo · Todos los derechos reservados</div>
            <div className="mt-2 text-xs text-slate-500">
              Colaboración especial Jordi Cucurull, Saúl Ferreras y Dani Sánchez
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
