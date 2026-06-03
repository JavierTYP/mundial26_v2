import Card from "./Card.jsx";
import Flag from "./Flag.jsx";

export default function GroupSummaryCard({ grupo }) {
  return (
    <Card className="p-5">
      <div className="mb-4 text-base font-black tracking-tight">
        {`GRUPO ${grupo.id}`}
      </div>

      <ul className="grid gap-3">
        {grupo.equipos.map((team) => (
          <li key={team.id} className="flex items-center gap-3 text-sm font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-950/50 ring-1 ring-slate-800">
              <Flag team={team} className="h-5 w-5" />
            </span>
            <span className="min-w-0 truncate">{team.nombre}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

