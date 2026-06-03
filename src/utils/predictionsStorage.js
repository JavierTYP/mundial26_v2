const KEY_PREFIX = "mundial2026_predictions_v1:";

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function keyFor(email) {
  return `${KEY_PREFIX}${String(email ?? "").trim().toLowerCase()}`;
}

export function loadPredictions(email) {
  try {
    const raw = localStorage.getItem(keyFor(email));
    const parsed = raw ? safeParse(raw) : null;
    const predictions = parsed?.predictions;
    return predictions && typeof predictions === "object" ? predictions : {};
  } catch {
    return {};
  }
}

export function savePredictions(email, predictions) {
  const payload = {
    version: 1,
    email: String(email ?? "").trim().toLowerCase(),
    updatedAt: new Date().toISOString(),
    predictions,
  };
  localStorage.setItem(keyFor(email), JSON.stringify(payload));
  return payload;
}

export function exportPredictionsJson(email, predictions, torneo) {
  return {
    type: "mundial2026_predictions",
    version: 1,
    email: String(email ?? "").trim().toLowerCase(),
    exportedAt: new Date().toISOString(),
    torneo: {
      nombre: torneo?.nombre ?? null,
      fechaInicio: torneo?.fechaInicio ?? null,
    },
    predictions,
  };
}

