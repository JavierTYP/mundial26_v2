const flagSvgs = import.meta.glob("../assets/banderas/*.svg", {
  eager: true,
  import: "default",
});

function filenameBase(path) {
  const file = path.split("/").pop() ?? path;
  return decodeURI(file).replace(/\.svg$/i, "");
}

function normalizeKey(value) {
  if (!value) return "";
  return value
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

const flagsByBaseName = new Map();
const flagsByNormalizedName = new Map();

for (const [path, url] of Object.entries(flagSvgs)) {
  const base = filenameBase(path);
  flagsByBaseName.set(base, url);

  const normalized = normalizeKey(base);
  if (normalized && !flagsByNormalizedName.has(normalized)) {
    flagsByNormalizedName.set(normalized, url);
  }
}

const aliasByNormalizedName = new Map([
  // Common name variants vs file base names in `src/assets/banderas/`
  ["corea del sur", "republica de corea"],
  ["bosnia y herzegovina", "bosnia herzegovina"],
  ["iran", "ri de iran"],
  ["cabo verde", "islas de cabo verde"],
  ["arabia saudita", "arabia saudi"],
]);

export function getFlagUrl(teamOrName) {
  const name =
    typeof teamOrName === "string"
      ? teamOrName
      : teamOrName?.nombre ?? teamOrName?.name ?? "";

  if (!name) return null;

  const direct = flagsByBaseName.get(name);
  if (direct) return direct;

  const withUnderscores = flagsByBaseName.get(name.replace(/\s+/g, "_"));
  if (withUnderscores) return withUnderscores;

  const normalized = flagsByNormalizedName.get(normalizeKey(name));
  if (normalized) return normalized;

  const alias = aliasByNormalizedName.get(normalizeKey(name));
  if (alias) {
    const resolved = flagsByNormalizedName.get(alias);
    if (resolved) return resolved;
  }

  return null;
}
