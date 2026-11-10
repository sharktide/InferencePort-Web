"use client";

import { useEffect, useState } from "react";
import RewardsPanel from "./RewardsPanel";
import styles from "./ConsoleLayout.module.css";

interface Props {
  active: boolean;
  session: any;
  apiBase: string;
  onUnclaimedCount?: (count: number) => void;
}

/** Keep rewards alive across tab switches, but never share its state between accounts. */
export default function PersistentRewardsPanel({ active, session, apiBase, onUnclaimedCount }: Props) {
  const userId: string | undefined = session?.user?.id;
  const [visitedUserId, setVisitedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (active && userId && session?.access_token) setVisitedUserId(userId);
  }, [active, userId, session?.access_token]);

  // Do not prefetch for users who never opened Rewards, or render another user's cached data.
  if (!userId || !session?.access_token || (!active && visitedUserId !== userId)) return null;

  return (
    <div
      className={styles.contextFrame}
      style={active ? undefined : { display: "none" }}
      aria-hidden={!active}
    >
      <RewardsPanel
        key={`${userId}:${apiBase}`}
        session={session}
        apiBase={apiBase}
        onUnclaimedCount={onUnclaimedCount}
      />
    </div>
  );
}
