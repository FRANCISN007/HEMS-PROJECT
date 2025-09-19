// src/components/payments/CreatePayment.jsx

import React, { useState } from "react";
import { useLocation } from "react-router-dom"; // 👈 Needed to access state
import "./CreatePayment.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || `http://${window.location.hostname}:8000`;

const CreatePayment = ({ booking: bookingProp, onClose, onSuccess }) => {
  const location = useLocation();
  const bookingFromState = location.state?.booking;

  // Priority: Prop > Router state > fallback
  const booking = bookingProp || bookingFromState;

  const [amountPaid, setAmountPaid] = useState("");
  const [discountAllowed, setDiscountAllowed] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 16));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [disableForm, setDisableForm] = useState(false);

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
      <p>You do not have permission to create booking payment.</p>
    </div>
  );
}

  if (!booking) {
    return (
      <div className="payment-form-overlay">
        <div className="payment-form-container">
          <h2>❌ Booking data not found</h2>
          <p>No booking information provided. Please access this page from a valid action.</p>
          <button onClick={() => window.history.back()}>🔙 Go Back</button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/payments/${booking.booking_id || booking.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          amount_paid: parseFloat(amountPaid),
          discount_allowed: parseFloat(discountAllowed) || 0,
          payment_method: paymentMethod,
          payment_date: new Date(paymentDate).toISOString(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Payment failed");
      }

      setMessage("✅ " + (data.message || "Payment successful"));
      setDisableForm(true);
      setLoading(false);

      setTimeout(() => {
        if (onSuccess) {
          const status = data.updated_booking?.payment_status || "pending";
          onSuccess({ status });
        }
        if (onClose) onClose();
      }, 3000);
    } catch (err) {
      setError(err.message || "An error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="payment-form-overlay">
      <div className="payment-form-container">
        <h2>💳 Create Payment for Booking #{booking.booking_id || booking.id}</h2>
        <p>👤 Guest: <strong>{booking.guest_name}</strong></p>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <form onSubmit={handleSubmit}>
          <label>Amount Paid (₦)</label>
          <input
            type="number"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            required
            disabled={disableForm}
          />

          <label>Discount Allowed (₦)</label>
          <input
            type="number"
            value={discountAllowed}
            onChange={(e) => setDiscountAllowed(e.target.value)}
            disabled={disableForm}
          />

          <label>Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            required
            disabled={disableForm}
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="pos_card">POS Card</option>
          </select>

          <label>Payment Date</label>
          <input
            type="datetime-local"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
            disabled={disableForm}
          />

          <div className="payment-buttons">
            {!disableForm && (
              <button type="submit" disabled={loading}>
                {loading ? "Processing..." : "Submit Payment"}
              </button>
            )}

            <button
              type="button"
              className="cancel-btn"
              onClick={() => {
                if (onClose) {
                  onClose(); // used in modal popup mode
                } else {
                  window.history.back(); // used when opened via routing
                }
              }}
            >
              {disableForm ? "Close" : "Cancel"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default CreatePayment;
