import Card from "./Card.jsx";
import Badge from "./Badge.jsx";
import { calculateStandings, groupIsComplete } from "../utils/standings.js";
import Flag from "./Flag.jsx";
import { getBestThirds } from "../utils/knockout.js";

function TeamLine({ team, position }) {
  if (!team) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-400">
        <span>{position}°</span>
        <span className="truncate">—</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm">
      <span className="font-black">{position}°</span>
      <span className="min-w-0 truncate font-semibold">
        <span className="mr-2 inline-flex">
          <Flag team={team} className="h-4 w-4" />
        </span>
        {team.nombre}
      </span>
    </div>
  );
}

function ThirdLine({ item, index }) {
  if (!item) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-400">
        <span>#{index + 1}</span>
        <span className="truncate">â€”</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm">
      <span className="font-black">#{index + 1}</span>
      <span className="min-w-0 truncate font-semibold">
        <span className="mr-2 inline-flex">
          <Flag team={item.team} className="h-4 w-4" />
        </span>
        {item.team.nombre}
      </span>
      <span className="shrink-0 text-xs text-slate-400">3Â° {item.gid}</span>
    </div>
  );
}

export default function ClassifiedGrid({ grupos }) {
  const groupIds = Object.keys(grupos);
  const bestThirds = getBestThirds(grupos, 8);
  const completeGroups = groupIds.filter((gid) => groupIsComplete(grupos[gid])).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groupIds.map((gid) => {
          const grupo = grupos[gid];
          const complete = groupIsComplete(grupo);
          const standings = calculateStandings(grupo);
          const first = complete ? standings[0] : null;
          const second = complete ? standings[1] : null;
          const third = complete ? standings[2] : null;

          return (
            <Card key={gid} className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-black tracking-tight">Grupo {gid}</div>
                <Badge tone={complete ? "green" : "neutral"}>
                  {complete ? "Definido" : "Incompleto"}
                </Badge>
              </div>

              <div className="space-y-2">
                <TeamLine team={first} position={1} />
                <TeamLine team={second} position={2} />
                <TeamLine team={third} position={3} />
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-black tracking-tight">Mejores terceros</div>
          <Badge tone={bestThirds.length === 8 ? "green" : "neutral"}>
            {bestThirds.length}/8 (de {completeGroups}/{groupIds.length} grupos definidos)
          </Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, idx) => (
            <ThirdLine key={idx} item={bestThirds[idx] ?? null} index={idx} />
          ))}
        </div>
      </Card>
    </div>
  );
}
