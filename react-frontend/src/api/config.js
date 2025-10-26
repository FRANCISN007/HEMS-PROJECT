// src/api/config.js
const getBaseUrl = () => {
  let envUrl = "";

  // ✅ Try Vite first (no crash if import.meta is undefined)
  try {
    envUrl = import.meta?.env?.VITE_API_BASE_URL || "";
  } catch {
    envUrl = "";
  }

  // ✅ Then try Create React App / Webpack
  if (!envUrl && typeof process !== "undefined") {
    envUrl = process.env?.REACT_APP_API_BASE_URL || "";
  }

  // ✅ If nothing found, detect from window hostname
  if (!envUrl || envUrl.trim() === "") {
    const hostname = window.location.hostname;
    if (hostname && hostname !== "localhost") {
      envUrl = `${window.location.protocol}//${hostname}:8000`;
    } else {
      envUrl = `${window.location.protocol}//localhost:8000`;
    }
  }

  return envUrl;
};

export default getBaseUrl;
