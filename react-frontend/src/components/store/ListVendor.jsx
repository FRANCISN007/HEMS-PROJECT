import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";

import "./ListVendor.css"; // We'll just add to this file

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || `http://${window.location.hostname}:8000`;

const ListVendor = () => {
  const [vendors, setVendors] = useState([]);
  const [formData, setFormData] = useState({
    business_name: "",
    address: "",
    phone_number: "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
  try {
    const axios = axiosWithAuth();
    const response = await axios.get(`/vendor/`);

    // Ensure response is an array
    if (Array.isArray(response.data)) {
      setVendors(response.data);
    } else {
      console.error("Expected an array but got:", response.data);
      setVendors([]); // fallback to empty array
    }
  } catch (error) {
    console.error("Error fetching vendors:", error);
    setVendors([]); // avoid crashing UI
  }
};

  const handleDelete = async (vendorId) => {
    if (!window.confirm("Are you sure you want to delete this vendor?")) return;
    try {
      const axios = axiosWithAuth();
      await axios.delete(`/vendor/${vendorId}`);

      fetchVendors();
    } catch (error) {
      console.error("Error deleting vendor:", error);
    }
  };

  const handleUpdate = async (vendor) => {
    const newName = prompt("Enter new business name", vendor.business_name);
    const newPhone = prompt("Enter new phone number", vendor.phone_number);
    const newAddress = prompt("Enter new address", vendor.address);

    if (!newName || !newPhone || !newAddress) {
      alert("All fields are required.");
      return;
    }

    try {
      const axios = axiosWithAuth();
      await axios.put(`/vendor/${vendor.id}`, {

        business_name: newName,
        phone_number: newPhone,
        address: newAddress
      });
      fetchVendors();
    } catch (error) {
      console.error("Error updating vendor:", error);
      alert("Failed to update vendor. Check console for details.");
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const axios = axiosWithAuth();
const response = await axios.post(`/vendor/`, formData);
setMessage(`✅ Vendor "${response.data.business_name}" created successfully.`);
setFormData({ business_name: "", address: "", phone_number: "" });
fetchVendors();

      } catch (error) {
  console.error(error);
  if (
    error.response &&
    error.response.data &&
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

  return (
    <div className="vendor-container">
      <h2 className="vendor-heading">Vendor List</h2>

      {/* Create Form Section */}
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
        <div className="table-header">
          <div>ID</div>
          <div>Business Name</div>
          <div>Phone</div>
          <div>Address</div>
          <div>Actions</div>
        </div>

        {vendors.length === 0 ? (
          <div className="table-row">
            <div colSpan="5">No vendors found.</div>
          </div>
        ) : (
          vendors.map((vendor) => (
            <div className="table-row" key={vendor.id}>
              <div>{vendor.id}</div>
              <div>{vendor.business_name}</div>
              <div>{vendor.phone_number}</div>
              <div>{vendor.address}</div>
              <div className="action-buttons">
                <button className="btn update" onClick={() => handleUpdate(vendor)}>Update</button>
                <button className="btn delete" onClick={() => handleDelete(vendor.id)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ListVendor;
