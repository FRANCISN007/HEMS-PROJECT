import React, { useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth"; // ✅ use auth axios
import "./CreateBooking.css";
import { useNavigate } from "react-router-dom";

const CreateBooking = () => {
  const navigate = useNavigate();

const today = new Date();
const tomorrow = new Date();
tomorrow.setDate(today.getDate() + 1);

const formatDate = (date) => date.toISOString().split("T")[0];

const [formData, setFormData] = useState({
  room_number: "",
  guest_name: "",
  gender: "",
  mode_of_identification: "",
  identification_number: "",
  address: "",
  arrival_date: formatDate(today),      // ✅ default to today
  departure_date: formatDate(tomorrow), // ✅ default to tomorrow
  booking_type: "",
  phone_number: "",
  vehicle_no: "",
  attachment: "",
});
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [message, setMessage] = useState("");
  const [guestResults, setGuestResults] = useState([]);
  const [guestIndex, setGuestIndex] = useState(0);

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
      <p>You do not have permission to create bookings.</p>
    </div>
  );
}


  // ✅ Handle input changes
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "attachment_file" && files.length > 0) {
      setAttachmentFile(files[0]);
      setFormData((prev) => ({ ...prev, attachment: "" })); // clear fetched attachment if new file selected
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // ✅ Search Guest by name
  const handleSearchGuest = async () => {
    if (!formData.guest_name.trim()) {
      setMessage("Please enter a guest name to search.");
      return;
    }

    try {
      if (guestResults.length === 0) {
        const response = await axiosWithAuth().get("/bookings/search-guest/", {
          params: { guest_name: formData.guest_name.trim() },
        });

        if (response.data.length === 0) {
          setMessage("No matching guests found.");
          return;
        }

        setGuestResults(response.data);
        setGuestIndex(0);
        loadGuestData(response.data[0]);
        setMessage(`Match 1 of ${response.data.length} loaded.`);
      } else {
        const nextIndex = (guestIndex + 1) % guestResults.length;
        setGuestIndex(nextIndex);
        loadGuestData(guestResults[nextIndex]);
        setMessage(`Match ${nextIndex + 1} of ${guestResults.length} loaded.`);
      }
    } catch (error) {
      setMessage(error.response?.data?.detail || "Guest search failed.");
    }
  };

  // ✅ Auto-fill guest details when found
  const loadGuestData = (guest) => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const formatDate = (date) => date.toISOString().split("T")[0];

    setFormData((prev) => ({
      ...prev,
      gender: guest.gender,
      phone_number: guest.phone_number,
      address: guest.address,
      mode_of_identification: guest.mode_of_identification,
      identification_number: guest.identification_number,
      vehicle_no: guest.vehicle_no,
      booking_type: guest.booking_type,
      arrival_date: formatDate(today),       // ✅ always reset to today
      departure_date: formatDate(tomorrow),  // ✅ always reset to tomorrow
      attachment: guest.attachment || "",
    }));

    setAttachmentFile(null); // reset file input
  };

  // ✅ Submit form (Booking creation)
  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("You are not logged in. Please login to continue.");
      return;
    }

    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key !== "attachment" && value) {
        data.append(key, value);
      }
    });

    if (attachmentFile) {
      data.append("attachment_file", attachmentFile);
    } else if (formData.attachment) {
      data.append("attachment_str", formData.attachment);
    }

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}/bookings/create/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`, // ✅ only token (no license header)
          },
          body: data,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Failed to create booking");
      }

      setMessage(result.message || "Booking created successfully.");
      setGuestResults([]);
      setGuestIndex(0);
    } catch (error) {
      console.error("❌ Booking error:", error);
      setMessage(error.message || "Failed to create booking.");
    }
  };

  // ✅ Close button → navigate back
  const handleClose = () => {
    navigate("/dashboard/rooms/status");
  };

  return (
    <div className="bookings-form-container">
      <button className="close-button" onClick={handleClose} title="Close">
        ×
      </button>

      <h2 className="forms-title">Create Booking</h2>
      {message && <p className="form-message">{message}</p>}

      <form
        className="bookings-form"
        onSubmit={handleSubmit}
        encType="multipart/form-data"
      >
        {/* Room & Guest */}
        <div className="forms-section">
          <label className="sections-label">Room & Guest</label>
          <div className="forms-row" style={{ alignItems: "center" }}>
            <input
              type="text"
              name="room_number"
              placeholder="Room No"
              value={formData.room_number}
              onChange={handleChange}
              required
              style={{ flex: "1 1 30%" }}
            />
            <input
              type="text"
              name="guest_name"
              placeholder="Guest Name"
              value={formData.guest_name}
              onChange={handleChange}
              required
              style={{ flex: "1 1 50%" }}
            />
            <button
              type="button"
              className="search-btn"
              onClick={handleSearchGuest}
              style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}
            >
              🔍 Search
            </button>
          </div>
        </div>

        {/* Identification */}
        <div className="forms-section">
          <label className="sections-label">Identification</label>
          <div className="forms-row">
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              required
            >
              <option value="">Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>

            <select
              name="mode_of_identification"
              value={formData.mode_of_identification}
              onChange={handleChange}
              required
            >
              <option value="">Mode of ID</option>
              <option value="National Id Card">National ID Card</option>
              <option value="Driver License">Driver License</option>
              <option value="Voter Card">Voter Card</option>
              <option value="Id Card">ID Card</option>
              <option value="Passport">Passport</option>
            </select>
          </div>

          <div className="forms-row">
            <input
              type="text"
              name="identification_number"
              placeholder="ID Number"
              value={formData.identification_number}
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
          </div>
        </div>

        {/* Dates */}
        <div className="forms-section">
          <label className="sections-label">Dates</label>
          <div className="forms-row">
            <div className="dates-group">
              <label>Arrival Date</label>
              <input
                type="date"
                name="arrival_date"
                value={formData.arrival_date}
                onChange={handleChange}
                required
              />
            </div>
            <div className="dates-group">
              <label>Departure Date</label>
              <input
                type="date"
                name="departure_date"
                value={formData.departure_date}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

        {/* Booking & Contact */}
        <div className="forms-section">
          <label className="sections-label">Booking & Contact</label>
          <div className="forms-row">
            <select
              name="booking_type"
              value={formData.booking_type}
              onChange={handleChange}
              required
            >
              <option value="">Booking Type</option>
              <option value="checked-in">Checked-in</option>
              <option value="reservation">Reservation</option>
              <option value="complimentary">Complimentary</option>
            </select>
            <input
              type="text"
              name="phone_number"
              placeholder="Phone Number"
              value={formData.phone_number}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {/* Vehicle & Attachment */}
        <div className="forms-section">
          <label className="sections-label">Vehicle & Attachment</label>
          <div className="forms-row">
            <input
              type="text"
              name="vehicle_no"
              placeholder="Vehicle No (optional)"
              value={formData.vehicle_no}
              onChange={handleChange}
            />
            <input
              type="file"
              name="attachment_file"
              accept="image/*"
              onChange={handleChange}
            />
          </div>

          {formData.attachment && (
            <div className="forms-row">
              <label style={{ fontStyle: "italic", color: "#555" }}>
                Using previous attachment: <b>{formData.attachment}</b>
              </label>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="form-row full-width">
          <button type="submit" className="submits-btn">
            ✅ Submit Booking
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateBooking;
