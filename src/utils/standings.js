function pointsForMatch(resultado) {
  if (resultado?.local == null || resultado?.visitante == null) return null;
  if (resultado.local > resultado.visitante) return { local: 3, visitante: 0 };
  if (resultado.local < resultado.visitante) return { local: 0, visitante: 3 };
  return { local: 1, visitante: 1 };
}

export function calculateStandings(
  grupo,
  resultsByMatchId = null,
  { fallbackToPartidoResultado = true } = {},
) {
  const base = new Map(
    grupo.equipos.map((e) => [
      e.id,
      {
        ...e,
        pj: 0,
        g: 0,
        e: 0,
        p: 0,
        gf: 0,
        gc: 0,
        dg: 0,
        pts: 0,
      },
    ]),
  );

  for (const partido of grupo.partidos) {
    const provided = resultsByMatchId ? resultsByMatchId?.[partido.id] : null;
    const resultado = fallbackToPartidoResultado ? provided ?? partido.resultado : provided ?? null;
    const puntos = pointsForMatch(resultado);
    if (!puntos) continue;

    const local = base.get(partido.idLocal);
    const visitante = base.get(partido.idVisitante);
    if (!local || !visitante) continue;

    local.pj += 1;
    visitante.pj += 1;

    local.gf += resultado.local;
    local.gc += resultado.visitante;
    visitante.gf += resultado.visitante;
    visitante.gc += resultado.local;

    local.pts += puntos.local;
    visitante.pts += puntos.visitante;

    if (resultado.local > resultado.visitante) {
      local.g += 1;
      visitante.p += 1;
    } else if (resultado.local < resultado.visitante) {
      visitante.g += 1;
      local.p += 1;
    } else {
      local.e += 1;
      visitante.e += 1;
    }
  }

  const standings = [...base.values()].map((t) => ({
    ...t,
    dg: t.gf - t.gc,
  }));

  standings.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dg !== a.dg) return b.dg - a.dg;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.nombre.localeCompare(b.nombre);
  });

  return standings;
}

export function groupIsComplete(
  grupo,
  resultsByMatchId = null,
  { fallbackToPartidoResultado = true } = {},
) {
  return (grupo?.partidos ?? []).every((p) => {
    const provided = resultsByMatchId ? resultsByMatchId?.[p.id] : null;
    const resultado = fallbackToPartidoResultado ? provided ?? p.resultado : provided ?? null;
    return resultado?.local != null && resultado?.visitante != null;
  });
}
