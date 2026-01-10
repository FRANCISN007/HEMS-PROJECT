import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ListEventPayment.css";

import getBaseUrl from "../../api/config";
const API_BASE_URL = getBaseUrl();

const ListEventPayment = () => {
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // -------------------------------
  //   AUTHORIZATION CHECK
  // -------------------------------
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];

  if (Array.isArray(storedUser.roles)) roles = storedUser.roles;
  else if (typeof storedUser.role === "string") roles = [storedUser.role];

  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("event"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to list event payment.</p>
      </div>
    );
  }

  // -------------------------------
  //   HELPERS
  // -------------------------------
  const formatCurrency = (val) => {
    if (!val || isNaN(Number(val))) return "0";
    return Number(val).toLocaleString();
  };

  // -------------------------------
  //   SET CURRENT MONTH ON MOUNT
  // -------------------------------
  useEffect(() => {
    const now = new Date();

    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const formatDate = (d) => d.toISOString().split("T")[0];

    setStartDate(formatDate(firstDay));
    setEndDate(formatDate(lastDay));
  }, []);

  // -------------------------------
  //   FETCH PAYMENTS
  // -------------------------------
  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("token");
      let url = `${API_BASE_URL}/eventpayment/`;

      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to fetch event payments");
      }

      const data = await res.json();

      const paymentsWithFlags = (data.payments || []).map((p) => ({
        ...p,
        isVoided: (p.payment_status || "").toLowerCase() === "voided",
      }));

      setPayments(paymentsWithFlags);
      setSummary(data.summary || {});
    } catch (err) {
      setError(err.message || "Failed to fetch event payments");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------
  //   AUTO FETCH WHEN DATES READY
  // -------------------------------
  useEffect(() => {
    if (startDate && endDate) {
      fetchPayments();
    }
  }, [startDate, endDate]);

  // -------------------------------
  //   VIEW PAYMENT (CORRECT FIX)
  // -------------------------------
  const handleView = (payment) => {
    // ⛔ Block voided payments completely
    if (payment.isVoided) return;

    // ✅ View EXACT payment clicked
    navigate(`/dashboard/events/payments/view/${payment.id}`);
  };

  // -------------------------------
  //   JSX RETURN
  // -------------------------------
  return (
    <div className="list-event-payment-containers">
      <h2>📄 Event Payment List</h2>

      <div className="filterss">
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
        <button onClick={fetchPayments}>↻ Refresh</button>
      </div>

      {loading && <p>Loading payments...</p>}
      {error && <p className="errors">{error}</p>}

      <div className="full-scroll-wrapper">
        {/* TABLE */}
        <div className="payment-table-scroll">
          <table className="event-payment-tables">
            <thead>
              <tr>
                <th>ID</th>
                <th>Organiser</th>
                <th>Event Amount</th>
                <th>Caution Fee</th>
                <th>Total Due</th>
                <th>Amount Paid</th>
                <th>Discount</th>
                <th>Balance Due</th>
                <th>Method</th>
                <th>Bank</th>
                <th>Status</th>
                <th>Payment Date</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan="14" style={{ textAlign: "center" }}>
                    No event payments found
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className={payment.isVoided ? "voided-payment-row" : ""}
                  >
                    <td>{payment.id}</td>
                    <td>{payment.organiser}</td>
                    <td>₦{formatCurrency(payment.event_amount)}</td>
                    <td>₦{formatCurrency(payment.caution_fee)}</td>
                    <td>₦{formatCurrency(payment.total_due)}</td>
                    <td>₦{formatCurrency(payment.amount_paid)}</td>
                    <td>₦{formatCurrency(payment.discount_allowed)}</td>
                    <td>₦{formatCurrency(payment.balance_due)}</td>
                    <td>{payment.payment_method || "-"}</td>
                    <td>{payment.bank || "-"}</td>
                    <td>
                      {payment.isVoided ? (
                        <span className="voided-status">VOID</span>
                      ) : (
                        (payment.payment_status || "-").toUpperCase()
                      )}
                    </td>
                    <td>
                      {payment.payment_date
                        ? new Date(payment.payment_date).toLocaleString()
                        : "-"}
                    </td>
                    <td>{payment.created_by || "-"}</td>
                    <td>
                      {payment.isVoided ? (
                        <span className="voided-status">—</span>
                      ) : (
                        <button onClick={() => handleView(payment)}>
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* SUMMARY */}
        <div className="summary-horizontal">
          <div className="summary-left">
            <span>
              <strong>Total Event Cost:</strong> ₦
              {formatCurrency(summary.total_event_cost)}
            </span>
            <span>
              <strong>Amount Paid:</strong> ₦
              {formatCurrency(summary.total_paid)}
            </span>
            <span>
              <strong>Total Due:</strong> ₦
              {formatCurrency(summary.total_due)}
            </span>
          </div>

          <div className="summary-middle">
            <span>💵 Cash: ₦{formatCurrency(summary.by_method?.total_cash)}</span>
            <span>💳 POS: ₦{formatCurrency(summary.by_method?.total_pos)}</span>
            <span>
              🏦 Transfer: ₦
              {formatCurrency(summary.by_method?.total_transfer)}
            </span>
          </div>

          <div className="summary-right">
            {summary.by_bank &&
              Object.entries(summary.by_bank).map(([bank, totals]) => (
                <span key={bank} className="bank-summary-horizontal">
                  {bank}: POS ₦{formatCurrency(totals.pos)} | Transfer ₦
                  {formatCurrency(totals.transfer)}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListEventPayment;
