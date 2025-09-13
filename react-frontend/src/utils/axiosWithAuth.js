// src/utils/axiosWithAuth.js
import axios from "axios";

const axiosWithAuth = () => {
  const token = localStorage.getItem("token");
  const baseURL =
    process.env.REACT_APP_API_BASE_URL ||
    `http://${window.location.hostname}:8000`; // fallback if env missing

  return axios.create({
    baseURL,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
};

export default axiosWithAuth;
