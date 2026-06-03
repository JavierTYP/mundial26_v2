import { writeFile } from "node:fs/promises";

const ESPN_TEAMS_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams";
const AS_ROSTERS_URL = "https://as.com/futbol/mundial/listas-de-convocados-para-el-mundial-2026-selecciones-y-todos-los-jugadores-que-estaran-en-la-copa-del-mundo-clone-f202606-n/";

const groups = [
  ["Grupo A", ["México", "Sudáfrica", "Corea del Sur", "República Checa"]],
  ["Grupo B", ["Canadá", "Bosnia y Herzegovina", "Qatar", "Suiza"]],
  ["Grupo C", ["Brasil", "Marruecos", "Haití", "Escocia"]],
  ["Grupo D", ["Estados Unidos", "Paraguay", "Australia", "Turquía"]],
  ["Grupo E", ["Alemania", "Curazao", "Costa de Marfil", "Ecuador"]],
  ["Grupo F", ["Países Bajos", "Japón", "Suecia", "Túnez"]],
  ["Grupo G", ["Bélgica", "Egipto", "Irán", "Nueva Zelanda"]],
  ["Grupo H", ["España", "Cabo Verde", "Arabia Saudita", "Uruguay"]],
  ["Grupo I", ["Francia", "Senegal", "Irak", "Noruega"]],
  ["Grupo J", ["Argentina", "Argelia", "Austria", "Jordania"]],
  ["Grupo K", ["Portugal", "RD Congo", "Uzbekistán", "Colombia"]],
  ["Grupo L", ["Inglaterra", "Croacia", "Ghana", "Panamá"]],
];

const teamNameByEspnName = new Map([
  ["Algeria", "Argelia"],
  ["Argentina", "Argentina"],
  ["Australia", "Australia"],
  ["Austria", "Austria"],
  ["Belgium", "Bélgica"],
  ["Bosnia-Herzegovina", "Bosnia y Herzegovina"],
  ["Brazil", "Brasil"],
  ["Canada", "Canadá"],
  ["Cape Verde", "Cabo Verde"],
  ["Colombia", "Colombia"],
  ["Congo DR", "RD Congo"],
  ["Croatia", "Croacia"],
  ["Curacao", "Curazao"],
  ["Czechia", "República Checa"],
  ["Ecuador", "Ecuador"],
  ["Egypt", "Egipto"],
  ["England", "Inglaterra"],
  ["France", "Francia"],
  ["Germany", "Alemania"],
  ["Ghana", "Ghana"],
  ["Haiti", "Haití"],
  ["Iran", "Irán"],
  ["Iraq", "Irak"],
  ["Ivory Coast", "Costa de Marfil"],
  ["Japan", "Japón"],
  ["Jordan", "Jordania"],
  ["Mexico", "México"],
  ["Morocco", "Marruecos"],
  ["Netherlands", "Países Bajos"],
  ["New Zealand", "Nueva Zelanda"],
  ["Norway", "Noruega"],
  ["Panama", "Panamá"],
  ["Paraguay", "Paraguay"],
  ["Portugal", "Portugal"],
  ["Qatar", "Qatar"],
  ["Saudi Arabia", "Arabia Saudita"],
  ["Scotland", "Escocia"],
  ["Senegal", "Senegal"],
  ["South Africa", "Sudáfrica"],
  ["South Korea", "Corea del Sur"],
  ["Spain", "España"],
  ["Sweden", "Suecia"],
  ["Switzerland", "Suiza"],
  ["Tunisia", "Túnez"],
  ["Türkiye", "Turquía"],
  ["TÃ¼rkiye", "Turquía"],
  ["United States", "Estados Unidos"],
  ["Uruguay", "Uruguay"],
  ["Uzbekistan", "Uzbekistán"],
]);

