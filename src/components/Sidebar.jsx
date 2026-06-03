import { useMemo, useState } from "react";

const navBase =
  "w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition hover:bg-slate-900/60";
const navActive = "bg-slate-900/70 ring-1 ring-slate-700/60";
const navInactive = "text-slate-200";

function NavButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      className={`${navBase} ${active ? navActive : navInactive}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function Sidebar({
  activeView,
  onNavigate,
  className = "",
  isAdmin = false,
}) {
  const isPredicciones =
    activeView === "pronosticos-grupos" ||
    activeView === "pronosticos-dieciseisavos" ||
    activeView === "pronosticos-octavos" ||
    activeView === "pronosticos-cuartos" ||
    activeView === "pronosticos-semifinal" ||
    activeView === "pronosticos-final";

  const isKnockoutResults =
    activeView === "fase-grupos" ||
    activeView === "dieciseisavos" ||
    activeView === "octavos" ||
    activeView === "cuartos" ||
    activeView === "semifinal" ||
    activeView === "final";

  const [openPronosticos, setOpenPronosticos] = useState(() => isPredicciones);
  const [openEliminatorias, setOpenEliminatorias] = useState(() => isKnockoutResults);

  const pronosticosItems = useMemo(
    () => [
      { id: "pronosticos-grupos", label: "Fase de grupos" },
      { id: "pronosticos-dieciseisavos", label: "16avos" },
      { id: "pronosticos-octavos", label: "8avos" },
      { id: "pronosticos-cuartos", label: "4tos" },
      { id: "pronosticos-semifinal", label: "Semifinales" },
      { id: "pronosticos-final", label: "Final" },
    ],
    [],
  );

  const extraPronosticosItems = useMemo(
    () => [
      { id: "goleadores", label: "Bota de oro" },
      { id: "mvp", label: "Balón de oro" },
      { id: "zamora", label: "Guante de oro" },
    ],
    [],
  );

  const knockoutItems = useMemo(
    () => [
      { id: "fase-grupos", label: "Fase de grupos" },
      { id: "dieciseisavos", label: "16avos" },
      { id: "octavos", label: "Octavos" },
      { id: "cuartos", label: "Cuartos" },
      { id: "semifinal", label: "Semifinal" },
      { id: "final", label: "Final" },
    ],
    [],
  );

  const adminResultadosExtraItems = useMemo(
    () => [
      { id: "admin-goleadores", label: "Bota de oro" },
      { id: "admin-mvp", label: "Balón de oro" },
      { id: "admin-zamora", label: "Guante de oro" },
    ],
    [],
  );

  return (
    <aside
      className={`h-full max-h-dvh overflow-y-auto overscroll-contain border-r border-slate-800 bg-slate-950/40 backdrop-blur ${className}`}
    >
      <div className="flex h-full flex-col gap-3 p-4">
        <div className="text-xs font-black tracking-widest text-slate-400">MENÚ</div>

        <nav className="grid gap-2">
          <NavButton active={activeView === "inicio"} onClick={() => onNavigate("inicio")}>
            Inicio
          </NavButton>

          {!isAdmin ? (
            <>
              <button
                type="button"
                className={`${navBase} ${isPredicciones ? navActive : navInactive}`}
                onClick={() => setOpenPronosticos((v) => !v)}
                aria-expanded={openPronosticos}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>Mis pronósticos</span>
                  <span className="text-xs text-slate-400">{openPronosticos ? "−" : "+"}</span>
                </div>
              </button>

              {openPronosticos ? (
                <div className="grid gap-1 pl-2">
                  {pronosticosItems.map((item) => (
                    <NavButton
                      key={item.id}
                      active={activeView === item.id}
                      onClick={() => onNavigate(item.id)}
                    >
                      {item.label}
                    </NavButton>
                  ))}

                  <div className="my-2 border-t border-slate-800/80" />

                  {extraPronosticosItems.map((item) => (
                    <NavButton
                      key={item.id}
                      active={activeView === item.id}
                      onClick={() => onNavigate(item.id)}
                    >
                      {item.label}
                    </NavButton>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {isAdmin ? (
            <>
              <button
                type="button"
                className={`${navBase} ${isKnockoutResults ? navActive : navInactive}`}
                onClick={() => setOpenEliminatorias((v) => !v)}
                aria-expanded={openEliminatorias}
              >
                <div className="flex items-center justify-between gap-2">
                  <span>Resultados</span>
                  <span className="text-xs text-slate-400">
                    {openEliminatorias ? "−" : "+"}
                  </span>
                </div>
              </button>

              {openEliminatorias ? (
                <div className="grid gap-1 pl-2">
                  {knockoutItems.map((item) => (
                    <NavButton
                      key={item.id}
                      active={activeView === item.id}
                      onClick={() => onNavigate(item.id)}
                    >
                      {item.label}
                    </NavButton>
                  ))}

                  <div className="my-2 border-t border-slate-800/80" />

                  {adminResultadosExtraItems.map((item) => (
                    <NavButton
                      key={item.id}
                      active={activeView === item.id}
                      onClick={() => onNavigate(item.id)}
                    >
                      {item.label}
                    </NavButton>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          <NavButton
            active={activeView === "clasificados"}
            onClick={() => onNavigate("clasificados")}
          >
            Clasificación
          </NavButton>

          <NavButton active={activeView === "resumen"} onClick={() => onNavigate("resumen")}>
            Resumen
          </NavButton>

          <NavButton
            active={activeView === "puntuaciones"}
            onClick={() => onNavigate("puntuaciones")}
          >
            Puntuaciones
          </NavButton>

          <NavButton active={activeView === "premios"} onClick={() => onNavigate("premios")}>
            Ganadores
          </NavButton>

          {isAdmin ? (
            <>
              <div className="mt-3 text-[11px] font-black tracking-widest text-slate-500">
                ADMIN
              </div>
              <NavButton
                active={activeView === "admin-users"}
                onClick={() => onNavigate("admin-users")}
              >
                Usuarios
              </NavButton>
              <NavButton
                active={activeView === "admin-predictions"}
                onClick={() => onNavigate("admin-predictions")}
              >
                Pronósticos
              </NavButton>
              <NavButton
                active={activeView === "admin-scoreboard"}
                onClick={() => onNavigate("admin-scoreboard")}
              >
                Puntuaciones (admin)
              </NavButton>
            </>
          ) : null}
        </nav>

        <div className="mt-auto text-xs text-slate-500">Navega por la app.</div>
      </div>
    </aside>
  );
}
