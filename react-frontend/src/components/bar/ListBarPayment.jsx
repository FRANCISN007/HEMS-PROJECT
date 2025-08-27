import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListBarPayment.css";

const ListBarPayment = () => {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [bars, setBars] = useState([]); // ✅ bar list
  const [selectedBar, setSelectedBar] = useState(""); // ✅ selected bar
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingPayment, setEditingPayment] = useState(null);
  const [formData, setFormData] = useState({ amount_paid: "", payment_method: "", note: "" });

  // format amounts nicely
  const formatAmount = (amount) => {
    if (!amount && amount !== 0) return "₦0.00";
    return `₦${Number(amount).toLocaleString()}`;
  };

  // ✅ Fetch available bars
  const fetchBars = async () => {
    try {
      const res = await axiosWithAuth().get("/bar/bars/simple");
      setBars(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("❌ Failed to fetch bars:", err);
    }
  };

  // ✅ Fetch payments (with bar filter)
  const fetchPayments = async (barId = "") => {
    setLoading(true);
    try {
      const res = await axiosWithAuth().get("/barpayment/", {
        params: barId ? { bar_id: barId } : {},
      });
      setPayments(Array.isArray(res.data.payments) ? res.data.payments : []);
      setSummary(res.data.summary || null);
    } catch (err) {
      console.error("❌ Failed to fetch bar payments:", err);
      setError("Failed to load bar payments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBars();
    fetchPayments();
  }, []);

  // Re-fetch when bar changes
  useEffect(() => {
    fetchPayments(selectedBar);
  }, [selectedBar]);

  // ✅ Handle Delete
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this payment?")) return;
    try {
      await axiosWithAuth().delete(`/barpayment/${id}`);
      setPayments(payments.filter((p) => p.id !== id));
    } catch (err) {
      console.error("❌ Failed to delete payment:", err);
      alert("Failed to delete payment.");
    }
  };

  // ✅ Handle Edit
  const handleEdit = (payment) => {
    setEditingPayment(payment);
    setFormData({
      amount_paid: payment.amount_paid,
      payment_method: payment.payment_method,
      note: payment.note,
    });
  };

  // ✅ Handle Save
  const handleSave = async () => {
    try {
      const res = await axiosWithAuth().put(`/barpayment/${editingPayment.id}`, formData);
      setPayments(payments.map((p) => (p.id === editingPayment.id ? res.data : p)));
      setEditingPayment(null);
    } catch (err) {
      console.error("❌ Failed to update payment:", err);
      alert("Failed to update payment.");
    }
  };

  return (
    <div className="list-bar-payment-container">
      <h2>📃 Bar Payment Records</h2>

      {/* ✅ Bar Filter */}
      <div className="filter-section">
        <label>Filter by Bar: </label>
        <select value={selectedBar} onChange={(e) => setSelectedBar(e.target.value)}>
          <option value="">-- All Bars --</option>
          {bars.map((bar) => (
            <option key={bar.id} value={bar.id}>
              {bar.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p>⏳ Loading payments...</p>}
      {error && <p className="error">{error}</p>}

      {/* ✅ Summary Section */}
      {summary && (
        <div className="summary-box">
          <h3>📊 Payment Summary</h3>
          <p><strong>Total Sales:</strong> {formatAmount(summary.total_sales)}</p>
          <p><strong>Total Paid:</strong> {formatAmount(summary.total_paid)}</p>
          <p><strong>Total Due:</strong> {formatAmount(summary.total_due)}</p>
          <p><strong>Cash:</strong> {formatAmount(summary.total_cash)}</p>
          <p><strong>POS:</strong> {formatAmount(summary.total_pos)}</p>
          <p><strong>Transfer:</strong> {formatAmount(summary.total_transfer)}</p>
        </div>
      )}

      {!loading && payments.length === 0 ? (
        <p>No payment records found.</p>
      ) : (
        <table className="bar-payment-table">
          <thead>
            <tr>
              <th>Payment ID</th>
              <th>Sale ID</th>
              <th>Sale Amount</th>
              <th>Paid</th>
              <th>Balance Due</th>
              <th>Method</th>
              <th>Note</th>
              <th>Date Paid</th>
              <th>Created By</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.bar_sale_id}</td>
                <td>{formatAmount(p.sale_amount)}</td>
                <td>{formatAmount(p.amount_paid)}</td>
                <td style={{ color: p.balance_due > 0 ? "red" : "green" }}>
                  {formatAmount(p.balance_due)}
                </td>
                <td>{p.payment_method || "-"}</td>
                <td>{p.note || "-"}</td>
                <td>{p.date_paid ? new Date(p.date_paid).toLocaleDateString() : "-"}</td>
                <td>{p.created_by || "-"}</td>
                <td className={`status ${p.status?.toLowerCase().replace(/\s+/g, "-")}`}>
                  {p.status}
                </td>
                <td>
                  <button className="btn-edit" onClick={() => handleEdit(p)}>✏️ Edit</button>
                  <button className="btn-delete" onClick={() => handleDelete(p.id)}>🗑️ Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ✅ Edit Modal */}
      {editingPayment && (
        <div className="modal">
          <div className="modal-content">
            <h3>Edit Payment #{editingPayment.id}</h3>

            <label>Amount Paid</label>
            <input
              type="number"
              value={formData.amount_paid}
              onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
            />

            <label>Payment Method</label>
            <select
              value={formData.payment_method || ""}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
            >
              <option value="">-- Select Method --</option>
              <option value="cash">Cash</option>
              <option value="pos">POS</option>
              <option value="transfer">Transfer</option>
            </select>

            <label>Note</label>
            <input
              type="text"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            />

            <div className="modal-actions">
              <button onClick={handleSave} className="btn-edit">💾 Save</button>
              <button onClick={() => setEditingPayment(null)} className="btn-delete">❌ Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListBarPayment;
