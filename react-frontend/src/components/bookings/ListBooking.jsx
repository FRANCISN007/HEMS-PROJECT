import React, { useState } from "react";
import "./ListBooking.css";
import ViewForm from "./ViewForm";
import UpdateForm from "./UpdateForm";
import CreatePayment from "../payments/CreatePayment";
import { openViewForm } from "./viewFormUtils";

import getBaseUrl from "../../api/config";
const API_BASE_URL = getBaseUrl();


const ALL_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "room_number", label: "Room" },
  { key: "guest_name", label: "Guest" },
  { key: "gender", label: "Gender" },
  { key: "arrival_date", label: "Arrival" },
  { key: "departure_date", label: "Departure" },
  { key: "number_of_days", label: "Days" },
  { key: "booking_type", label: "Booking Type" },
  { key: "phone_number", label: "Phone" },
  { key: "booking_date", label: "Booking Date" },
  { key: "status", label: "Status" },
  { key: "payment_status", label: "Payment" },
  { key: "mode_of_identification", label: "Mode of ID" },
  { key: "identification_number", label: "ID Number" },
  { key: "address", label: "Address" },
  { key: "booking_cost", label: "Cost" },
  { key: "created_by", label: "Created By" },
  { key: "vehicle_no", label: "Vehicle No" },
  { key: "attachment", label: "Attachment" },
  { key: "actions", label: "Actions" },
];

