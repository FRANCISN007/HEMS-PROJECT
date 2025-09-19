import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";  // ✅ same as CreateBooking
import "./CheckoutGuest.css";

const CheckoutGuest = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookings, setBookings] = useState([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalBookingCost, setTotalBookingCost] = useState(0);

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
      <p>You do not have permission to checkout guest.</p>
    </div>
  );
}


  useEffect(() => {
    fetchUnavailableRooms();
  }, []);

  const fetchUnavailableRooms = async () => {
    try {
      const res = await axiosWithAuth().get("/rooms/unavailable");
      setBookings(res.data.unavailable_rooms || []);
      setTotalEntries(res.data.total_unavailable || 0);
      setTotalBookingCost(res.data.total_booking_cost || 0);
    } catch (err) {
      setError(err.response?.data?.detail || "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (roomNumber) => {
    try {
      const res = await axiosWithAuth().put(`/bookings/${roomNumber}/`);
      alert(res.data.message);

      // Optimistically remove the checked-out booking
      setBookings((prev) => prev.filter((b) => b.room_number !== roomNumber));

      // Refresh from backend
      fetchUnavailableRooms();
    } catch (err) {
      alert(err.response?.data?.detail || "Checkout failed");
    }
  };

  return (
    <div className="checkout-guest-container">
      <div className="checkout-frame">
        <h2 className="checkout-title">Check Out Guests</h2>

        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : bookings.length === 0 ? (
          <p>No guests currently in rooms.</p>
        ) : (
          <>
            <div className="checkout-summary">
              <span>Total Entries: {totalEntries}</span>
              <span>Total Booking Cost: ₦{totalBookingCost.toLocaleString()}</span>
            </div>

            <div className="table-scroll-wrapper">
              <table className="checkout-table">
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
                    <th>Actions</th>
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
                            href={`${axiosWithAuth().defaults.baseURL}/files/attachments/${b.attachment.split("/").pop()}`}
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
                        <div className="checkout-action-buttons">
                          <button
                            className="checkout-btn"
                            onClick={() => handleCheckout(b.room_number)}
                          >
                            Checkout
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
    </div>
  );
};

export default CheckoutGuest;
