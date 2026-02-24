import axios from "axios"
import { API_BASE_URL } from "@/lib/apiConfig"

export const api = axios.create({
  baseURL: API_BASE_URL,
})

function getAccessToken() {
  return localStorage.getItem("access_token")
}

function getRefreshToken() {
  return localStorage.getItem("refresh_token")
}

function clearStoredTokens() {
  localStorage.removeItem("access_token")
  localStorage.removeItem("refresh_token")
}

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common.Authorization
  }
}

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    const originalRequest = error?.config as any

    if (status !== 401 || !originalRequest) {
      throw error
    }

    const requestUrl = String(originalRequest?.url || "")
    if (
      originalRequest._retry ||
      requestUrl.includes("/auth/token/") ||
      requestUrl.includes("/auth/refresh/")
    ) {
      throw error
    }

    const refresh = getRefreshToken()
    if (!refresh) {
      clearStoredTokens()
      throw error
    }

    if (!refreshPromise) {
      refreshPromise = axios
        .post(`${api.defaults.baseURL}/auth/refresh/`, { refresh })
        .then((res) => {
          const nextAccess = res?.data?.access as string | undefined
          if (!nextAccess) return null
          localStorage.setItem("access_token", nextAccess)
          setAuthToken(nextAccess)
          return nextAccess
        })
        .catch((refreshError) => {
          clearStoredTokens()
          setAuthToken(null)
          throw refreshError
        })
        .finally(() => {
          refreshPromise = null
        })
    }

    const nextAccess = await refreshPromise
    if (!nextAccess) throw error

    originalRequest._retry = true
    originalRequest.headers = originalRequest.headers ?? {}
    originalRequest.headers.Authorization = `Bearer ${nextAccess}`
    return api(originalRequest)
  }
)
