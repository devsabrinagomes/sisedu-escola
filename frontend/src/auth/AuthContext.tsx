import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { api, setAuthToken } from "@/lib/api"

type AuthContextValue = {
  token: string
  isAuthed: boolean
  username: string
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string>(() => {
    return localStorage.getItem("access_token") || ""
  })

  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem("username") || ""
  })

  // sempre que token mudar, atualiza axios + localStorage
  useEffect(() => {
    if (token) {
      setAuthToken(token)
      localStorage.setItem("access_token", token)
    } else {
      setAuthToken(null)
      localStorage.removeItem("access_token")
    }
  }, [token])

  // sempre que username mudar, salva
  useEffect(() => {
    if (username) {
      localStorage.setItem("username", username)
    } else {
      localStorage.removeItem("username")
    }
  }, [username])

  async function login(user: string, password: string) {
    try {
      const { data } = await api.post<{
        access: string
        refresh: string
      }>("/auth/token/", {
        username: user,
        password,
      })

      setToken(data.access)
      setUsername(user)
    } catch (e: any) {
      console.error("ERRO LOGIN:", {
        url: e?.config?.url,
        baseURL: e?.config?.baseURL,
        status: e?.response?.status,
        data: e?.response?.data,
      })
      throw e
    }
  }

  function logout() {
    setToken("")
    setUsername("")
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthed: !!token,
      username,
      login,
      logout,
    }),
    [token, username]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider")
  }
  return ctx
}
