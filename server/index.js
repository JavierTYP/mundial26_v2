import app from "./app.js";

const PORT = Number(process.env.PORT ?? 5174);
const HOST = process.env.HOST ?? "0.0.0.0";

// When running the local server we want Express to serve the Vite build too.
process.env.SERVE_STATIC = process.env.SERVE_STATIC ?? "1";

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://${HOST}:${PORT}`);
});

