# Mundial 2026 — Simulador

![MUNDIAL26 - TYPSA](./public/mundial2026-typsa_1200x630px.jpg)

App web para simular el Mundial 2026: fase de grupos, clasificados y eliminatorias.

Incluye un backend (Express) para:
- Login + sesiones
- Persistencia de pronósticos
- Panel admin + export

La persistencia puede ser:
- SQLite local (por defecto, `data/app.sqlite`)
- PostgreSQL (Supabase) vía `DATABASE_URL` (o `DB_MODE=postgres`)

En modo PostgreSQL, el backend usa tablas como `goleadores_picks`, `zamora_picks` y `mvp_picks`. Si en Supabase no quieres/puedes que la app cree tablas, ejecuta `server/supabase/schema.sql` en el SQL Editor.

## Requisitos
- Node.js 18+ (recomendado 20+)

## Instalar y correr
```bash
npm install
npm run dev
```

Abrir la URL que muestre Vite (por defecto `http://localhost:5173`).

Para levantar el backend local:
```bash
npm run server
```

## Build
```bash
npm run build
npm run preview
```

## Datos
- Fuente base: `src/data/mundial2026.json`
- Persistencia local: `localStorage` (clave `mundial2026_state_v1`)

## Banderas (SVG)
- Ubicación: `src/assets/banderas/` (48 SVG, nombre = paí­s)

## Funcionalidades
- Tabs por grupo (A–L)
- Tabla de posiciones (PTS → DG → GF)
- Ingreso de resultados (0–10, Enter/Actualizar)
- Clasificados (top 2 al completar todos los partidos del grupo)
- Eliminatorias con avance automático por ganadores
- Autosave cada 5 segundos + export/import de backup JSON
