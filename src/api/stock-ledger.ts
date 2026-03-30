import { apiFetchList } from '@/api/client';
import type { InventoryTransaction } from '@/api/types';

export function fetchStockLedger(token: string) {
  return apiFetchList<InventoryTransaction>('/stock-ledger/', {
    token,
    query: { limit: 20 },
  });
}
