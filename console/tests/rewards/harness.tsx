"use client";

import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import PersistentRewardsPanel from "../../src/components/console/PersistentRewardsPanel";

function Harness() {
  const [tab, setTab] = useState<"other" | "rewards">("other");
  const [user, setUser] = useState<"user-a" | "user-b" | null>("user-a");
  const [unclaimed, setUnclaimed] = useState(0);
  const session = useMemo(() => user ? {
    user: { id: user }, access_token: `token-${user}`,
  } : null, [user]);

  return (
    <>
      <nav>
        <button onClick={() => setTab("other")}>Other tab</button>
        <button onClick={() => setTab("rewards")}>Rewards tab</button>
        <button onClick={() => { setUser(null); setTab("other"); }}>Sign out</button>
        <button onClick={() => { setUser("user-b"); setTab("other"); }}>Sign in as B</button>
      </nav>
      <div data-testid="unclaimed">{unclaimed}</div>
      <main>
        <PersistentRewardsPanel
          active={tab === "rewards"}
          session={session}
          apiBase={window.location.origin}
          onUnclaimedCount={setUnclaimed}
        />
        {tab !== "rewards" && <div>Other content</div>}
      </main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
