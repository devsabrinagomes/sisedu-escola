import type { AxiosRequestConfig } from "axios";
import { api } from "@/lib/api";

export function isNotFound(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404;
}

export async function getWithFallback<T>(
  primaryUrl: string,
  fallbackUrl: string,
  config?: AxiosRequestConfig,
) {
  try {
    const { data } = await api.get<T>(primaryUrl, config);
    return data;
  } catch (error) {
    if (!isNotFound(error)) throw error;
    const { data } = await api.get<T>(fallbackUrl, config);
    return data;
  }
}
