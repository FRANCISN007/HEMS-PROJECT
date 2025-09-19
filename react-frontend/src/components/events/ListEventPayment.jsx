import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ListEventPayment.css";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || `http://${window.location.hostname}:8000`;

const ListEventPayment = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState(null);

  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(Number(val))) return "0";
    return Number(val).toLocaleString();
  };

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

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      let url = `${API_BASE_URL}/eventpayment/`;
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to fetch event payments");

      const data = await res.json();

      // ✅ Compute cumulative balance per event
      const eventTotals = {}; // { event_id: cumulative_paid_so_far }
      const paymentsWithBalance = (data.payments || []).map((p) => {
        const totalDue = parseFloat(p.total_due || 0);
        const paid = parseFloat(p.amount_paid || 0) + parseFloat(p.discount_allowed || 0);

        if (!eventTotals[p.event_id]) eventTotals[p.event_id] = 0;
        eventTotals[p.event_id] += paid;

        const balanceDue = totalDue - eventTotals[p.event_id];
        return { ...p, balance_due: balanceDue };
      });

      setPayments(paymentsWithBalance);
      setSummary(data.summary || {});
    } catch (err) {
      setError(err.message || "Failed to fetch event payments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleView = (payment) => {
    navigate(`/dashboard/events/view/${payment.id}`);
  };

  return (
    <div className="list-event-payment-containers">
      <h2>📄 Event Payment List</h2>

      <div className="filterss">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <button onClick={fetchPayments}>↻ Refresh</button>
      </div>

      {loading && <p>Loading payments...</p>}
      {error && <p className="errors">{error}</p>}

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
              <th>Status</th>
              <th>Payment Date</th>
              <th>Created By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan="13" style={{ textAlign: "center" }}>
                  No event payments found
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.id}</td>
                  <td>{payment.organiser}</td>
                  <td>₦{formatCurrency(payment.event_amount)}</td>
                  <td>₦{formatCurrency(payment.caution_fee)}</td>
                  <td>₦{formatCurrency(payment.total_due)}</td>
                  <td>₦{formatCurrency(payment.amount_paid)}</td>
                  <td>₦{formatCurrency(payment.discount_allowed)}</td>
                  <td>₦{formatCurrency(payment.balance_due)}</td>
                  <td>{payment.payment_method || "-"}</td>
                  <td>{payment.payment_status || "-"}</td>
                  <td>{payment.payment_date ? new Date(payment.payment_date).toLocaleString() : "-"}</td>
                  <td>{payment.created_by || "-"}</td>
                  <td>
                    <button onClick={() => handleView(payment)}>View</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="all-summary-wrappers">
        <div className="summary-rows">
          <div className="summary-lefts">💵 Cash Total:</div>
          <div className="summary-rights">₦{formatCurrency(summary.total_cash)}</div>
        </div>
        <div className="summary-rows">
          <div className="summary-lefts">💳 POS Total:</div>
          <div className="summary-rights">₦{formatCurrency(summary.total_pos)}</div>
        </div>
        <div className="summary-rows">
          <div className="summary-lefts">🏦 Transfer Total:</div>
          <div className="summary-rights">₦{formatCurrency(summary.total_transfer)}</div>
        </div>
        <div className="summary-rows">
          <div className="summary-lefts"><strong>Total Payment:</strong></div>
          <div className="summary-rights"><strong>₦{formatCurrency(summary.total_payment)}</strong></div>
        </div>
      </div>
    </div>
  );
};

export default ListEventPayment;
