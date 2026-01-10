import React, { useEffect, useState } from "react";
import "./CancelBooking.css";

import getBaseUrl from "../../api/config";
const API_BASE_URL = getBaseUrl();


const CancelBooking = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookings, setBookings] = useState([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalBookingCost, setTotalBookingCost] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [reason, setReason] = useState("");

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
      <p>You do not have permission to cancel bookings.</p>
    </div>
  );
}

  useEffect(() => {
    fetchCancellableBookings();
  }, []);

  const fetchCancellableBookings = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("User not authenticated.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/bookings/bookings/cancellable`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        console.log("Backend error:", data);
        setError(data.detail || "Failed to fetch cancellable bookings.");
        setLoading(false); // <== ADD THIS here too
        return;
      }

      setBookings(data.bookings || []);
      setTotalEntries(data.total_bookings || 0);
      setTotalBookingCost(data.total_booking_cost || 0);
      setLoading(false); // ✅ <== THIS IS MISSING IN YOUR CURRENT CODE
    } catch (err) {
      console.error("Frontend error:", err.message || JSON.stringify(err));
      setError(err.message || JSON.stringify(err));
      setLoading(false); // ✅ <== Also add here
    }
  };

  const handleCancelClick = (bookingId) => {
    setSelectedBookingId(bookingId);
    setReason("");
    setShowModal(true);
  };

  const handleConfirmCancel = async () => {
    const token = localStorage.getItem("token");
    if (!token || !selectedBookingId || !reason.trim()) {
      alert("Please provide cancellation reason.");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/bookings/cancel/${selectedBookingId}/?cancellation_reason=${encodeURIComponent(reason)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Cancellation failed.");
      } else {
        alert(data.message);
        fetchCancellableBookings();
      }
    } catch (err) {
      alert("Error: " + (err.message || JSON.stringify(err)));
    } finally {
      setShowModal(false);
    }
  };

  return (
    <div className="cancel-guest-container">
      <div className="cancel-frame">
        <h2 className="cancel-title">Cancel Bookings</h2>

        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : bookings.length === 0 ? (
          <p>No bookings available to cancel.</p>
        ) : (
          <>
            <div className="cancel-summary">
              <span>Total Entries: {totalEntries}</span>
              <span>Total Booking Cost: ₦{totalBookingCost.toLocaleString()}</span>
            </div>

            <div className="table-scroll-wrapper">
              <table className="cancel-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Room</th>
                    <th>Guest</th>
                    <th>Arrival</th>
                    <th>Departure</th>
                    <th>Days</th>
                    <th>Booking Date</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Cost</th>
                    <th>Created By</th>
                    <th>Attachment</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.booking_id}>
                      <td>{b.booking_id}</td>
                      <td>{b.room_number}</td>
                      <td>{b.guest_name}</td>
                      <td>{b.arrival_date}</td>
                      <td>{b.departure_date}</td>
                      <td>{b.number_of_days}</td>
                      <td>{b.booking_date}</td>
                      <td>{b.status}</td>
                      <td>{b.payment_status}</td>
                      <td>₦{b.booking_cost?.toLocaleString()}</td>
                      <td>{b.created_by}</td>
                      <td>
                        {b.attachment ? (
                          <a
                            className="attachment-link"
                            href={`${API_BASE_URL}/files/attachments/${b.attachment.split("/").pop()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View
                          </a>
                        ) : (
                          "None"
                        )}
                      </td>
                      <td>
                        <div className="cancel-action-buttons">
                          <button
                            className="cancel-btn"
                            onClick={() => handleCancelClick(b.booking_id)}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal for cancellation reason */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box compact">
            <h3>Cancel Booking</h3>
            <label className="modal-label">Reason for cancellation:</label>
            <textarea
              className="reason-textarea compact"
              placeholder="E.g., Guest requested cancellation, payment issue, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            ></textarea>
            <div className="modal-actions">
              <button className="btn primary" onClick={handleConfirmCancel}>
                ✅ Confirm
              </button>
              <button className="btn secondary" onClick={() => setShowModal(false)}>
                ❌ Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CancelBooking;
