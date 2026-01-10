import axios from "axios";
import getBaseUrl from "../api/config";

const axiosWithAuth = () => {
  const token = localStorage.getItem("token");
  const licenseKey = localStorage.getItem("license_key");
  const baseURL = getBaseUrl(); // ✅ SINGLE SOURCE

  if (!baseURL) {
    console.error("❌ API base URL could not be resolved");
  }

  const instance = axios.create({
    baseURL,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      ...(licenseKey ? { "X-License-Key": licenseKey } : {}),
    },
  });

  // ✅ Only set JSON header if NOT FormData
  instance.interceptors.request.use((config) => {
    if (!(config.data instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    }
    return config;
  });

  return instance;
};

export default axiosWithAuth;
