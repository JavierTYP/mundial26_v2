import { writeFile } from "node:fs/promises";

const ESPN_URL =
  "https://espndeportes.espn.com/futbol/mundial/nota/_/id/16715015/mundial-2026-convocatorias-de-selecciones-todas-las-listas-de-jugadores";

const GROUPS = [
  ["Grupo A", ["México", "Sudáfrica", "Corea del Sur", "Chequia"]],
  ["Grupo B", ["Canadá", "Bosnia-Herzegovina", "Qatar", "Suiza"]],
  ["Grupo C", ["Brasil", "Marruecos", "Haití", "Escocia"]],
  ["Grupo D", ["Estados Unidos", "Paraguay", "Australia", "Turquía"]],
  ["Grupo E", ["Alemania", "Curazao", "Costa de Marfil", "Ecuador"]],
  ["Grupo F", ["Países Bajos", "Japón", "Suecia", "Túnez"]],
  ["Grupo G", ["Bélgica", "Egipto", "Irán", "Nueva Zelanda"]],
  ["Grupo H", ["España", "Cabo Verde", "Arabia Saudita", "Uruguay"]],
  ["Grupo I", ["Francia", "Senegal", "Irak", "Noruega"]],
  ["Grupo J", ["Argentina", "Argelia", "Austria", "Jordania"]],
  ["Grupo K", ["Portugal", "DR Congo", "Uzbekistán", "Colombia"]],
  ["Grupo L", ["Inglaterra", "Croacia", "Ghana", "Panamá"]],
];

const TEAM_ALIASES = new Map([
  ["Mexico", "México"],
  ["Czechia", "Chequia"],
  ["Brasill", "Brasil"],
  ["Morocco", "Marruecos"],
  ["RD Congo", "DR Congo"],
  ["Estados Unidos", "Estados Unidos"],
  ["Curacao", "Curazao"],
  ["Paises Bajos", "Países Bajos"],
  ["Belgica", "Bélgica"],
  ["Espana", "España"],
  ["Tunez", "Túnez"],
  ["Panama", "Panamá"],
]);

const TEAM_TO_GROUP = new Map(GROUPS.flatMap(([group, teams]) => teams.map((team) => [team, group])));

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)));
}

function stripTags(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function csvEscape(value) {
  const str = String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function normalizeSpaces(value) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanPlayerName(name) {
  return normalizeSpaces(
    name
      .replace(/\u2060/g, "")
      .replace(/^M\s+(?=Lamine Yamal$)/, "")
      .replace(/[;]+/g, " ")
      .replace(/[.]+$/g, "")
  );
}

function normalizeTeam(team) {
  const clean = normalizeSpaces(team);
  return TEAM_ALIASES.get(clean) ?? clean;
}

function extractArticleHtml(html) {
  const start = html.indexOf("Mundial 2026: Todas las convocatorias de las selecciones");
  const end = html.indexOf("Últimas Noticias", start);
  return html.slice(start, end > start ? end : undefined);
}

function extractHeadingText(headingHtml) {
  const matches = [...headingHtml.matchAll(/>([^<>]+)</g)].map((m) => stripTags(m[1]));
  return normalizeTeam(matches.at(-1) ?? stripTags(headingHtml));
}

function extractPlayers(sectionHtml) {
  const positionRegex =
    /(Porteros|Arqueros|Defensas|Defensores|Centrocampistas|Mediocampistas|Volantes|Delanteros)\s*[:;]\s*([\s\S]*?)(?=(?:Porteros|Arqueros|Defensas|Defensores|Centrocampistas|Mediocampistas|Volantes|Delanteros|Director T[ée]cnico|Director t[ée]cnico|Directo T[ée]cnico|DT|Entrenador)\s*[:;]|<h2|<hr|$)/gi;
  const normalizedSection = stripTags(sectionHtml).replace(/\s+([:;])/g, "$1");
  const names = [];
  const seen = new Set();

  for (const match of normalizedSection.matchAll(positionRegex)) {
    const text = match[2].replace(/\s+y\s+/g, ", ");
    let sourceNames = [...text.matchAll(/(?:^|,)\s*([^,()]+?)\s*,?\s*\(/g)].map((m) =>
      normalizeSpaces(m[1].replace(/^(?:y|e)\s+/i, ""))
    );

    if (!sourceNames.length) {
      sourceNames = text
        .split(",")
        .flatMap((part) => part.split(/\s+y\s+/i))
        .map((part) => part.replace(/\s*\([^)]*\).*/, "").replace(/[.;]+$/g, ""))
        .map(normalizeSpaces)
        .filter(Boolean);
    }

    for (const name of sourceNames) {
      const clean = cleanPlayerName(name);
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);
      names.push(clean);
    }
  }

  return names;
}

const response = await fetch(ESPN_URL);
if (!response.ok) {
  throw new Error(`ESPN request failed: ${response.status} ${response.statusText}`);
}

const html = await response.text();
const articleHtml = extractArticleHtml(html);
const h2Regex = /<h2\b[\s\S]*?<\/h2>/gi;
const headings = [...articleHtml.matchAll(h2Regex)]
  .map((m) => ({ index: m.index ?? 0, html: m[0], text: extractHeadingText(m[0]) }))
  .filter((h) => TEAM_TO_GROUP.has(h.text));

const rows = [["grupo", "equipo", "jugador"]];
const rosters = new Map();

for (let i = 0; i < headings.length; i += 1) {
  const heading = headings[i];
  const next = headings[i + 1]?.index ?? articleHtml.length;
  const section = articleHtml.slice(heading.index + heading.html.length, next);
  const players = extractPlayers(section);
  if (process.argv.includes("--debug")) {
    console.log(`${heading.text}: ${players.length}`);
    if (!players.length) console.log(stripTags(section).slice(0, 500));
  }
  if (!players.length) continue;
  rosters.set(heading.text, players);
}

const missingTeams = [];
for (const [group, teams] of GROUPS) {
  for (const team of teams) {
    const players = rosters.get(team);
    if (!players?.length) {
      missingTeams.push(team);
      continue;
    }
    for (const player of players) {
      rows.push([group, team, player]);
    }
  }
}

if (missingTeams.length) {
  throw new Error(`No players extracted for: ${missingTeams.join(", ")}`);
}

await writeFile("data/jugadores.csv", rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n", "utf8");
console.log(`Updated data/jugadores.csv with ${rows.length - 1} players from ESPN.`);
