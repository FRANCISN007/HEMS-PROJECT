// src/api/authService.js
import axios from "axios";

const BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  `http://${window.location.hostname}:8000`;

console.log("🧪 Login API Base URL:", BASE_URL);

const authClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Login user (now only one call)
export const loginUser = async (username, password) => {
  try {
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    // 1️⃣ Request token & user info in one step
    const response = await authClient.post("/users/token", formData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const user = response.data; // { id, username, roles, access_token, token_type }

    // 2️⃣ Save to localStorage
    localStorage.setItem("user", JSON.stringify(user));

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
      roles, // array of roles
      admin_password,
    });

    return response.data;
  } catch (error) {
    console.error("❌ Registration failed:", error);
    throw error.response?.data || { message: "Registration failed" };
  }
};

// ✅ Utility: get current user from localStorage
export const getCurrentUser = () => {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
};

// ✅ Utility: logout
export const logoutUser = () => {
  localStorage.removeItem("user");
};
