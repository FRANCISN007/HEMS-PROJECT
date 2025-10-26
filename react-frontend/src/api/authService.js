// src/api/authService.js
import axios from "axios";
import getBaseUrl from "./config";

let BASE_URL = getBaseUrl();

const testBackend = async (url) => {
  try {
    const response = await fetch(`${url}/health`, { method: "GET", cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
};

(async () => {
  const reachable = await testBackend(BASE_URL);
  if (!reachable && !BASE_URL.includes("localhost")) {
    console.warn(`⚠️ Backend not reachable at ${BASE_URL}, switching to localhost.`);
    BASE_URL = `${window.location.protocol}//localhost:8000`;
  }
  console.log("✅ Using API Base URL:", BASE_URL);
})();

const authClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ✅ Login user
export const loginUser = async (username, password) => {
  try {
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    const response = await authClient.post("/users/token", formData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const user = response.data;
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("token", user.access_token);
    return user;
  } catch (error) {
    console.error("❌ Login failed:", error);
    throw error.response?.data || { message: "Login failed" };
  }
};

// ✅ Register user
export const registerUser = async ({ username, password, roles, admin_password }) => {
  try {
    const response = await authClient.post("/users/register/", {
      username,
      password,
      roles,
      admin_password,
    });
    return response.data;
  } catch (error) {
    console.error("❌ Registration failed:", error);
    throw error.response?.data || { message: "Registration failed" };
  }
};

export const getCurrentUser = () => {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
};

export const logoutUser = () => {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
};
