/**
 * CarePath — Centralized Axios Client
 * Single HTTP client used by every service module.
 * Base URL comes from environment configuration, never hardcoded per-call.
 */

import axios from 'axios';

/** Prefer VITE_API_BASE_URL, fall back to legacy VITE_API_URL, then local dev default. */
export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'http://127.0.0.1:8000/api/v1';

export const TOKEN_KEY = 'cp_token';

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 30000,
});

/** Attach JWT token to every request if present */
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Normalize errors and handle expired sessions */
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    if (import.meta.env.DEV) {
      console.error('[CarePath API]', status, err?.config?.url, err?.response?.data);
    }

    // Expired / invalid session — clear token so route guards redirect to login.
    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
    }

    return Promise.reject(err);
  },
);

/**
 * Turn an unknown axios error into a human-readable message.
 * Used by every screen's error state so messages stay consistent.
 */
export function toApiError(err: unknown): { status?: number; message: string } {
  if (err && typeof err === 'object' && 'response' in err) {
    const e = err as {
      response?: { status?: number; data?: { detail?: unknown } };
      code?: string;
    };
    const status = e.response?.status;
    const detail = e.response?.data?.detail;

    // Upstream microservice failures (e.g. Appointment Agent unreachable) come
    // back as raw exception text — never show that verbatim to the patient.
    if (status === 502 || status === 503 || status === 504) {
      return { status, message: 'The scheduling service is temporarily unavailable. Please try again in a moment.' };
    }

    if (typeof detail === 'string') return { status, message: detail };
    // FastAPI 422 returns an array of validation issues
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string; loc?: string[] } | undefined;
      if (first?.msg) {
        const field = first.loc?.filter((p) => p !== 'body').join('.') ?? '';
        return { status, message: field ? `${field}: ${first.msg}` : first.msg };
      }
    }

    switch (status) {
      case 400: return { status, message: 'The request was rejected. Please check the values and try again.' };
      case 401: return { status, message: 'Your session has expired. Please sign in again.' };
      case 403: return { status, message: 'You do not have permission to view this.' };
      case 404: return { status, message: 'We could not find what you were looking for.' };
      case 422: return { status, message: 'Some fields are invalid. Please review the form.' };
      case 500: return { status, message: 'The server ran into a problem. Please try again shortly.' };
      default: break;
    }

    if (!e.response) {
      return { message: 'Unable to reach the CarePath server. Please check your connection.' };
    }
  }
  return { message: 'Something went wrong. Please try again.' };
}

export default client;
