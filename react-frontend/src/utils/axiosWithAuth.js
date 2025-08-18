// src/utils/axiosWithAuth.js
import axios from "axios";

const axiosWithAuth = () => {
  const token = localStorage.getItem("token"); // or sessionStorage, based on where you store it

  return axios.create({
    baseURL: "http://localhost:8000", // adjust to match your FastAPI backend base URL
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
};

export default axiosWithAuth;
