import axios from "axios"

export const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
})

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common.Authorization
  }
}
