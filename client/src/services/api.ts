import type { ErrorMsg } from "@gamenite/shared";
import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

/** Returns true if the error represents a transient server issue (5xx) */
export function isServerError(error: unknown): boolean {
  if (axios.isAxiosError(error) && error.response) {
    return error.response.status >= 500;
  }
  // Network errors (no response at all) are also transient
  if (axios.isAxiosError(error) && !error.response) {
    return true;
  }
  return false;
}

/**
 * Function to handle successful responses
 */
const handleRes = (res: AxiosResponse) => res;

/**
 * Function to handle errors
 */
const handleErr = (err: AxiosError) => {
  return Promise.reject(err);
};

export const api = axios.create({ withCredentials: true });

/**
 * Add a request interceptor to the Axios instance.
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => config,
  (error: AxiosError) => handleErr(error),
);

/**
 * Add a response interceptor to the Axios instance.
 */
api.interceptors.response.use(
  (response: AxiosResponse) => handleRes(response),
  (error: AxiosError) => handleErr(error),
);

/**
 * @param error An unknown exception
 * @returns An error message, with `serverError: true` if it was a 5xx/network error
 */
export function exceptionToErrorMsg(error: unknown): ErrorMsg & { serverError?: boolean } {
  const serverErr = isServerError(error);
  if (axios.isAxiosError(error) && error.response) {
    const data = error.response.data as Record<string, unknown>;
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      return { error: data.error, ...(serverErr && { serverError: true }) };
    }
    return {
      error: `Error during request: ${error.response.statusText}`,
      ...(serverErr && { serverError: true }),
    };
  }
  return { error: "Error during request", ...(serverErr && { serverError: true }) };
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Wraps an async API call with retry logic for transient 5xx / network errors.
 * Only retries on server errors; client errors (4xx) are returned immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isServerError(err) || attempt === MAX_RETRIES) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
  throw lastError;
}
