const { Client } = require("@xhayper/discord-rpc");

class DiscordStatus {
  constructor() {
    this.client = null;
    this.clientId = null;
    this.activity = null;
    this.state = "off";
    this.retry = null;
  }

  async configure(clientId) {
    const id = /^\d{15,25}$/.test(String(clientId || "")) ? String(clientId) : null;
    if (id === this.clientId && this.client) return this.state;
    await this.disconnect();
    this.clientId = id;
    if (id) await this.connect();
    return this.state;
  }

  async connect() {
    clearTimeout(this.retry);
    if (!this.clientId) return;
    this.state = "connecting";
    const client = new Client({ clientId: this.clientId, transport: { type: "ipc" } });
    client.on("disconnected", () => { this.state = "unavailable"; this.scheduleRetry(); });
    try {
      await Promise.race([client.login(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 10000))]);
      this.client = client;
      this.state = "connected";
      if (this.activity) await this.push();
    } catch {
      this.state = "unavailable";
      try { await client.destroy(); } catch { }
      this.scheduleRetry();
    }
  }

  scheduleRetry() {
    clearTimeout(this.retry);
    this.client = null;
    if (this.clientId) this.retry = setTimeout(() => this.connect(), 30000);
  }

  async disconnect() {
    clearTimeout(this.retry);
    const c = this.client;
    this.client = null;
    this.state = "off";
    if (c) { try { await c.user?.clearActivity(); } catch {} try { await c.destroy(); } catch {} }
  }

  async set(activity) {
    this.activity = activity;
    await this.push();
  }

  async push() {
    if (!this.client?.user) return;
    try {
      if (!this.activity) await this.client.user.clearActivity();
      else await this.client.user.setActivity(this.activity);
    } catch { }
  }
}

module.exports = { DiscordStatus };
