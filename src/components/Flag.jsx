import { getFlagUrl } from "../utils/flags.js";

export default function Flag({ team, name, className = "h-4 w-4" }) {
  const url = getFlagUrl(team ?? name);
  const alt = team?.nombre ?? name ? `Bandera ${team?.nombre ?? name}` : "Bandera";

  if (!url) {
    const fallback = typeof team === "object" ? team?.bandera : null;
    return fallback ? <span aria-label={alt}>{fallback}</span> : null;
  }

  return (
    <img
      src={url}
      alt={alt}
      className={`inline-block align-middle ${className}`}
      loading="lazy"
      decoding="async"
    />
  );
}
