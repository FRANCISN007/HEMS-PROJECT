import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import getBaseUrl from "../../api/config";

import "./ListVendor.css";

const API_BASE_URL = getBaseUrl();

const ListVendor = () => {
  const [vendors, setVendors] = useState([]);
  const [formData, setFormData] = useState({
    business_name: "",
    address: "",
    phone_number: "",
  });
  const [message, setMessage] = useState("");

  // ===============================
  // ROLE CHECK
  // ===============================
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];

  if (Array.isArray(storedUser.roles)) {
    roles = storedUser.roles;
  } else if (typeof storedUser.role === "string") {
    roles = [storedUser.role];
  }

  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("store"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to create and list vendor.</p>
      </div>
    );
  }

  // ===============================
  // FETCH VENDORS
  // ===============================
  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const axios = axiosWithAuth(API_BASE_URL);
      const response = await axios.get("/vendor/");

      if (Array.isArray(response.data)) {
        setVendors(response.data);
      } else {
        console.error("Expected array, got:", response.data);
        setVendors([]);
      }
    } catch (error) {
      console.error("Error fetching vendors:", error);
      setVendors([]);
    }
  };

  // ===============================
  // DELETE VENDOR
  // ===============================
  const handleDelete = async (vendorId) => {
    if (!window.confirm("Are you sure you want to delete this vendor?")) return;

    try {
      const axios = axiosWithAuth(API_BASE_URL);
      await axios.delete(`/vendor/${vendorId}`);
      fetchVendors();
    } catch (error) {
      console.error("Error deleting vendor:", error);
    }
  };

  // ===============================
  // UPDATE VENDOR
  // ===============================
  const handleUpdate = async (vendor) => {
    const newName = prompt("Enter new business name", vendor.business_name);
    const newPhone = prompt("Enter new phone number", vendor.phone_number);
    const newAddress = prompt("Enter new address", vendor.address);

    if (!newName || !newPhone || !newAddress) {
      alert("All fields are required.");
      return;
    }

    try {
      const axios = axiosWithAuth(API_BASE_URL);
      await axios.put(`/vendor/${vendor.id}`, {
        business_name: newName,
        phone_number: newPhone,
        address: newAddress,
      });

      fetchVendors();
    } catch (error) {
      console.error("Error updating vendor:", error);
      alert("Failed to update vendor.");
    }
  };

  // ===============================
  // FORM HANDLERS
  // ===============================
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const axios = axiosWithAuth(API_BASE_URL);
      const response = await axios.post("/vendor/", formData);

      setMessage(`✅ Vendor "${response.data.business_name}" created successfully.`);
      setFormData({ business_name: "", address: "", phone_number: "" });
      fetchVendors();
    } catch (error) {
      console.error(error);

      if (
        error.response?.data?.detail &&
        typeof error.response.data.detail === "string" &&
        error.response.data.detail.includes("Vendor name already exists")
      ) {
        setMessage("❌ Vendor name already exists.");
      } else {
        setMessage("❌ Failed to create vendor.");
      }
    }

    setTimeout(() => setMessage(""), 3000);
  };

  // ===============================
  // UI
  // ===============================
  return (
    <div className="vendor-container">
      <h2 className="vendor-heading">Vendor List</h2>

      {/* Create Vendor */}
      <form className="vendor-create-form" onSubmit={handleSubmit}>
        <input
          type="text"
          name="business_name"
          placeholder="Business Name"
          value={formData.business_name}
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="address"
          placeholder="Address"
          value={formData.address}
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="phone_number"
          placeholder="Phone Number"
          value={formData.phone_number}
          onChange={handleChange}
          required
        />
        <button type="submit">Add Vendor</button>
      </form>

      {message && <p className="vendor-message">{message}</p>}

      {/* Vendor Table */}
      <div className="vendor-table">
        <div className="vendor-table-header">
          <div>ID</div>
          <div>Business Name</div>
          <div>Phone</div>
          <div>Address</div>
          <div>Actions</div>
        </div>

        {vendors.length === 0 ? (
          <div className="vendor-table-row">
            <div colSpan="5">No vendors found.</div>
          </div>
        ) : (
          vendors.map((vendor) => (
            <div className="vendor-table-row" key={vendor.id}>
              <div>{vendor.id}</div>
              <div>{vendor.business_name}</div>
              <div>{vendor.phone_number}</div>
              <div>{vendor.address}</div>
              <div className="vendor-action-buttons">
                <button
                  className="vendor-btn vendor-btn-update"
                  onClick={() => handleUpdate(vendor)}
                >
                  Update
                </button>
                <button
                  className="vendor-btn vendor-btn-delete"
                  onClick={() => handleDelete(vendor.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ListVendor;
