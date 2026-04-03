import type { DocumentEntityType } from '@/api/types';

type QuotationEntityType = Extract<DocumentEntityType, 'vendor' | 'company'>;

export interface PendingQuotationContext {
  entityType: QuotationEntityType;
  entityId: number;
  openComposer?: boolean;
}

const storageKey = 'm2n.quotations.pending-context';

export function stageQuotationContext(context: PendingQuotationContext) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(storageKey, JSON.stringify(context));
}

export function consumeQuotationContext(): PendingQuotationContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(storageKey);

  try {
    const parsed = JSON.parse(raw) as PendingQuotationContext;
    if (
      (parsed.entityType === 'vendor' || parsed.entityType === 'company') &&
      Number.isInteger(parsed.entityId) &&
      parsed.entityId > 0
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}
