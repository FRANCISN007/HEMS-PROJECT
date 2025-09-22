import axios from "axios";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || `http://${window.location.hostname}:8000`;

export const updateApp = async () => {
  const response = await axios.post(`${API_BASE_URL}/system/update-app`);
  return response.data;
};


