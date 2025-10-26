// src/api/licenseApi.js
import axios from "axios";
import getBaseUrl from "./config";

const BASE_URL = getBaseUrl();

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export const verifyLicense = async (licenseKey) => {
  try {
    const response = await apiClient.get(`/license/verify/${encodeURIComponent(licenseKey)}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: "API request failed" };
  }
};

export const generateLicense = async (adminPassword, licenseKey) => {
  if (!adminPassword || !licenseKey) {
    throw new Error("Admin password and license key are required.");
  }

  try {
    // ✅ Send FormData (matches backend Form(...))
    const formData = new FormData();
    formData.append("license_password", adminPassword);
    formData.append("key", licenseKey);

    const response = await apiClient.post(`/license/generate`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return response.data;
  } catch (error) {
    throw error.response?.data || { message: "API request failed" };
  }
};

export const checkLicenseStatus = async () => {
  try {
    const response = await apiClient.get(`/license/check`);
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: "License check failed" };
  }
};
