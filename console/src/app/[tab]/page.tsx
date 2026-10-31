import ConsoleLayout from "@/components/console/ConsoleLayout";
import { CONSOLE_ROUTE_SLUGS } from "@/lib/consoleTabs";

/* next.config.js uses output: "export", so each console tab must have a build-time route. */
export function generateStaticParams() {
  return CONSOLE_ROUTE_SLUGS.map((tab) => ({ tab }));
}

export default function ConsoleTabPage() {
  return <ConsoleLayout />;
}
