import React, { useState } from "react";
import "./VoidEventPayment.css"; // Make sure to add updated CSS

import getBaseUrl from "../../api/config";
const API_BASE_URL = getBaseUrl();

const VoidEventPayment = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hasFetched, setHasFetched] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [voiding, setVoiding] = useState(false);

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
        <p>You do not have permission to void event.</p>
      </div>
    );
  }

  const fetchPayments = async () => {
    if (!startDate || !endDate) {
      setError("Please select both start and end dates.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append("start_date", startDate);
      params.append("end_date", endDate);

      const url = `${API_BASE_URL}/eventpayment/?${params.toString()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      const data = await res.json();
      setPayments(data.payments || []);
      setHasFetched(true);
    } catch (err) {
      setError("Failed to fetch event payments.");
    } finally {
      setLoading(false);
    }
  };

  const openVoidDialog = (payment) => {
    setSelectedPayment(payment);
    setShowDialog(true);
  };

  const handleConfirmVoid = async () => {
    setVoiding(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/eventpayment/void/${selectedPayment.id}/`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Failed to void event payment.");
        return;
      }

      alert(data.message);
      setPayments((prev) =>
        prev.map((p) =>
          p.id === selectedPayment.id
            ? { ...p, payment_status: "voided" }
            : p
        )
      );
      setShowDialog(false);
      setSelectedPayment(null);
    } catch (error) {
      console.error("Void error:", error);
      alert("An error occurred while trying to void the payment.");
    } finally {
      setVoiding(false);
    }
  };

  return (
    <div className="void-payment-container">
      <h2 className="void-title">❌ Void Event Payment</h2>

      <div className="filter-row">
        <label htmlFor="start-date">Start Date:</label>
        <input
          type="date"
          id="start-date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        <label htmlFor="end-date">End Date:</label>
        <input
          type="date"
          id="end-date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />

        <button className="fetch-button" onClick={fetchPayments}>
          Fetch
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {hasFetched && (
        <div className="payment-table-wrapper">
          <table className="payment-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Organiser</th>
                <th>Event Amount</th>
                <th>Amount Paid</th>
                <th>Discount</th>
                <th>Balance</th>
                <th>Method</th>
                <th>Status</th>
                <th>Payment Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: "center" }}>
                    No payments found.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const isVoided = p.payment_status === "voided";
                  return (
                    <tr
                      key={p.id}
                      className={isVoided ? "voided-payment-row" : ""}
                    >
                      <td>{p.id}</td>
                      <td>{p.organiser}</td>
                      <td>₦{p.event_amount?.toLocaleString()}</td>
                      <td>₦{p.amount_paid?.toLocaleString()}</td>
                      <td>₦{p.discount_allowed?.toLocaleString()}</td>
                      <td>₦{p.balance_due?.toLocaleString()}</td>
                      <td>{p.payment_method}</td>
                      <td className={isVoided ? "voided-status" : ""}>
                        {isVoided ? "VOID" : p.payment_status}
                      </td>
                      <td>{new Date(p.payment_date).toLocaleString()}</td>
                      <td>
                        {!isVoided && (
                          <button
                            className="void-btn"
                            onClick={() => openVoidDialog(p)}
                          >
                            ❌Void
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {showDialog && selectedPayment && (
        <div className="modal-overlay">
          <div className="modal-box">
            <p>
              Are you sure you want to void event payment{" "}
              <strong>#{selectedPayment.id}</strong> (₦
              {selectedPayment.amount_paid?.toLocaleString()})?
            </p>
            <div className="modal-buttons">
              <button onClick={handleConfirmVoid} disabled={voiding}>
                {voiding ? "Voiding..." : "Yes, Void"}
              </button>
              <button onClick={() => setShowDialog(false)} disabled={voiding}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoidEventPayment;
