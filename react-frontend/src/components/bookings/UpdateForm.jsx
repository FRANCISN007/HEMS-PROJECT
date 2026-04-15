import React, { useState, useEffect } from "react";
import "./UpdateForm.css";
import getBaseUrl from "../../api/config";

const API_BASE_URL = getBaseUrl();

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  return dateStr.split("T")[0]; // handle ISO datetime
};

const UpdateForm = ({ booking, onClose }) => {
  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({});
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Role check
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

  // ✅ Initialize form
  useEffect(() => {
    if (booking) {
      setFormData({
        ...booking,
        arrival_date: formatDate(booking.arrival_date),
        departure_date: formatDate(booking.departure_date),
        booking_date: formatDate(booking.booking_date) || today,
        vehicle_no: booking.vehicle_no || "",
      });
    }
  }, [booking]);

  // ✅ Handle input
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      let updated = { ...prev, [name]: value };

      // 🔥 Smart auto handling
      if (name === "booking_type") {
        if (value === "checked-in" || value === "complimentary") {
          updated.arrival_date = updated.booking_date || today;
        }
      }

      return updated;
    });
  };

  const handleFileChange = (e) => {
    setAttachmentFile(e.target.files[0]);
  };

  // ✅ Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Login required");

      const form = new FormData();

      // ✅ Append all fields
      Object.entries(formData).forEach(([key, value]) => {
        if (key !== "id" && key !== "attachment" && value !== null) {
          form.append(key, value);
        }
      });

      // ✅ REQUIRED: booking_id
      form.append("booking_id", formData.id);

      // ✅ FIXED attachment key
      if (attachmentFile) {
        form.append("attachment", attachmentFile);
      } else if (formData.attachment) {
        form.append("attachment_str", formData.attachment);
      }

      const response = await fetch(`${API_BASE_URL}/bookings/update/`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

      const result = await response.json();

      setMessage("✅ Booking updated successfully.");

      setTimeout(() => {
        onClose(result.updated_booking);
      }, 1000);
    } catch (err) {
      console.error(err);
      setMessage(err.message || "❌ Update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="supdate-forms-overlay">
      <div className="supdate-form-container">
        <h2>✏️ Update Booking</h2>

        <form onSubmit={handleSubmit} className="sforms-grid">

          {/* Guest */}
          <div className="sform-row" style={{ gridColumn: "1 / -1" }}>
            <label>Guest Name</label>
            <input
              name="guest_name"
              value={formData.guest_name || ""}
              onChange={handleChange}
            />
          </div>

          {/* Room */}
          <div className="sform-row">
            <label>Room Number</label>
            <input
              name="room_number"
              value={formData.room_number || ""}
              onChange={handleChange}
              required
            />
          </div>

          {/* Booking Date ✅ NEW */}
          <div className="sform-row">
            <label>Booking Date</label>
            <input
              type="date"
              name="booking_date"
              value={formData.booking_date || ""}
              onChange={handleChange}
              max={today}
            />
          </div>

          {/* Dates */}
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

          {/* Booking Type */}
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

          {/* Contact */}
          <div className="sform-row">
            <label>Phone</label>
            <input
              name="phone_number"
              value={formData.phone_number || ""}
              onChange={handleChange}
            />
          </div>

          {/* ID */}
          <div className="sform-row">
            <label>Mode of ID</label>
            <select
              name="mode_of_identification"
              value={formData.mode_of_identification || ""}
              onChange={handleChange}
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

          {/* Address */}
          <div className="sform-row">
            <label>Address</label>
            <input
              name="address"
              value={formData.address || ""}
              onChange={handleChange}
            />
          </div>

          {/* Vehicle */}
          <div className="sform-row">
            <label>Vehicle No</label>
            <input
              name="vehicle_no"
              value={formData.vehicle_no || ""}
              onChange={handleChange}
            />
          </div>

          {/* Attachment */}
          <div className="sform-row" style={{ gridColumn: "1 / -1" }}>
            <label>Attachment</label>

            {formData.attachment && (
              <img
                src={`${API_BASE_URL}/files/attachments/${formData.attachment.split("/").pop()}`}
                alt="preview"
                style={{ maxWidth: "150px", marginBottom: "10px" }}
              />
            )}

            <input type="file" onChange={handleFileChange} />
          </div>

          {/* Buttons */}
          <div className="sform-actions">
            <button type="submit" disabled={loading} className="update-btn">
              {loading ? "Updating..." : "Update"}
            </button>

            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
          </div>

          {message && <p className="supdate-message">{message}</p>}
        </form>
      </div>
    </div>
  );
};

export default UpdateForm;
