// Local test harness only; never imported by Next's production routes.
import "../../src/styles/globals.css";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { OrgProvider, useOrgContext } from "../../src/components/console/OrgContext";
import BucketsPanel from "../../src/components/console/panels/BucketsPanel";

function WorkspaceControls() {
  const { setActiveSlug } = useOrgContext();
  return <nav aria-label="Test workspaces"><button onClick={() => setActiveSlug("acme")}>Select Acme</button><button onClick={() => setActiveSlug(null)}>Select Personal</button><button onClick={() => setActiveSlug("unavailable")}>Select unavailable organization</button></nav>;
}

function WorkspacePanel({ apiBase, session }: { apiBase: string; session: { access_token: string } }) {
  const { activeOrg } = useOrgContext();
  const key = new URLSearchParams(location.search).has("remount") ? activeOrg?.id || "personal" : "stable";
  return <BucketsPanel key={key} apiBase={apiBase} session={session} />;
}

function Harness() {
  const [key, setKey] = useState("");
  const [token, setToken] = useState("");
  const apiBase = "https://localhost:58080";
  if (!token) return <main><h1>Buckets E2E sandbox</h1><p>Use a generated local sandbox key. This page is a local test harness.</p>
    <label>Sandbox API key <input type="password" aria-label="Sandbox API key" value={key} onChange={(e) => setKey(e.target.value)} /></label>
    <button onClick={() => { setToken(key); setKey(""); }}>Open sandbox</button></main>;
  const session = { access_token: token };
  return <main style={{ maxWidth: 1400, padding: "24px", margin: "0 auto" }}><button onClick={() => setToken("")}>Change sandbox key</button>
    <OrgProvider session={session} apiBase={apiBase}>
      <WorkspaceControls /><WorkspacePanel apiBase={apiBase} session={session} />
    </OrgProvider></main>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
