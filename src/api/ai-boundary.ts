import { apiFetch } from '@/api/client';
import type {
  AIBoundaryEvaluationRequest,
  AIBoundaryEvaluationResponse,
  AIBoundaryPolicy,
} from '@/api/types';

export function fetchAiBoundaryPolicy(token: string) {
  return apiFetch<AIBoundaryPolicy>('/ai-boundary', { token });
}

export function evaluateAiBoundary(token: string, payload: AIBoundaryEvaluationRequest) {
  return apiFetch<AIBoundaryEvaluationResponse>('/ai-boundary/evaluate', {
    method: 'POST',
    token,
    body: payload,
  });
}
