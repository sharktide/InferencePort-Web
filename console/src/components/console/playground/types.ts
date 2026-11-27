export type ApiPrefix = "/v1" | "/gen";

/** Props every modality studio receives from the Playground shell. */
export interface StudioProps {
  session: any;
  apiBase: string;
  /** "/v1" = P2G API, "/gen" = subscription Gen API. */
  apiPrefix: ApiPrefix;
  /** Active /v1/models or /gen/models catalog, filtered to ready models. */
  models: any[];
  /** Optional catalog launch selection; studios apply it only when it belongs to their catalog. */
  initialModel?: string;
  theme: "light" | "dark";
  /** False while the studio is hidden (another modality is open); long-running sessions should end. */
  active?: boolean;
}
