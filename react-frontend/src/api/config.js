// src/api/config.js

const getBaseUrl = () => {
  let envUrl = "";

  // ✅ CRA environment variable (this is the only supported one)
  if (typeof process !== "undefined") {
    envUrl = process.env.REACT_APP_API_BASE_URL || "";
  }

  // ✅ Fallback: auto-detect based on hostname
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
