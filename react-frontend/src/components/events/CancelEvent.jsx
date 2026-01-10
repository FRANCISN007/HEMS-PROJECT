// src/components/events/CancelEvent.jsx
import React, { useState } from "react";
import "./CancelEvent.css";
import { useNavigate } from "react-router-dom";

import getBaseUrl from "../../api/config";
const API_BASE_URL = getBaseUrl();


const CancelEvent = ({ eventId, onClose }) => {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

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
      <p>You do not have permission to cancel event.</p>
    </div>
  );
}

  const handleCancel = async () => {
    try {
        const token = localStorage.getItem("token");

        const response = await fetch(
        `${API_BASE_URL}/events/${eventId}/cancel?cancellation_reason=${encodeURIComponent(reason)}`,
        {
            method: "PUT",
            headers: {
            Authorization: `Bearer ${token}`,
            },
        }
        );

        if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error cancelling event");
        }

        onClose(); // close modal and refresh
    } catch (err) {
        console.error("Error:", err);
        setMessage(err.message);
    }
    };


  return (
    <div className="cancel-event-overlay">
      <div className="cancel-event-modal">
        <h3>Are you sure you want to cancel this event?</h3>

        <textarea
          placeholder="Enter cancellation reason..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <div className="modal-actions">
          <button onClick={handleCancel} disabled={loading}>
            {loading ? "Cancelling..." : "Yes, Cancel"}
          </button>
          <button className="cancel-btn" onClick={onClose}>
            No, Go Back
          </button>
        </div>

        {message && <p className="cancel-message">{message}</p>}
      </div>
    </div>
  );
};

export default CancelEvent;
