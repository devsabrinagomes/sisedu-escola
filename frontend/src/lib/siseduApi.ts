import axios from "axios";
import { API_BASE_URL } from "@/lib/apiConfig";
import { handleSessionExpired } from "@/lib/sessionExpired";

export const siseduApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

siseduApi.interceptors.request.use((config) => {
  config.withCredentials = true;
  return config;
});

siseduApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      handleSessionExpired();
    }
    throw error;
  },
);

