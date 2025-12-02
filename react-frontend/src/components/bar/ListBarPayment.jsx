import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListBarPayment.css";
import { HOTEL_NAME } from "../../config/constants";

const ListBarPayment = () => {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [bars, setBars] = useState([]);
  const [selectedBar, setSelectedBar] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const user = JSON.parse(localStorage.getItem("user")) || {};
  const roles = user.roles || [];

  if (!(roles.includes("admin") || roles.includes("bar"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to list bar payments.</p>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingPayment, setEditingPayment] = useState(null);
  const [formData, setFormData] = useState({
    amount_paid: "",
    payment_method: "",
    note: "",
  });

  // ✅ BANKS
  const [banks, setBanks] = useState([]);

  useEffect(() => {
    axiosWithAuth()
      .get("/bank/simple")
      .then((res) => setBanks(res.data || []))
      .catch((err) => console.error("Failed to fetch banks:", err));
  }, []);

  const formatAmount = (amount) => {
    if (!amount && amount !== 0) return "₦0.00";
    return `₦${Number(amount).toLocaleString()}`;
  };

  const fetchBars = async () => {
    try {
      const res = await axiosWithAuth().get("/bar/bars/simple");
      setBars(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("❌ Failed to fetch bars:", err);
    }
  };

  const fetchPayments = async (barId = "", start = "", end = "", status = "") => {
    setLoading(true);
    try {
      const params = {};
      if (start) params.start_date = start;
      if (end) params.end_date = end;
      if (barId) params.bar_id = Number(barId);
      if (status) params.status = status;  // 🔥 only used for payment-status endpoint

      let res;

      if (status) {
        // 🔥 If status filter is selected → USE PAYMENT-STATUS ENDPOINT
        res = await axiosWithAuth().get("/barpayment/payment-status", {
          params,
        });

        // 🔥 This endpoint returns an array, not an object with .payments
        const mappedPayments = res.data.map((p) => ({
          id: p.payment_id,
          bar_sale_id: p.bar_sale_id,
          sale_amount: p.amount_due,
          amount_paid: p.amount_paid,
          cumulative_paid: p.amount_paid, // because endpoint doesn't send cumulative
          balance_due: p.amount_due - p.amount_paid,
          payment_method: p.payment_method,
          bank: "-", // not returned here
          note: "-",
          date_paid: p.date_paid,
          created_by: p.created_by,
          status: p.payment_status,
        }));

        setPayments(mappedPayments);
        setSummary(null);
      } 
      else {
        // 🔥 No status filter → USE NORMAL ENDPOINT
        res = await axiosWithAuth().get("/barpayment/", { params });

        const mappedPayments = res.data.payments.map((p) => ({
          id: p.id,
          bar_sale_id: p.bar_sale_id,
          sale_amount: p.sale_amount,
          amount_paid: p.amount_paid,
          cumulative_paid: p.cumulative_paid,
          balance_due: p.balance_due,
          payment_method: p.payment_method,
          bank: p.bank || "-",
          note: p.note,
          date_paid: p.date_paid,
          created_by: p.created_by,
          status: p.status,
        }));

        setPayments(mappedPayments);
        setSummary(res.data.summary);
      }

    } catch (err) {
      console.error("❌ Failed to fetch bar payments:", err);
      setError("Failed to load bar payments.");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchBars();
    fetchPayments("", today, today, "");
  }, []);

  useEffect(() => {
    fetchPayments(selectedBar, startDate, endDate, selectedStatus);
  }, [selectedBar, startDate, endDate, selectedStatus]);

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

  const handleEdit = (payment) => {
    setEditingPayment(payment);
    setFormData({
      amount_paid: payment.amount_paid,
      payment_method: payment.payment_method,
      note: payment.note,
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosWithAuth().put(
        `/barpayment/${editingPayment.id}`,
        formData
      );
      setPayments(
        payments.map((p) => (p.id === editingPayment.id ? res.data : p))
      );
      setEditingPayment(null);
    } catch (err) {
      console.error("❌ Failed to update payment:", err);
      alert("Failed to update payment.");
    }
  };

  const handleVoid = async (id) => {
    if (!window.confirm("Are you sure you want to void this payment?")) return;
    try {
      const res = await axiosWithAuth().put(`/barpayment/${id}/void`);
      setPayments(payments.map((p) => (p.id === id ? res.data : p)));
    } catch (err) {
      console.error("❌ Failed to void payment:", err);
      alert("Failed to void payment.");
    }
  };

  const handlePrint = (payment) => {
    const salePayments = payments.filter(
      (p) => p.bar_sale_id === payment.bar_sale_id
    );
    const totalPaid = salePayments
      .filter((p) => p.status?.toLowerCase() !== "voided payment")
      .reduce((sum, p) => sum + (p.amount_paid || 0), 0);

    const saleAmount = payment.sale_amount;
    const netBalance = saleAmount - totalPaid;

    const receiptWindow = window.open("", "_blank");
    receiptWindow.document.write(`
      <html>
        <head>
          <title>Bar Payment Receipt</title>
          <style>
            body { font-family: monospace, Arial; width: 80mm; }
            h2 { text-align: center; font-size: 14px; margin: 5px 0; }
            p { margin: 2px 0; font-size: 12px; }
            hr { border: 1px dashed #000; margin: 6px 0; }
            .void { color: red; font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>${HOTEL_NAME.toUpperCase()}</h2>
          <h2>Bar Payment Receipt</h2>
          <hr/>
          <p><strong>Pay ID:</strong> ${payment.id}</p>
          <p><strong>Sale ID:</strong> ${payment.bar_sale_id}</p>
          <p><strong>Sale Amount:</strong> ₦${Number(
            saleAmount
          ).toLocaleString()}</p>
          <p><strong>Current Paid:</strong> ₦${Number(
            payment.amount_paid
          ).toLocaleString()}</p>
          <p><strong>Total Paid So Far:</strong> ₦${Number(
            totalPaid
          ).toLocaleString()}</p>
          <p><strong>Net Balance:</strong> ₦${Number(
            netBalance
          ).toLocaleString()}</p>
          <p><strong>Method:</strong> ${payment.payment_method}</p>
          <p><strong>Note:</strong> ${payment.note || "-"}</p>
          <p><strong>Status:</strong> ${
            payment.status?.toLowerCase() === "voided payment"
              ? '<span class="void">VOIDED</span>'
              : payment.status
          }</p>
          <p><strong>Date:</strong> ${
            payment.date_paid
              ? new Date(payment.date_paid).toLocaleString()
              : "-"
          }</p>
          <hr/>
          <p style="text-align:center;">✅ Thank you!</p>
        </body>
      </html>
    `);
    receiptWindow.document.close();
    receiptWindow.print();
  };

  return (
    <div className="list-bar-payment-container">
      <h2>📃 Bar Payment Records</h2>

      {/* Filters */}
      <div className="filter-section">
        <label>Filter by Bar:</label>
        <select
          value={selectedBar}
          onChange={(e) => setSelectedBar(e.target.value)}
        >
          <option value="">-- All Bars --</option>
          {bars.map((bar) => (
            <option key={bar.id} value={bar.id}>
              {bar.name}
            </option>
          ))}
        </select>

        <label>Start Date:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        <label>End Date:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />

        <label>Status:</label>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="">-- All Status --</option>
          <option value="fully paid">Fully Paid</option>
          <option value="part payment">Part Payment</option>
          <option value="voided payment">Voided</option>
        </select>
      </div>

      {loading && <p>⏳ Loading payments...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && payments.length === 0 && <p>No payment records found.</p>}

      <div className="table-scroll">
        <table className="bar-payment-table">
          <thead>
            <tr>
              <th>PayID</th>
              <th>Sale ID</th>
              <th>Sale Amt</th>
              <th>Paid</th>
              <th>Total Paid</th>
              <th>Bal Due</th>
              <th>Method</th>

              <th>Bank</th>

              <th>Note</th>
              <th>Date Paid</th>
              <th>Created By</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {payments.map((p) => {
              const bankName = p.bank || "-";


              return (
                <tr
                  key={p.id}
                  className={
                    p.status?.toLowerCase() === "voided payment"
                      ? "void-row"
                      : ""
                  }
                >
                  <td>{p.id}</td>
                  <td>{p.bar_sale_id}</td>
                  <td>{formatAmount(p.sale_amount)}</td>
                  <td>{formatAmount(p.amount_paid)}</td>
                  <td>{formatAmount(p.cumulative_paid)}</td>

                  <td
                    style={{ color: p.balance_due > 0 ? "red" : "green" }}
                  >
                    {formatAmount(p.balance_due)}
                  </td>

                  <td>{p.payment_method || "-"}</td>

                  {/* 🔥 DISPLAY BANK NAME */}
                  <td>{bankName}</td>

                  <td>{p.note || "-"}</td>
                  <td>
                    {p.date_paid
                      ? new Date(p.date_paid).toLocaleDateString()
                      : "-"}
                  </td>
                  <td>{p.created_by || "-"}</td>

                  <td
                    className={`status ${p.status
                      ?.toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
                    {p.status}
                  </td>

                  <td>
                    <button
                      className="btn-edit"
                      onClick={() => handleEdit(p)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(p.id)}
                    >
                      🗑️ Delete
                    </button>
                    <button
                      className="btn-void"
                      onClick={() => handleVoid(p.id)}
                      disabled={p.status === "voided payment"}
                    >
                      🚫 Void
                    </button>
                    <button
                      className="btn-print"
                      onClick={() => handlePrint(p)}
                    >
                      🖨 Print
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingPayment && (
        <div className="modal-overlay3">
          <div className="modal3">
            <h3>Edit Payment #{editingPayment.id}</h3>
            <form onSubmit={handleSave}>
              <label>Amount Paid</label>
              <input
                type="number"
                value={formData.amount_paid}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount_paid: e.target.value,
                  })
                }
              />

              <label>Payment Method</label>
              <select
                value={formData.payment_method || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payment_method: e.target.value,
                  })
                }
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
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    note: e.target.value,
                  })
                }
              />

              <div className="modal-actions3">
                <button type="submit" className="btn-edit">
                  💾 Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="btn-delete"
                >
                  ❌ Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListBarPayment;
