export default function GroupTabs({ groupIds, active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-3">
      {groupIds.map((gid) => {
        const isActive = gid === active;
        return (
          <button
            key={gid}
            onClick={() => onChange(gid)}
            className={`min-h-11 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${
              isActive
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/10"
                : "bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            Grupo {gid}
          </button>
        );
      })}
    </div>
  );
}