const preferredByTeam = new Map([
  ["Argentina", ["Dibu Martínez", "Gerónimo Rulli", "Juan Musso", "Cristian Romero", "Otamendi", "Nahuel Molina", "Nicolás Tagliafico", "Enzo Fernández", "Rodrigo de Paul", "Alexis Mac Allister", "Lionel Messi", "Julián Álvarez", "Lautaro Martínez", "Thiago Almada"]],
  ["Australia", ["Matthew Ryan", "Patrick Beach", "Paul Izzo", "Harry Souttar", "Alessandro Circati", "Jordan Bos", "Jackson Irvine", "Connor Metcalfe", "Mathew Leckie", "Nestoy Irakunda", "Awer Mabil", "Cristian Volpato", "Tete Yengi"]],
  ["Brasil", ["Alisson", "Ederson", "Weverton", "Marquinhos", "Gabriel Magalhães", "Bremer", "Casemiro", "Bruno Guimarães", "Vinicius Jr.", "Raphinha", "Matheus Cunha", "Endrick", "Neymar"]],
  ["Canadá", ["Maxime Crépau", "Owen Goodman", "Dayne St. Clair", "Moïse Bombito", "Derek Cornelius", "Alphonso Davies", "Stephen Eustáquio", "Tajon Buchanan", "Ismäel Koné", "Jonathan David", "Cyle Larin", "Tani Oluwaseyi"]],
  ["Colombia", ["Álvaro Montero", "Camilo Vargas", "David Ospina", "Daniel Muñoz", "Dávinson Sánchez", "Jhon Lucumí", "James Rodríguez", "Jefferson Lerma", "Jhon Arias", "Richard Ríos", "Luis Diaz", "Luis Suárez", "Jhon Córdoba"]],
  ["Estados Unidos", ["Matt Freese", "Matt Turner", "Chris Brady", "Sergiño Dest", "Chris Richards", "Antonee Robinson", "Tyler Adams", "Weston McKennie", "Christian Pulisic", "Gio Reyna", "Folarin Balogun", "Ricardo Pepi", "Haji Wright"]],
  ["Francia", ["Mike Maignan", "Brice Samba", "Robin Risser", "Jules Kounde", "William Saliba", "Dayot Upamecano", "Aurélien Tchouaméni", "Adrien Rabiot", "Kylian Mbappé", "Michael Olise", "Ousmane Dembélé", "Marcus Thuram", "Rayan Cherki"]],
  ["Inglaterra", ["Jordan Pickford", "Dean Henderson", "James Trafford", "Reece James", "John Stones", "Marc Guéhi", "Declan Rice", "Jude Bellingham", "Bukayo Saka", "Marcus Rashford", "Harry Kane", "Ollie Watkins", "Ivan Toney"]],
  ["México", ["Raúl Rangel", "Carlos Acevedo", "Guillermo Ochoa", "César Montes", "Edsol Álvarez", "Johan Vásquez", "Orbelín Pineda", "Luis Chávez", "Roberto Alvarado", "César Huerta", "Santiago Giménez", "Raúl Jiménez", "Alexis Vega"]],
  ["Portugal", ["Diogo Costa", "José Sá", "Rui Silva", "Rúben Dias", "Nuno Mendes", "João Cancelo", "Vitinha", "Bruno Fernandes", "Bernardo Silva", "Cristiano Ronaldo", "Rafael Leão", "Gonçalo Ramos", "Pedro Neto"]],
  ["España", ["Unai Simón", "David Raya", "Joan García", "Pedro Porro", "Marc Cucurella", "Pau Cubarsí", "Rodri", "Pedri", "Dani Olmo", "Lamine Yamal", "Nico Williams", "Mikel Oyarzabal", "Ferran Torres"]],
]);

const fallbackPreferredByPosition = {
  G: 3,
  D: 7,
  M: 8,
  F: 8,
};

const asAliases = new Map([
  ["Bosnia y Herzegovina", "Bosnia"],
  ["Curazao", "Curaçao"],
  ["Estados Unidos", "EE.UU."],
  ["Arabia Saudita", "Arabia Saudí"],
]);

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function normalizePosition(position) {
  const abbreviation = position?.abbreviation;
  if (abbreviation === "G") return "G";
  if (abbreviation === "D") return "D";
  if (abbreviation === "M") return "M";
  if (abbreviation === "F") return "F";
  return "M";
}

function stripClub(player) {
  return player
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

function splitPlayers(text) {
  return text
    .replace(/\s+y\s+(?=[A-ZÁÉÍÓÚÜÑÄÖÏÇ])/g, ", ")
    .split(",")
    .map(stripClub)
    .map((player) => player.replace(/^[\s•-]+|[\s.,;:]+$/g, "").trim())
    .filter(Boolean);
}

function parseCategory(section, labels, nextLabels) {
  const labelPattern = labels.join("|");
  const nextPattern = nextLabels.join("|");
  const match = section.match(new RegExp(`(?:${labelPattern}):\\s*([\\s\\S]*?)(?=(?:${nextPattern}):|\\s+•\\s+|\\s+¡Lleva|\\s+##|$)`, "i"));
  return match ? splitPlayers(match[1]) : [];
}

function parseAsArticleBody(html) {
  const match = html.match(/"articleBody":"((?:\\.|[^"\\])*)"/);
  if (!match) return "";
  return JSON.parse(`"${match[1]}"`);
}

