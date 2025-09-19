// src/components/events/EventUpdate.jsx

import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./EventUpdate.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || `http://${window.location.hostname}:8000`;

const EventUpdate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const event = location.state?.event;

  const [formData, setFormData] = useState({ ...event });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
      <p>You do not have permission to update event.</p>
    </div>
  );
}


  useEffect(() => {
    if (!event) {
      alert("No event selected.");
      navigate("/dashboard/events/list");
    }
  }, [event, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/events/${event.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to update event");
      }

      setMessage("✅ Event updated successfully.");
      setTimeout(() => {
        navigate("/dashboard/events/list");
      }, 1500);
    } catch (err) {
      console.error(err);
      setMessage("❌ Error updating event.");
    } finally {
      setLoading(false);
    }
  };

  if (!event) return null;

  return (
    <div className="update-form-overlay">
      <div className="update-form-container">
        <h2>✏️ Update Event</h2>
        <div className="form-frame">
          <form onSubmit={handleSubmit} className="form-grid">

            <div className="form-row">
              <label>Organizer Name</label>
              <input name="organizer" value={formData.organizer || ""} onChange={handleChange} />
            </div>
            <div className="form-row">
              <label>Event Title</label>
              <input name="title" value={formData.title || ""} onChange={handleChange} />
            </div>
            
            
            <div className="form-row">
                <label>Start Date</label>
                <input
                    type="date"
                    name="start_datetime"
                    value={formData.start_datetime || ""}
                    onChange={handleChange}
                />
                </div>

                <div className="form-row">
                <label>End Date</label>
                <input
                    type="date"
                    name="end_datetime"
                    value={formData.end_datetime || ""}
                    onChange={handleChange}
                />
                </div>

            <div className="form-row">
              <label>Address</label>
              <input name="address" value={formData.address || ""} onChange={handleChange} />
            </div>

            
            
            <div className="form-row">
              <label>Phone Number</label>
              <input name="phone_number" value={formData.phone_number || ""} onChange={handleChange} />
            </div>

            
            <div className="form-row">
              <label>Event Amount</label>
              <input name="event_amount" value={formData.event_amount || ""} onChange={handleChange} />
            </div>
            <div className="form-row">
              <label>Caution Fee</label>
              <input name="caution_fee" value={formData.caution_fee || ""} onChange={handleChange} />
            </div>

            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {loading ? "Updating..." : "Update"}
              </button>
              <button type="button" className="cancel-btn" onClick={() => navigate("/dashboard/events/list")}>
                Cancel
              </button>
            </div>

            {message && (
              <div className={`update-message ${message.includes("success") ? "success" : "error"}`}>
                {message}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default EventUpdate;
