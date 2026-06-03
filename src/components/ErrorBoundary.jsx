import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error: error instanceof Error ? error : new Error("unknown_error") };
  }

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;
    if (!error) return children;

    if (typeof fallback === "function") return fallback({ error });

    return (
      <div className="rounded-2xl border border-rose-900/40 bg-rose-950/25 p-4 text-sm text-slate-200">
        <div className="font-black">Se ha producido un error al renderizar esta pantalla.</div>
        <div className="mt-2 font-mono text-xs text-rose-100">{error.message}</div>
      </div>
    );
  }
}