function parseAsRosters(body) {
  const rosters = new Map();
  const orderedTeams = groups.flatMap(([, teams]) => teams);
  const aliases = orderedTeams.map((team) => [team, asAliases.get(team) ?? team]);

  for (let index = 0; index < aliases.length; index += 1) {
    const [team, alias] = aliases[index];
    const nextAliases = aliases.slice(index + 1).map(([, nextAlias]) => nextAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const marker = new RegExp(`•\\s*${escapedAlias}\\s+`);
    const start = body.search(marker);
    if (start === -1) continue;
    const rest = body.slice(start);
    const nextMarker = nextAliases.length ? rest.slice(1).search(new RegExp(`•\\s*(?:${nextAliases.join("|")})\\s+`)) : -1;
    const section = nextMarker === -1 ? rest : rest.slice(0, nextMarker + 1);
    const goalkeepers = parseCategory(section, ["Porteros"], ["Defensas", "Centrocampista", "Centrocampistas", "Centrocampitas", "Mediocampistas", "Delanteros", "Atacantes"]);
    const defenders = parseCategory(section, ["Defensas"], ["Centrocampista", "Centrocampistas", "Centrocampitas", "Mediocampistas", "Delanteros", "Atacantes"]);
    const midfielders = parseCategory(section, ["Centrocampista", "Centrocampistas", "Centrocampitas", "Mediocampistas"], ["Delanteros", "Atacantes"]);
    const forwards = parseCategory(section, ["Delanteros", "Atacantes"], ["###"]);
    const players = [
      ...goalkeepers.map((name) => ({ name, position: "G" })),
      ...defenders.map((name) => ({ name, position: "D" })),
      ...midfielders.map((name) => ({ name, position: "M" })),
      ...forwards.map((name) => ({ name, position: "F" })),
    ];
    if (players.length >= 20 && goalkeepers.length >= 3) {
      rosters.set(team, uniqueByName(players).slice(0, 26));
    }
  }

  return rosters;
}

function groupForTeam(team) {
  return groups.find(([, teams]) => teams.includes(team))?.[0] ?? "";
}

function uniqueByName(players) {
  const seen = new Set();
  return players.filter((player) => {
    const key = player.name.toLocaleLowerCase("es");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectSquad(team, roster) {
  const preferred = preferredByTeam.get(team);
  if (preferred) {
    const byName = new Map(roster.map((player) => [player.name.toLocaleLowerCase("es"), player]));
    const selected = preferred.map((name) => byName.get(name.toLocaleLowerCase("es")) ?? { name, position: "M" });
    const requiredGoalkeepers = roster.filter((player) => player.position === "G").slice(0, 3);
    const filled = uniqueByName([...requiredGoalkeepers, ...selected, ...roster.filter((player) => player.position !== "G")]);
    return filled.filter((player, index, players) => {
      if (player.position !== "G") return true;
      return players.slice(0, index + 1).filter((candidate) => candidate.position === "G").length <= 3;
    }).slice(0, 26);
  }

  const selected = [];
  for (const [position, limit] of Object.entries(fallbackPreferredByPosition)) {
    selected.push(...roster.filter((player) => player.position === position).slice(0, limit));
  }
  return uniqueByName(selected).slice(0, 26);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed ${response.status}: ${url}`);
  }
  return response.json();
}

const teamsResponse = await fetchJson(ESPN_TEAMS_URL);
const espnTeams = teamsResponse.sports[0].leagues[0].teams.map(({ team }) => team);
const rosterByTeam = new Map();
const asHtml = await (await fetch(AS_ROSTERS_URL)).text();
const asRosters = parseAsRosters(parseAsArticleBody(asHtml));

for (const espnTeam of espnTeams) {
  const appTeam = teamNameByEspnName.get(espnTeam.displayName);
  if (!appTeam) continue;
  if (asRosters.has(appTeam)) {
    rosterByTeam.set(appTeam, asRosters.get(appTeam));
    continue;
  }
  const roster = await fetchJson(`${ESPN_TEAMS_URL}/${espnTeam.id}/roster`);
  const players = roster.athletes.map((athlete) => ({
    name: athlete.displayName,
    position: normalizePosition(athlete.position),
  }));
  rosterByTeam.set(appTeam, selectSquad(appTeam, players));
}

const orderedTeams = groups.flatMap(([, teams]) => teams);
const missingTeams = orderedTeams.filter((team) => !rosterByTeam.has(team));
if (missingTeams.length) {
  throw new Error(`Missing rosters: ${missingTeams.join(", ")}`);
}

const jugadoresRows = [["grupo", "equipo", "jugador"]];
const goleadoresRows = [["grupo", "equipo", "jugador"]];
const porterosRows = [["grupo", "equipo", "portero"]];

for (const [group, teams] of groups) {
  for (const team of teams) {
    const roster = rosterByTeam.get(team);
    const goalkeepers = roster.filter((player) => player.position === "G");
    const attackers = roster.filter((player) => player.position === "F");
    const scorerPool = attackers.length ? attackers : roster.filter((player) => player.position !== "G");

    for (const player of roster) {
      jugadoresRows.push([group, team, player.name]);
    }
    for (const player of scorerPool) {
      goleadoresRows.push([group, team, player.name]);
    }
    for (const player of goalkeepers) {
      porterosRows.push([group, team, player.name]);
    }
  }
}

await writeFile("data/jugadores.csv", jugadoresRows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n", "utf8");
await writeFile("data/goleadores.csv", goleadoresRows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n", "utf8");
await writeFile("data/porteros.csv", porterosRows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n", "utf8");

console.log(`Updated jugadores: ${jugadoresRows.length - 1}`);
console.log(`Updated goleadores: ${goleadoresRows.length - 1}`);
console.log(`Updated porteros: ${porterosRows.length - 1}`);
