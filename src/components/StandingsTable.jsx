import { calculateStandings } from "../utils/standings.js";
import Flag from "./Flag.jsx";

export default function StandingsTable({
  grupo,
  highlightTop2,
  resultsByMatchId = null,
  fallbackToPartidoResultado = true,
}) {
  const standings = calculateStandings(grupo, resultsByMatchId, { fallbackToPartidoResultado });
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-200">
            <th className="p-3 text-left">Equipo</th>
            <th className="p-3 text-center">PJ</th>
            <th className="p-3 text-center">G</th>
            <th className="p-3 text-center">E</th>
            <th className="p-3 text-center">P</th>
            <th className="p-3 text-center">GF</th>
            <th className="p-3 text-center">GC</th>
            <th className="p-3 text-center">DG</th>
            <th className="p-3 text-center font-black text-white">PTS</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((equipo, idx) => {
            const classified = highlightTop2 && idx < 2;
            return (
              <tr
                key={equipo.id}
                className={`border-b border-slate-900/80 transition ${
                  classified ? "bg-emerald-500/10" : "hover:bg-slate-900/80"
                }`}
              >
                <td className="p-3 font-semibold">
                  <span className="mr-2 inline-flex">
                    <Flag team={equipo} className="h-4 w-4" />
                  </span>
                  {equipo.nombre}
                </td>
                <td className="p-3 text-center text-slate-300">{equipo.pj}</td>
                <td className="p-3 text-center text-slate-300">{equipo.g}</td>
                <td className="p-3 text-center text-slate-300">{equipo.e}</td>
                <td className="p-3 text-center text-slate-300">{equipo.p}</td>
                <td className="p-3 text-center text-slate-300">{equipo.gf}</td>
                <td className="p-3 text-center text-slate-300">{equipo.gc}</td>
                <td className="p-3 text-center text-slate-300">{equipo.dg}</td>
                <td className="p-3 text-center font-black text-white">
                  <span className="inline-flex min-w-10 justify-center rounded-lg bg-blue-500/10 px-2 py-1 ring-1 ring-blue-500/20">
                    {equipo.pts}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
