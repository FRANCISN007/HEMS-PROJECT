const getBaseUrl = () => {
  let envUrl = "";

  if (typeof process !== "undefined") {
    envUrl = process.env.REACT_APP_API_BASE_URL || "";
  }

  if (!envUrl || envUrl.trim() === "") {
    const hostname = window.location.hostname;
    envUrl = `${window.location.protocol}//${hostname}:8000`;
  }

  return envUrl;
};

export default getBaseUrl;
