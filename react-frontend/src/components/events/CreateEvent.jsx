// src/components/event/CreateEvent.jsx

import React, { useState } from "react";
import axios from "axios";
import "./CreateEvent.css";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || `http://${window.location.hostname}:8000`;

const CreateEvent = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];

  if (Array.isArray(storedUser.roles)) {
    roles = storedUser.roles;
  } else if (typeof storedUser.role === "string") {
    roles = [storedUser.role];
  }

  roles = roles.map((r) => r.toLowerCase());


  if (!(roles.includes("admin") || roles.includes("event"))) {
  return (
    <div className="unauthorized">
      <h2>🚫 Access Denied</h2>
      <p>You do not have permission to create event.</p>
    </div>
  );
}

  const [formData, setFormData] = useState({
    organizer: "",
    title: "",
    description: "",
    start_datetime: "",
    end_datetime: "",
    event_amount: "",
    caution_fee: "",
    location: "",
    phone_number: "",
    address: "",
    payment_status: "active",
    balance_due: 0  // ✅ Add this line
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("You are not logged in.");
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/events/`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setMessage("✅ Event created successfully.");
      setFormData({
        organizer: "",
        title: "",
        description: "",
        start_datetime: "",
        end_datetime: "",
        event_amount: "",
        caution_fee: "",
        location: "",
        phone_number: "",
        address: "",
        payment_status: "active",
        balance_due: 0  // ✅ Add this line
      });
    } catch (error) {
      console.error("Backend error response:", error.response?.data);

      const responseData = error.response?.data;
      if (Array.isArray(responseData)) {
        setMessage(responseData); // likely Pydantic validation errors
      } else if (typeof responseData?.detail === "string") {
        setMessage(responseData.detail);
      } else if (responseData?.detail && Array.isArray(responseData.detail)) {
        // FastAPI sometimes wraps validation errors in `detail`
        setMessage(responseData.detail);
      } else {
        setMessage("❌ Failed to create event.");
      }
    }


  };

  const handleClose = () => {
  navigate("/dashboard/rooms/status");
};


  return (
    <div className="event-form-container">
      <button className="close-button" onClick={handleClose} title="Close">×</button>
      <h2 className="forme-title">Create Event</h2>
      {message && (
        <div className="form-message">
          {Array.isArray(message) ? (
            <ul>
              {message.map((err, i) => (
                <li key={i}>{err.msg}</li>
              ))}
            </ul>
          ) : (
            <p>{message}</p>
          )}
        </div>
      )}

      <form className="event-form" onSubmit={handleSubmit}>
        <div className="form-rows">
          <input type="text" name="organizer" placeholder="Organizer Name" value={formData.organizer} onChange={handleChange} required />
          <input type="text" name="title" placeholder="Title" value={formData.title} onChange={handleChange} required />
        </div>

        <div className="form-rows">
          <input type="date" name="start_datetime" value={formData.start_datetime} onChange={handleChange} required />
          <input type="date" name="end_datetime" value={formData.end_datetime} onChange={handleChange} required />
        </div>

        <div className="form-rows">
          <input type="number" name="event_amount" placeholder="Event Amount" value={formData.event_amount} onChange={handleChange} required />
          <input type="number" name="caution_fee" placeholder="Caution Fee" value={formData.caution_fee} onChange={handleChange} />
        </div>

        <div className="form-rows">
          <input type="text" name="location" placeholder="Location" value={formData.location} onChange={handleChange} required />
          <input type="text" name="phone_number" placeholder="Phone Number" value={formData.phone_number} onChange={handleChange} required />
        </div>

        <div className="form-rows">
          <input type="text" name="address" placeholder="Address" value={formData.address} onChange={handleChange} required />
          <select name="payment_status" value={formData.payment_status} onChange={handleChange}>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="form-rows full-width">
          <textarea
            name="description"
            placeholder="Event Description"
            value={formData.description}
            onChange={handleChange}
            rows={2}
            style={{ resize: "none", width: "100%" }}
          />
        </div>

        
          <button type="submit" className="submit-btn">✅ Create Event</button>
        
      </form>
    </div>
  );
};

export default CreateEvent;
