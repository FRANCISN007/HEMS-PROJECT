import React, { useState, useEffect } from "react";
import "./UpdateForm.css";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  `http://${window.location.hostname}:8000`;

const UpdateForm = ({ booking, onClose }) => {
  const [formData, setFormData] = useState({ ...booking });
  const [attachmentFile, setAttachmentFile] = useState(null);
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


  if (!(roles.includes("admin") || roles.includes("dashboard"))) {
  return (
    <div className="unauthorized">
      <h2>🚫 Access Denied</h2>
      <p>You do not have permission to update bookings.</p>
    </div>
  );
}

  // ✅ Initialize formData when booking changes
  useEffect(() => {
    if (booking) {
      setFormData({
        ...booking,
        mode_of_identification: booking.mode_of_identification?.trim() || "",
      });
    }
  }, [booking]);

  // ✅ Handle normal input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ✅ Handle file change
  const handleFileChange = (e) => {
    setAttachmentFile(e.target.files[0]);
  };

  // ✅ Submit update form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setMessage("You are not logged in. Please login first.");
        setLoading(false);
        return;
      }

      const form = new FormData();

      // ✅ Append all fields except id & attachment
      for (const key in formData) {
        if (key !== "id" && key !== "attachment" && formData[key] !== null) {
          form.append(key, formData[key]);
        }
      }

      // ✅ Send booking_id instead of id
      form.append("booking_id", formData.id);

      // ✅ Attachment handling
      if (attachmentFile) {
        form.append("attachment_file", attachmentFile); // 🔑 same as in create
      } else if (formData.attachment) {
        form.append("attachment_str", formData.attachment);
      }

      // ✅ Call backend (PUT)
      const response = await fetch(`${API_BASE_URL}/bookings/update/`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        // do not set Content-Type (FormData handles it)
      },
      body: form,
    });

    if (!response.ok) {
      // read as text, don’t try JSON
      const errText = await response.text();
      console.error("❌ Backend error:", errText);
      throw new Error(errText);
    }

    // ✅ only parse JSON if ok
    const result = await response.json();

    setMessage("✅ Booking updated successfully.");
    setTimeout(() => {
      onClose(result.updated_booking);
    }, 1200);

    } catch (err) {
      console.error("❌ Update error:", err);
      setMessage(err.message || "❌ Failed to update booking.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="supdate-forms-overlay">
      <div className="supdate-form-container">
        <h2>✏️ Update Guest Booking</h2>

        <form onSubmit={handleSubmit} className="sforms-grid">
          <div className="sform-row" style={{ gridColumn: "1 / -1" }}>
            <label>Guest Name</label>
            <input
              name="guest_name"
              value={formData.guest_name || ""}
              onChange={handleChange}
            />
          </div>

          <div className="sform-row">
            <label>Arrival Date</label>
            <input
              type="date"
              name="arrival_date"
              value={formData.arrival_date || ""}
              onChange={handleChange}
            />
          </div>
          <div className="sform-row">
            <label>Departure Date</label>
            <input
              type="date"
              name="departure_date"
              value={formData.departure_date || ""}
              onChange={handleChange}
            />
          </div>

          <div className="sform-row">
            <label>Gender</label>
            <select
              name="gender"
              value={formData.gender || ""}
              onChange={handleChange}
              required
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div className="sform-row">
            <label>Phone Number</label>
            <input
              name="phone_number"
              value={formData.phone_number || ""}
              onChange={handleChange}
            />
          </div>

          <div className="sform-row">
            <label>Booking Type</label>
            <select
              name="booking_type"
              value={formData.booking_type || ""}
              onChange={handleChange}
            >
              <option value="">Select</option>
              <option value="reservation">Reservation</option>
              <option value="checked-in">Checked In</option>
              <option value="complimentary">Complimentary</option>
            </select>
          </div>

          <div className="sform-row">
            <label>Mode of ID</label>
            <select
              name="mode_of_identification"
              value={formData.mode_of_identification?.trim() || ""}
              onChange={handleChange}
              required
            >
              <option value="">Select</option>
              <option value="National Id Card">National ID Card</option>
              <option value="Driver License">Driver License</option>
              <option value="Voter Card">Voter Card</option>
              <option value="Id Card">ID Card</option>
              <option value="Passport">Passport</option>
            </select>
          </div>

          <div className="sform-row">
            <label>ID Number</label>
            <input
              name="identification_number"
              value={formData.identification_number || ""}
              onChange={handleChange}
            />
          </div>

          <div className="sform-row">
            <label>Address</label>
            <input
              name="address"
              value={formData.address || ""}
              onChange={handleChange}
            />
          </div>

          <div className="sform-row">
            <label>Vehicle No</label>
            <input
              name="vehicle_no"
              value={formData.vehicle_no || ""}
              onChange={handleChange}
            />
          </div>

          <div className="sform-row">
            <label>Status</label>
            <select
              name="status"
              value={formData.status || ""}
              onChange={handleChange}
            >
              <option value="">Select</option>
              <option value="reservation">Reservation</option>
              <option value="checked-in">Checked In</option>
              <option value="checked-out">Checked Out</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Attachment */}
          <div
            className="sform-row attachment-preview-row"
            style={{ gridColumn: "1 / span 2" }}
          >
            <label>Current Attachment Preview</label>
            {formData.attachment ? (
              <img
                src={`${API_BASE_URL}/files/attachments/${formData.attachment.split("/").pop()}`}
                alt="Attachment Preview"
                style={{
                  maxWidth: "180px",
                  maxHeight: "140px",
                  marginBottom: "8px",
                  borderRadius: "6px",
                }}
              />
            ) : (
              <p>No attachment available</p>
            )}
            <input type="file" onChange={handleFileChange} />
          </div>

          <div className="sform-actions">
            <button type="submit" disabled={loading} className="update-btn">
              {loading ? "Updating..." : "Update"}
            </button>
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
          </div>

          {message && (
            <p
              className="supdate-message"
              style={{ gridColumn: "1 / span 2", marginTop: "8px" }}
            >
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default UpdateForm;
