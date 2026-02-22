import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { api, setAuthToken } from "@/lib/api"

type AuthContextValue = {
  token: string
  isAuthed: boolean
  username: string
  userId?: number
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// JWT helpers
function parseJwt(token: string): any | null {
  try {
    const base64Url = token.split(".")[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string>(() => localStorage.getItem("access_token") || "")
  const [username, setUsername] = useState<string>(() => localStorage.getItem("username") || "")
  const [userId, setUserId] = useState<number | undefined>(() => {
    const t = localStorage.getItem("access_token") || ""
    const payload = t ? parseJwt(t) : null
    return payload?.user_id ?? payload?.id
  })

  // sempre que token mudar, atualiza axios + localStorage + userId
  useEffect(() => {
    if (token) {
      setAuthToken(token)
      localStorage.setItem("access_token", token)

      const payload = parseJwt(token)
      setUserId(payload?.user_id ?? payload?.id)
    } else {
      setAuthToken(null)
      localStorage.removeItem("access_token")
      setUserId(undefined)
    }
  }, [token])

  // sempre que username mudar, salva
  useEffect(() => {
    if (username) localStorage.setItem("username", username)
    else localStorage.removeItem("username")
  }, [username])

  async function login(user: string, password: string) {
    const { data } = await api.post<{ access: string; refresh: string }>("/auth/token/", {
      username: user,
      password,
    })

    localStorage.setItem("refresh_token", data.refresh)
    setToken(data.access)
    setUsername(user)
  }

  function logout() {
    localStorage.removeItem("refresh_token")
    setToken("")
    setUsername("")
  }

  const value = useMemo<AuthContextValue>(
    () => ({ token, isAuthed: !!token, username, userId, login, logout }),
    [token, username, userId]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider")
  return ctx
}
