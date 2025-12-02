// src/components/payments/CreatePayment.jsx
import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./CreatePayment.css";

const CreatePayment = ({ booking: bookingProp, onClose, onSuccess }) => {
  const location = useLocation();
  const bookingFromState = location.state?.booking;
  const booking = bookingProp || bookingFromState;

  const [amountPaid, setAmountPaid] = useState("");
  const [discountAllowed, setDiscountAllowed] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 16) // for datetime-local input (local)
  );

  const [bankId, setBankId] = useState("");
  const [banks, setBanks] = useState([]);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [disableForm, setDisableForm] = useState(false);

  // Role check
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = Array.isArray(storedUser.roles)
    ? storedUser.roles
    : [storedUser.role || ""];
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
          <p>No booking information provided.</p>
          <button onClick={() => window.history.back()}>🔙 Go Back</button>
        </div>
      </div>
    );
  }

  // Fetch banks
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const res = await axiosWithAuth().get("/bank/simple");
        // backend returns either an array or { banks: [...] } - normalize
        const list = Array.isArray(res.data) ? res.data : res.data.banks || [];
        setBanks(list);
      } catch (err) {
        console.error("Failed to load banks:", err);
      }
    };
    fetchBanks();
  }, []);

  const handlePaymentMethodChange = (e) => {
    setPaymentMethod(e.target.value);
    setBankId("");
  };

  const validate = () => {
    setError("");
    // amountPaid must be a positive number
    const amt = parseFloat(amountPaid);
    if (Number.isNaN(amt) || amt <= 0) {
      setError("Enter a valid Amount Paid greater than 0.");
      return false;
    }
    // discount must be >= 0
    const disc = discountAllowed === "" ? 0 : parseFloat(discountAllowed);
    if (Number.isNaN(disc) || disc < 0) {
      setError("Enter a valid Discount (0 or greater).");
      return false;
    }
    // if bank-based payment, ensure bank selected
    if (["bank_transfer", "pos_card"].includes(paymentMethod) && !bankId) {
      setError("Please select a bank for this payment method.");
      return false;
    }
    // Ensure paymentDate is present
    if (!paymentDate) {
      setError("Please select a payment date/time.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!validate()) return;

    setLoading(true);

    try {
      // Build safe numeric values
      const amt = parseFloat(amountPaid);
      const disc = discountAllowed === "" ? 0 : parseFloat(discountAllowed);

      // Convert datetime-local (local time without timezone) into an ISO string with timezone.
      // new Date(paymentDate) interprets the datetime-local as local time.
      const tzIso = new Date(paymentDate).toISOString();

      const payload = {
        amount_paid: amt,
        discount_allowed: disc,
        payment_method: (paymentMethod || "cash").toLowerCase(),
        payment_date: tzIso,
        // Always include bank_id (backend ignores for cash)
        bank_id:
          ["bank_transfer", "pos_card"].includes(paymentMethod) && bankId
            ? parseInt(bankId, 10)
            : null,
      };

      // debugging - remove later
      console.debug("CreatePayment payload:", payload);

      const bookingId = booking.booking_id || booking.id;

      const response = await axiosWithAuth().post(
        `/payments/${bookingId}`,
        payload
      );

      const data = response.data;

      setMessage("✅ " + (data.message || "Payment successful"));
      setDisableForm(true);
      setLoading(false);

      setTimeout(() => {
        if (onSuccess) {
          const status = data.payment_details?.status || "pending";
          onSuccess({ status });
        }
        if (onClose) onClose();
      }, 1000);
    } catch (err) {
      // more robust error extraction
      let detail = "An unexpected error occurred";
      if (err.response && err.response.data) {
        // FastAPI usually returns { detail: "..." }
        detail =
          err.response.data.detail ||
          JSON.stringify(err.response.data) ||
          err.message;
      } else {
        detail = err.message;
      }
      console.error("CreatePayment error:", err, "server detail:", detail);
      setError(detail);
      setLoading(false);
    }
  };

  return (
    <div className="payment-form-overlay">
      <div className="payment-form-container">
        <h2>💳 Create Payment for Booking #{booking.booking_id || booking.id}</h2>
        <p>
          👤 Guest: <strong>{booking.guest_name}</strong>
        </p>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <form onSubmit={handleSubmit}>
          <label>Amount Paid (₦)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            required
            disabled={disableForm}
          />

          <label>Discount Allowed (₦)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={discountAllowed}
            onChange={(e) => setDiscountAllowed(e.target.value)}
            disabled={disableForm}
          />

          <label>Payment Method</label>
          <select
            value={paymentMethod}
            onChange={handlePaymentMethodChange}
            required
            disabled={disableForm}
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="pos_card">POS Card</option>
          </select>

          {["bank_transfer", "pos_card"].includes(paymentMethod) && (
            <>
              <label>Select Bank</label>
              <select
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                required
                disabled={disableForm}
              >
                <option value="">-- Select Bank --</option>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </>
          )}

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
                if (onClose) onClose();
                else window.history.back();
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
