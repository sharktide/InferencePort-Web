export type ApiPrefix = "/v1" | "/gen";

/** Props every modality studio receives from the Playground shell. */
export interface StudioProps {
  session: any;
  apiBase: string;
  /** "/v1" = P2G API, "/gen" = subscription Gen API. */
  apiPrefix: ApiPrefix;
  /** Full /v1/models catalog (already filtered to is_ready !== false). */
  models: any[];
  theme: "light" | "dark";
}
