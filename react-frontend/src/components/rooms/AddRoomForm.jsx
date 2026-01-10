import React, { useState } from "react";
import "./AddRoom.css";

import getBaseUrl from "../../api/config";
const API_BASE_URL = getBaseUrl();



const AddRoomForm = ({ onClose, onRoomAdded }) => {
  const [formData, setFormData] = useState({
    room_number: "",
    room_type: "",
    amount: "",
    status: "available",
  });

  const [successMessage, setSuccessMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/rooms/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setSuccessMessage("Room successfully added!");
        onRoomAdded();
        
      } else {
        const errorText = await res.text();
        console.error("Add room failed:", errorText);
        alert(`Failed to add room: ${errorText}`);
      }
    } catch (err) {
      console.error("Network error:", err);
      alert("Error adding room.");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>
          &times;
        </button>

        <form className="add-room-form" onSubmit={handleSubmit}>
          <h3>Add New Room</h3>

          <label>Room Number:</label>
          <input
            name="room_number"
            value={formData.room_number}
            onChange={handleChange}
            required
          />

          <label>Type:</label>
          <input
            name="room_type"
            value={formData.room_type}
            onChange={handleChange}
            required
          />

          <label>Amount (₦):</label>
          <input
            name="amount"
            type="number"
            value={formData.amount}
            onChange={handleChange}
            required
          />

          <label>Status:</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            required
          >
            <option value="available">Available</option>
            <option value="maintenance">Maintenance</option>
          </select>

          <button type="submit" className="action-btn">
            Add Room
          </button>
        </form>

        {successMessage && (
          <div className="success-overlay">
            {successMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddRoomForm;
