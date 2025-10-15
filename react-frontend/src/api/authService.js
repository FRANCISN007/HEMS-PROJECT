// src/api/authService.js
import axios from "axios";

// 🧭 Smart backend URL selector with fallback to localhost
let BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000`;

// Function to verify if the backend is reachable
const testBackend = async (url) => {
  try {
    await fetch(url + "/health", { method: "GET", cache: "no-store" });
    return true;
  } catch {
    return false;
  }
};

(async () => {
  const isReachable = await testBackend(BASE_URL);
  if (!isReachable && window.location.hostname !== "localhost") {
    console.warn(`⚠️ ${BASE_URL} not reachable, switching to localhost.`);
    BASE_URL = `${window.location.protocol}//localhost:8000`;
  }
  console.log("🧪 Final API Base URL:", BASE_URL);
})();

// Create axios client
const authClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Login user (with dynamic IP fallback)
export const loginUser = async (username, password) => {
  try {
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    const response = await authClient.post("/users/token", formData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const user = response.data; // { id, username, roles, access_token, token_type }

    // Save user info
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("token", user.access_token);

    return user;
  } catch (error) {
    console.error("❌ Login failed:", error);
    throw error.response?.data || { message: "Login failed" };
  }
};

// ✅ Register user
export const registerUser = async ({
  username,
  password,
  roles,
  admin_password,
}) => {
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

// ✅ Utility: get current user
export const getCurrentUser = () => {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
};

// ✅ Utility: logout
export const logoutUser = () => {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
};
