// src/api/config.js

const getBaseUrl = () => {
  const { protocol, hostname } = window.location;

  // If accessed via IP or hostname on LAN
  if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
    return `${protocol}//${hostname}:8000`;
  }

  // Local development fallback
  return `${protocol}//localhost:8000`;
};

export default getBaseUrl;
