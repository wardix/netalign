import { COLLAB_CLIENT_HEADER } from '../../shared/collabProtocol.ts';
import { isApiErrorCode, type ApiErrorCode } from '../../shared/apiErrors.ts';
import { API_BASE } from '../api.ts';
import { getCollabClientId } from '../collab/clientId.ts';

export class ApiError extends Error {
  status: number;
  code?: ApiErrorCode;

  constructor(message: string, status: number, code?: ApiErrorCode) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface ApiErrorBody {
  error?: string;
  code?: string;
}

async function readErrorBody(res: Response): Promise<{ message: string; code?: ApiErrorCode }> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    const message = body.error || res.statusText || 'Request failed';
    const code = isApiErrorCode(body.code) ? body.code : undefined;
    return { message, code };
  } catch {
    return { message: res.statusText || 'Request failed' };
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const { message, code } = await readErrorBody(res);
    throw new ApiError(message, res.status, code);
  }
  return (await res.json()) as T;
}

function buildUrl(path: string): string {
  return `${API_BASE}${path}`;
}

function collabHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  try {
    headers.set(COLLAB_CLIENT_HEADER, getCollabClientId());
  } catch {
    // ignore missing storage
  }
  return headers;
}

const credentials: RequestCredentials = 'include';

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(buildUrl(path), { headers: collabHeaders(), credentials });
  return handleResponse<T>(res);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: collabHeaders({ 'Content-Type': 'application/json' }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials,
  });
  return handleResponse<T>(res);
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'PUT',
    headers: collabHeaders({ 'Content-Type': 'application/json' }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials,
  });
  return handleResponse<T>(res);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'PATCH',
    headers: collabHeaders({ 'Content-Type': 'application/json' }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials,
  });
  return handleResponse<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'DELETE',
    headers: collabHeaders(),
    credentials,
  });
  return handleResponse<T>(res);
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function getApiErrorCode(error: unknown): ApiErrorCode | undefined {
  if (error instanceof ApiError) return error.code;
  return undefined;
}
