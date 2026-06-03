export default function Badge({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-slate-800/70 text-slate-200 border-slate-700",
    blue: "bg-blue-500/10 text-blue-200 border-blue-500/30",
    green: "bg-emerald-500/10 text-emerald-200 border-emerald-500/30",
    red: "bg-red-600/15 text-red-100 border-red-500/40",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone] ?? tones.neutral}`}
    >
      {children}
    </span>
  );
}
