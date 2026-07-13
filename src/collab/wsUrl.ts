import { API_BASE } from '../api.ts';
import { COLLAB_WS_PATH } from '../../shared/collabProtocol.ts';

/**
 * Build a WebSocket URL for the collab endpoint.
 * Honors `VITE_API_BASE` / same-origin resolution used by REST.
 */
export function buildCollabWsUrl(topologyId: string, clientId: string): string {
  const params = new URLSearchParams({
    topologyId,
    clientId,
  });
  const path = `${COLLAB_WS_PATH}?${params.toString()}`;

  if (API_BASE) {
    const httpBase = API_BASE.replace(/\/+$/, '');
    const wsBase = httpBase.replace(/^http/, 'ws');
    return `${wsBase}${path}`;
  }

  if (typeof window === 'undefined') {
    return `ws://localhost:5000${path}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}
