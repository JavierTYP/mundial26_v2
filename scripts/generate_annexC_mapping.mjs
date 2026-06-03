import fs from "node:fs";
import path from "node:path";

const TEMPLATE_URL =
  "https://en.wikipedia.org/w/index.php?title=Template:2026_FIFA_World_Cup_third-place_table&action=raw";

function fetchText(url) {
  const headers = {
    // Wikipedia may throttle requests with no/unknown UA.
    "User-Agent": "mundial26-app/1.0 (local script; no contact)",
    Accept: "text/plain, text/*;q=0.9,*/*;q=0.8",
  };

  const maxAttempts = 6;
  const baseDelayMs = 750;

  return (async () => {
    let lastErr = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const res = await fetch(url, { headers });
        if (res.ok) return await res.text();

        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const delayMs = Number.isFinite(retryAfter)
            ? Math.max(0, retryAfter * 1000)
            : baseDelayMs * attempt;
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
      }
    }
    throw lastErr ?? new Error("Failed to fetch template");
  })();
}

function parseRows(raw) {
  const rows = [];
  const lines = raw.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^!\s*scope="row"\s*\|\s*(\d+)\s*$/);
    if (!m) {
      i += 1;
      continue;
    }

    const no = Number(m[1]);
    const chunk = [];
    i += 1;
    while (i < lines.length && !lines[i].startsWith("|-")) {
      chunk.push(lines[i]);
      i += 1;
    }

    const text = chunk.join("\n");

    // Group letters advancing (8 of 12, stored as '''A''' etc.)
    const groups = [...text.matchAll(/'''([A-L])'''/g)].map((x) => x[1]);
    if (groups.length !== 8) {
      throw new Error(`Row ${no}: expected 8 advancing groups, got ${groups.length}`);
    }

    // Assigned third-placed groups: 3A..3L (8 columns: vs 1A,1B,1D,1E,1G,1I,1K,1L)
    const assigned = [...text.matchAll(/\b3([A-L])\b/g)].map((x) => x[1]);
    if (assigned.length < 8) {
      throw new Error(`Row ${no}: expected >=8 assigned groups, got ${assigned.length}`);
    }
    const assigned8 = assigned.slice(0, 8);

    const key = groups.join("");
    rows.push({ no, key, assigned: assigned8 });
  }

  return rows;
}

function main() {
  const outPath = path.join("src", "data", "annexC_2026_thirds_mapping.json");

  fetchText(TEMPLATE_URL)
    .then((raw) => {
      const rows = parseRows(raw);
      if (rows.length !== 495) {
        throw new Error(`Expected 495 combinations, got ${rows.length}`);
      }

      const map = {};
      for (const r of rows) {
        if (map[r.key]) throw new Error(`Duplicate key: ${r.key}`);
        map[r.key] = r.assigned;
      }

      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(map, null, 2) + "\n", "utf8");
      // eslint-disable-next-line no-console
      console.log(`Wrote ${Object.keys(map).length} combos to ${outPath}`);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exitCode = 1;
    });
}

main();
