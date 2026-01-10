import React, { useEffect, useState } from "react";
import axios from "axios";
import "./EventPayment.css";

import getBaseUrl from "../../api/config";
const API_BASE_URL = getBaseUrl();


const EventPayment = () => {
  const [loading, setLoading] = useState(true);
  const [outstandingEvents, setOutstandingEvents] = useState([]);
  const [summary, setSummary] = useState({});
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [banks, setBanks] = useState([]);

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
        <p>You do not have permission to create event payment.</p>
      </div>
    );
  }

  const [paymentForm, setPaymentForm] = useState({
    amount_paid: "",
    discount_allowed: "",
    payment_method: "cash",
    bank_id: "", // New bank selection
  });

  useEffect(() => {
    fetchOutstandingEvents();
    fetchBanks();
  }, []);

  // Fetch outstanding events
  const fetchOutstandingEvents = async () => {
    const token = localStorage.getItem("token");

    if (!token || token === "null" || token === "undefined") {
      setError("User not authenticated. Please login.");
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/eventpayment/outstanding`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOutstandingEvents(response.data.outstanding_events);
      setSummary({
        total_outstanding: response.data.total_outstanding,
        total_outstanding_balance: response.data.total_outstanding_balance,
      });
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((e) => e.msg).join(" | "));
      } else if (typeof detail === "object") {
        setError(JSON.stringify(detail));
      } else {
        setError(detail || "Failed to load data.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch bank list
  const fetchBanks = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.get(`${API_BASE_URL}/bank/simple`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBanks(response.data);
    } catch (err) {
      console.error("Failed to load banks", err);
    }
  };

  const openPaymentModal = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
    setFormError("");
    setPaymentForm({
      amount_paid: "",
      discount_allowed: "",
      payment_method: "cash",
      bank_id: "",
    });
  };

  const handlePaymentSubmit = async () => {
    const token = localStorage.getItem("token");

    if (!selectedEvent) {
      setFormError("No event selected");
      return;
    }

    const selectedBank = banks.find((b) => b.id === parseInt(paymentForm.bank_id));

    const paymentData = {
      event_id: selectedEvent.event_id,
      organiser: selectedEvent.organizer,
      amount_paid: parseFloat(paymentForm.amount_paid || 0),
      discount_allowed: parseFloat(paymentForm.discount_allowed || 0),
      payment_method: paymentForm.payment_method,
      bank: selectedBank?.name || null,
      payment_status: "pending",
      created_by: "fcn", // TODO: Replace with actual username
    };

    try {
      await axios.post(`${API_BASE_URL}/eventpayment/`, paymentData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSuccessMessage("✅ Payment submitted successfully!");
      setShowModal(false);
      fetchOutstandingEvents();

      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      console.error("Payment error:", err.response?.data || err.message);
      setFormError("Payment failed: " + JSON.stringify(err.response?.data?.detail));
    }
  };

  return (
    <div className="event-payment-wrapper">
      <h2 className="event-payment-title">Outstanding Event Payments</h2>
      {successMessage && <p className="success-message">{successMessage}</p>}

      {loading ? (
        <p className="event-payment-loading">Loading...</p>
      ) : error ? (
        <p className="event-payment-error">{error}</p>
      ) : (
        <>
          <table className="event-payment-table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Organizer</th>
                <th>Title</th>
                <th>Location</th>
                <th>Total Due</th>
                <th>Total Paid</th>
                <th>Discount</th>
                <th>Amount Due</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {outstandingEvents.map((event) => (
                <tr key={event.event_id}>
                  <td>{event.event_id}</td>
                  <td>{event.organizer}</td>
                  <td>{event.title}</td>
                  <td>{event.location}</td>
                  <td>₦{event.total_due.toLocaleString()}</td>
                  <td>₦{event.total_paid.toLocaleString()}</td>
                  <td>₦{event.discount_allowed.toLocaleString()}</td>
                  <td>₦{event.amount_due.toLocaleString()}</td>
                  <td>
                    <button
                      className="event-payment-button"
                      onClick={() => openPaymentModal(event)}
                    >
                      Make Payment
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary Section */}
          <div className="event-payment-summary">
            <p className="summary-line">
              <strong>Total Outstanding Events:</strong> {summary.total_outstanding}
            </p>
            <p className="summary-line">
              <strong>Total Outstanding Balance:</strong> ₦{summary.total_outstanding_balance?.toLocaleString()}
            </p>
          </div>

          {/* Modal */}
          {showModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h3>Make Payment for: {selectedEvent.title}</h3>

                <label>Amount Paid:</label>
                <input
                  type="number"
                  value={paymentForm.amount_paid}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, amount_paid: e.target.value })
                  }
                />

                <label>Discount Allowed:</label>
                <input
                  type="number"
                  value={paymentForm.discount_allowed}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, discount_allowed: e.target.value })
                  }
                />

                <label>Payment Method:</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, payment_method: e.target.value })
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="pos">POS</option>
                  <option value="bank transfer">Bank Transfer</option>
                </select>

                <label>Bank:</label>
                <select
                  value={paymentForm.bank_id}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, bank_id: e.target.value })
                  }
                  disabled={paymentForm.payment_method === "cash"} // disable if cash
                >
                  <option value="">Select Bank</option>
                  {banks.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.name}
                    </option>
                  ))}
                </select>


                {formError && <p className="form-error">{formError}</p>}

                <div className="modal-buttons">
                  <button onClick={handlePaymentSubmit}>Submit Payment</button>
                  <button onClick={() => setShowModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EventPayment;
