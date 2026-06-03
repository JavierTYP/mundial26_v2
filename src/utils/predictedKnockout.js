import { buildDieciseisavos } from "./knockout.js";

function withPredictionResults(matches, predictionsByMatchId) {
  return (matches ?? []).map((m) => ({
    ...m,
    resultado: predictionsByMatchId?.[m.id] ?? null,
    ganador: predictedWinnerId(m, predictionsByMatchId),
  }));
}

function predictedWinnerId(match, predictionsByMatchId) {
  const prediction = predictionsByMatchId?.[match?.id] ?? null;
  const l = prediction?.local ?? null;
  const v = prediction?.visitante ?? null;
  if (l == null || v == null) return null;
  if (match?.local == null || match?.visitante == null) return null;
  if (l > v) return match.local;
  if (v > l) return match.visitante;
  const w = prediction?.winner ?? null;
  if (w === match.local || w === match.visitante) return w;
  return null;
}

function loserTeamId(match) {
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
}

function advanceRoundPredicted(nextTemplate, previousMatches, predictionsByMatchId) {
  const map = new Map(
    (previousMatches ?? []).map((m) => [m.id, predictedWinnerId(m, predictionsByMatchId)]),
  );
  return (nextTemplate ?? []).map((m) => {
    const [a, b] = String(m.emparejamiento).split("vs").map((s) => s.trim());
    if (!a || !b) return m;
    const local = map.get(a) ?? null;
    const visitante = map.get(b) ?? null;
    return { ...m, local, visitante };
  });
}

export function buildPredictedKnockoutTournament(torneo, predictionsByMatchId) {
  if (!torneo) return torneo;

  const dieciseisavosSeeded = buildDieciseisavos(
    torneo?.dieciseisavos ?? [],
    torneo?.grupos ?? {},
    predictionsByMatchId,
  );
  const dieciseisavos = withPredictionResults(dieciseisavosSeeded, predictionsByMatchId);

  const octavosAdvanced = advanceRoundPredicted(torneo?.octavos ?? [], dieciseisavos, predictionsByMatchId);
  const octavos = withPredictionResults(octavosAdvanced, predictionsByMatchId);

  const cuartosAdvanced = advanceRoundPredicted(torneo?.cuartos ?? [], octavos, predictionsByMatchId);
  const cuartos = withPredictionResults(cuartosAdvanced, predictionsByMatchId);

  const semifinalesAdvanced = advanceRoundPredicted(
    torneo?.semifinales ?? [],
    cuartos,
    predictionsByMatchId,
  );
  const semifinales = withPredictionResults(semifinalesAdvanced, predictionsByMatchId);

  const semi1 = semifinales.find((m) => String(m?.id ?? "") === "02-S1") ?? null;
  const semi2 = semifinales.find((m) => String(m?.id ?? "") === "02-S2") ?? null;
  const thirdPlaceBase = {
    id: "3P-31",
    local: loserTeamId(semi1),
    visitante: loserTeamId(semi2),
  };
  const thirdPlacePrediction = predictionsByMatchId?.[thirdPlaceBase.id] ?? null;
  const thirdPlace = {
    ...thirdPlaceBase,
    resultado: thirdPlacePrediction ?? null,
    ganador: predictedWinnerId(thirdPlaceBase, predictionsByMatchId),
  };

  const finalTemplate = torneo?.final ? [torneo.final] : [];
  const finalAdvanced =
    advanceRoundPredicted(finalTemplate, semifinales, predictionsByMatchId)[0] ??
    torneo?.final ??
    null;
  const finalMatch = finalAdvanced
    ? { ...finalAdvanced, resultado: predictionsByMatchId?.[finalAdvanced.id] ?? null }
    : null;

  return {
    ...torneo,
    dieciseisavos,
    octavos,
    cuartos,
    semifinales,
    thirdPlace,
    final: finalMatch,
  };
}