const ListBooking = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [guestName, setGuestName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [hasFiltered, setHasFiltered] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [totalBookings, setTotalBookings] = useState(0);
  const [totalBookingCost, setTotalBookingCost] = useState(0);
  const [bookingToUpdate, setBookingToUpdate] = useState(null);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [paymentBooking, setPaymentBooking] = useState(null);
  const [status, setStatus] = useState("none");

  
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
      <p>You do not have permission to list bookings.</p>
    </div>
  );
}

  const getInitialVisibleColumns = () => {
    const saved = localStorage.getItem("visibleColumns");
    if (saved) return JSON.parse(saved);
    return ALL_COLUMNS.reduce((acc, col) => ({ ...acc, [col.key]: true }), {});
  };

  const [visibleColumns, setVisibleColumns] = useState(getInitialVisibleColumns);

  const handleToggleColumn = (key) => {
    setVisibleColumns((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem("visibleColumns", JSON.stringify(updated));
      return updated;
    });
  };

  const fetchBookings = async () => {
    setLoading(true);
    setHasFiltered(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      let url = `${API_BASE_URL}/bookings/list`;
      const params = {};

      // 1. Status Filter (only if not "none")
      if (status && status !== "none") {
         url = `${API_BASE_URL}/bookings/status`;
        params.status = status;
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
      }
      // 2. Guest Name Filter (only when status is "none")
      else if (guestName) {
       url = `${API_BASE_URL}/bookings/search`;
        params.guest_name = guestName;
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
      }
      // 3. Room Number Filter (only when status is "none" and guest is empty)
      else if (roomNumber) {
        url = `${API_BASE_URL}/bookings/room/${roomNumber}`;

        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
      }
      // 🚫 4. Invalid filter case
      else {
        // Clear current data
        setBookings([]);
        setTotalBookings(0);
        setTotalBookingCost(0);

        setError("Please provide a filter (guest name, room, or status) to fetch bookings.");
        setLoading(false);
        return;
      }

      const response = await fetch(`${url}?${new URLSearchParams(params)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      setBookings(data.bookings || []);
      setTotalBookings(data.total_bookings || data.bookings?.length || 0);
      setTotalBookingCost(data.total_cost || data.total_booking_cost || 0);
    } catch (err) {
      setError("Failed to fetch bookings.");
      setBookings([]); // Optional: also clear on error
    } finally {
      setLoading(false);
    }
  };




  const handleView = (booking) => {
    openViewForm(booking);
  };

  const handleUpdate = (booking) => {
    setBookingToUpdate(booking);
  };

  const handleCloseView = () => {
    setSelectedBooking(null);
  };

  const handlePayment = (booking) => {
    setPaymentBooking(booking);
  };

  return (
    <div className="list-booking-container">
        <div className="list-booking-container">
        {/* Line 1: Header with Booking List on the left and Column Selector on the right */}
        <div className="list-booking-header-row">
          <h2 className="compact-title">📄 Booking Management</h2>

          <div className="column-control-wrapper">
            <button
              className="column-toggle-button"
              onClick={() => setShowColumnMenu(!showColumnMenu)}
            >
              🛠️ Select Columns
            </button>

            {showColumnMenu && (
              <div className="column-dropdown-menu">
                {ALL_COLUMNS.map((col) => (
                  <label key={col.key}>
                    <input
                      type="checkbox"
                      checked={visibleColumns[col.key]}
                      onChange={() => handleToggleColumn(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Line 2: Filters aligned below the heading */}
        <div className="filter-controls-section">
          <div className="filter-row">
            <label>Filter by Status:</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="none">Select</option> {/* Means ignore status filter */}
              <option value="All">All</option>   {/* Means get all statuses */}
              <option value="checked-in">Checked-In</option>
              <option value="reserved">Reserved</option>
              <option value="checked-out">Checked-Out</option>
              <option value="cancelled">Cancelled</option>
              <option value="complimentary">Complimentary</option>
            </select>

          </div>

          <div className="filter-row">
            <label>Filter Name:</label>
            <input
              className="filter-input"
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Guest name"
            />
          </div>

          <div className="filter-row">
            <label>Filter by Room:</label>
            <input
              className="filter-input"
              type="text"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="Room No"
            />
          </div>


          <div className="filter-row">
            <label>Date Range:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <button className="fetch-button" onClick={fetchBookings}>
            ↻Refresh
          </button>
          </div>
        </div>
      </div>



      

      

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {hasFiltered && (
        <>
          <div className="booking-table-wrapper">
            <table className="booking-table">
              <thead>
                <tr>
                  {ALL_COLUMNS.map(
                    (col) =>
                      visibleColumns[col.key] && <th key={col.key}>{col.label}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    {visibleColumns.id && <td>{b.id}</td>}
                    {visibleColumns.room_number && <td>{b.room_number}</td>}
                    {visibleColumns.guest_name && <td>{b.guest_name}</td>}
                    {visibleColumns.gender && <td>{b.gender}</td>}
                    {visibleColumns.arrival_date && <td>{b.arrival_date}</td>}
                    {visibleColumns.departure_date && <td>{b.departure_date}</td>}
                    {visibleColumns.number_of_days && <td>{b.number_of_days}</td>}
                    {visibleColumns.booking_type && <td>{b.booking_type}</td>}
                    {visibleColumns.phone_number && <td>{b.phone_number}</td>}
                    {visibleColumns.booking_date && <td>{b.booking_date}</td>}
                    {visibleColumns.status && <td>{b.status}</td>}
                    {visibleColumns.payment_status && <td>{b.payment_status}</td>}
                    {visibleColumns.mode_of_identification && (
                      <td>{b.mode_of_identification}</td>
                    )}
                    {visibleColumns.identification_number && (
                      <td>{b.identification_number}</td>
                    )}
                    {visibleColumns.address && <td>{b.address}</td>}
                    {visibleColumns.booking_cost && <td>₦{b.booking_cost}</td>}
                    {visibleColumns.created_by && <td>{b.created_by}</td>}
                    {visibleColumns.vehicle_no && <td>{b.vehicle_no}</td>}
                    {visibleColumns.attachment && (
                      <td>
                        {b.attachment ? (
                          <a
                            className="attachment-link"
                            href={`${API_BASE_URL}/files/attachments/${b.attachment.split("/").pop()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View Image
                          </a>
                        ) : (
                          "None"
                        )}
                      </td>
                    )}
                    {visibleColumns.actions && (
                      <td>
                        <button
                          className={`payment-btn ${
                            b.payment_status === "excess payment"
                              ? "excess"
                              : b.payment_status === "fully paid"
                              ? "completed"
                              : b.payment_status === "complimentary"
                              ? "complimentary"
                              : b.payment_status === "void"
                              ? "void"
                              : ["checked-out", "cancelled"].includes(b.status)
                              ? "closed"
                              : b.payment_status === "part payment"
                              ? "incomplete"
                              : b.payment_status === "pending"
                              ? "pending"
                              : ""
                          }`}
                          onClick={() => handlePayment(b)}
                          disabled={
                            ["fully paid", "excess payment", "complimentary"].includes(b.payment_status) ||
                            ["checked-out", "cancelled"].includes(b.status)
                          }
                        >
                          {["checked-out", "cancelled"].includes(b.status)
                            ? "Closed"
                            : ["fully paid", "excess payment"].includes(b.payment_status)
                            ? "Paid"
                            : b.payment_status === "complimentary"
                            ? "Free"
                            : "Pay Now"}
                        </button>



                        <button className="viewb-btn" onClick={() => handleView(b)}>
                          View
                        </button>
                        <button className="updateb-btn" onClick={() => handleUpdate(b)}>
                          Update
                        </button>
                        

                      </td>
                    )}
                  </tr>
                ))}
                {bookings.length === 0 && !loading && (
                  <tr>
                    <td colSpan={ALL_COLUMNS.length} style={{ textAlign: "center" }}>
                      No bookings found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {bookings.length > 0 && (
            <div className="booking-summary">
              <p><strong>Total Entries:</strong> {totalBookings}</p>
              <p><strong>Total Booking Cost:</strong> ₦{totalBookingCost.toLocaleString()}</p>
            </div>
          )}
        </>
      )}


      {selectedBooking && (
        <ViewForm booking={selectedBooking} onClose={handleCloseView} />
      )}

      {bookingToUpdate && (
        <UpdateForm
          booking={bookingToUpdate}
          onClose={(updatedBooking) => {
            if (updatedBooking) {
              setBookings((prev) =>
                prev.map((b) => (b.id === updatedBooking.id ? updatedBooking : b))
              );
            }
            setBookingToUpdate(null);
          }}
        />
      )}

      {paymentBooking && (
        <CreatePayment
          booking={paymentBooking}
          onClose={() => setPaymentBooking(null)}
          onSuccess={(newPayment) => {
            setBookings((prev) =>
              prev.map((b) =>
                b.id === paymentBooking.id
                  ? { ...b, payment_status: newPayment.status }
                  : b
              )
            );
            setPaymentBooking(null);
          }}
        />
      )}
    </div>
  );
};

export default ListBooking;
