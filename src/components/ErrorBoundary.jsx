import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error("[moony] page crashed:", error); }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <div className="error-state" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
          <b>Something went wrong on this page.</b>
          <small style={{ color: "inherit" }}>{String(this.state.error?.message || this.state.error)}</small>
          <button className="btn ghost sm" onClick={() => this.setState({ error: null })}>Try again</button>
        </div>
      </div>
    );
  }
}
