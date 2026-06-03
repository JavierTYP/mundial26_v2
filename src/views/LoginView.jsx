import { useMemo, useState } from "react";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import bannerImg from "../assets/mundial2026-typsa_16x9.png";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  DEFAULT_PASSWORD,
  isAllowedEmail,
  normalizeEmail,
  saveSessionSid,
} from "../utils/authStorage.js";
import { apiLogin, apiLoginSupabase } from "../utils/api.js";
import { supabase } from "../utils/supabaseClient.js";

export default function LoginView({ onLoggedIn, notify }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nick, setNick] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState("login"); // login | register

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const isAdminEmail = normalizedEmail === ADMIN_EMAIL;

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    let shouldResetModeToLogin = false;
    try {
      if (!normalizedEmail) {
        notify({ tone: "error", message: "Introduce un email." });
        return;
      }
      if (!isAllowedEmail(normalizedEmail)) {
        notify({ tone: "error", message: "Solo se permiten emails @typsa.es" });
        return;
      }
      if (mode === "register" && !nick.trim()) {
        notify({ tone: "error", message: "Introduce un nick." });
        return;
      }
      if (!password) {
        notify({ tone: "error", message: "Introduce una contraseña." });
        return;
      }
      const expectedPassword = normalizedEmail === ADMIN_EMAIL ? ADMIN_PASSWORD : DEFAULT_PASSWORD;
      if (password !== expectedPassword) {
        notify({ tone: "error", message: "Contraseña incorrecta." });
        return;
      }

      let res;
      if (supabase) {
        try {
          if (mode === "register") {
            const { data, error } = await supabase.auth.signUp({
              email: normalizedEmail,
              password,
            });
            if (error) throw error;
            const accessToken = data?.session?.access_token ?? null;
            if (!accessToken) {
              notify({ tone: "error", message: "No se pudo iniciar sesión." });
              return;
            }
            res = await apiLoginSupabase(accessToken, nick.trim());
          } else {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password,
            });
            if (error) throw error;
            const accessToken = data?.session?.access_token ?? null;
            if (!accessToken) {
              notify({ tone: "error", message: "No se pudo iniciar sesión." });
              return;
            }
            res = await apiLoginSupabase(accessToken, null);
          }
        } catch (err) {
          const msg = String(err?.message ?? err);
          if (msg.toLowerCase().includes("invalid login")) {
            notify({ tone: "error", message: "Contraseña incorrecta." });
            return;
          }
          notify({ tone: "error", message: "No se pudo iniciar sesión." });
          return;
        }
      } else {
        // Local/simple auth fallback (no Supabase configured).
        try {
          res = await apiLogin(normalizedEmail, password, mode === "register" ? nick.trim() : null);
        } catch (err) {
          const apiError = err?.data?.error ?? err?.message ?? "request_failed";
          if (apiError === "user_not_registered") {
            notify({ tone: "info", message: "Usuario no registrado" });
            setMode("register");
            return;
          }
          if (apiError === "invalid_password") {
            notify({ tone: "error", message: "Contraseña incorrecta." });
            return;
          }
          if (apiError === "invalid_email") {
            notify({ tone: "error", message: "Email inválido." });
            return;
          }
          notify({ tone: "error", message: "No se pudo iniciar sesión." });
          return;
        }
      }

      if (mode === "register") {
        if (res.status === "created") notify({ tone: "success", message: "Usuario registrado correctamente" });
        else notify({ tone: "info", message: "Usuario existente" });
      } else if (res.status === "created") {
        notify({ tone: "success", message: "Usuario registrado correctamente" });
      }

      if (res?.sid) saveSessionSid(res.sid);
      onLoggedIn(res.user);
      shouldResetModeToLogin = true;
    } finally {
      setSubmitting(false);
      if (shouldResetModeToLogin) setMode("login");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto grid min-h-screen max-w-7xl place-items-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40">
            <img
              src={bannerImg}
              alt="Mundial 2026 TYPSA"
              className="mx-auto h-auto max-h-[32vh] w-full object-contain"
              loading="eager"
            />
          </div>

          <Card className="w-full p-6">
            <h1 className="text-2xl font-black tracking-tight text-slate-100">Acceso de usuarios</h1>

            <p className="mt-3 text-sm text-slate-300">
              Email <span className="font-mono">'tuemail@typsa.es'</span> y contraseña{" "}
              <span className="font-mono">'{DEFAULT_PASSWORD}'</span>
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-300">USER</div>
                <input
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none ring-1 ring-black/5 placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                  type="email"
                  autoComplete="username"
                  placeholder="nombre@typsa.es"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <label className="block">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-300">PASSWORD</div>
                <input
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none ring-1 ring-black/5 placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder={DEFAULT_PASSWORD}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

              {mode === "register" ? (
                <label className="block">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-300">NICK</div>
                  <input
                    className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none ring-1 ring-black/5 placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                    type="text"
                    autoComplete="nickname"
                    placeholder="Nombre jugador/equipo"
                    value={nick}
                    onChange={(e) => setNick(e.target.value)}
                  />
                </label>
              ) : null}

              <div className="grid gap-2">
                {mode === "login" ? (
                  <>
                    <Button className="w-full" disabled={submitting} type="submit">
                      Entrar
                    </Button>
                    <Button
                      className="w-full"
                      variant="secondary"
                      disabled={submitting}
                      type="button"
                      onClick={() => setMode("register")}
                    >
                      Crear nuevo usuario
                    </Button>
                  </>
                ) : (
                  <>
                    <Button className="w-full" disabled={submitting} type="submit">
                      Crear nuevo usuario
                    </Button>
                    <Button
                      className="w-full"
                      variant="secondary"
                      disabled={submitting}
                      type="button"
                      onClick={() => setMode("login")}
                    >
                      Volver
                    </Button>
                  </>
                )}
              </div>
            </form>
          </Card>

          <div className="mt-6 text-center text-xs text-slate-500">
            <div>© 2026 Jobiyo · Todos los derechos reservados</div>
            <div className="mt-1">
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
