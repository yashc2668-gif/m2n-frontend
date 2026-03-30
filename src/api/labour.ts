import { apiFetchList } from "@/api/client";
import type { Labour } from "@/api/types";

export function fetchLabours(token: string) {
  return apiFetchList<Labour>("/labours/", {
    token,
    query: { limit: 100 },
  });
}
