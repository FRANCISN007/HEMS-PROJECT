import axios from "axios";

const axiosWithAuth = () => {
  const token = localStorage.getItem("token");
  const licenseKey = localStorage.getItem("license_key"); // optional but good to send
  const baseURL = process.env.REACT_APP_API_BASE_URL;

  if (!baseURL) {
    console.error("❌ REACT_APP_API_BASE_URL is not set in .env");
  }

  const instance = axios.create({
    baseURL,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      ...(licenseKey ? { "X-License-Key": licenseKey } : {}),
    },
  });

  // ✅ Request interceptor: only set JSON if body is not FormData
  instance.interceptors.request.use((config) => {
    if (!(config.data instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    }
    return config;
  });

  return instance;
};

export default axiosWithAuth;
