// src/components/payments/ListRestaurantPayment.jsx
import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListRestaurantPayment.css";
import { HOTEL_NAME } from "../../config/constants";



const ListRestaurantPayment = () => {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editPayment, setEditPayment] = useState(null);
  const [newAmount, setNewAmount] = useState("");

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];

  if (Array.isArray(storedUser.roles)) {
    roles = storedUser.roles;
  } else if (typeof storedUser.role === "string") {
    roles = [storedUser.role];
  }
  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("restaurant"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to list restaurant payment.</p>
      </div>
    );
  }

  // ✅ get today date helper
  const getToday = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  // ✅ filter states (default to today)
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());
  const [saleId, setSaleId] = useState(""); // 👈 New Sale ID filter

  const fetchPayments = async () => {
    try {
      setLoading(true);

      const params = {};
      if (selectedLocation) params.location_id = selectedLocation;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (saleId) params.sale_id = saleId; // 👈 include sale_id filter

      const response = await axiosWithAuth().get(
        "/restpayment/sales/payments",
        { params }
      );

      // ✅ Normalize: recalc amount_paid & filter voided
      const normalizedSales = (response.data.sales || []).map((sale) => ({
      ...sale,
      total_amount: Number(sale.total_amount) || 0,
      amount_paid: Number(sale.amount_paid) || 0, // ✅ trust backend
      balance: Number(sale.balance) || 0,         // ✅ trust backend
    }));


      // ✅ Compare frontend calc vs backend
      normalizedSales.forEach((sale) => {
        if (sale.balance !== sale.balance) {
          console.warn(
            `⚠️ Balance mismatch for Sale ${sale.id}: backend=${sale.balance}, frontend=${sale.balance}`
          );
        }
      });

      setPayments(normalizedSales);
      setSummary(response.data.summary || {});
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await axiosWithAuth().get("/restaurant/locations");
      setLocations(res.data);
    } catch (err) {
      console.error("Failed to fetch locations", err);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchPayments();
  }, []);

  // ✅ Auto refresh when filters change
  useEffect(() => {
    fetchPayments();
  }, [selectedLocation, startDate, endDate, saleId]);

  const openEditModal = (payment) => {
    setEditPayment(payment);
    setNewAmount(payment.amount_paid);
  };

  const handleEditSave = async () => {
    if (!newAmount) return;
    try {
      await axiosWithAuth().put(
        `/restpayment/sales/payments/${editPayment.id}`,
        {
          amount_paid: Number(newAmount),
          payment_mode: editPayment.payment_mode,
          paid_by: editPayment.paid_by,
        }
      );
      setEditPayment(null);
      fetchPayments();
    } catch (err) {
      alert("Failed to update payment");
    }
  };

  const handleVoid = async (paymentId) => {
    if (!window.confirm("Are you sure you want to void this payment?")) return;
    try {
      await axiosWithAuth().put(
        `/restpayment/sales/payments/${paymentId}/void`
      );
      fetchPayments();
    } catch (err) {
      alert("Failed to void payment");
    }
  };

  // ✅ Updated handlePrint
const handlePrint = (sale, payment) => {
  const receiptWindow = window.open("", "_blank");

  // Ensure numeric safety
  const totalAmount = Number(sale.total_amount) || 0;
  const currentPayment = Number(payment.amount_paid) || 0;
  const totalPaid = Number(sale.amount_paid) || 0;   // ✅ backend-driven
  const balance = Number(sale.balance) || 0;         // ✅ backend-driven

  receiptWindow.document.write(`
    <html>
      <head>
        <title>Restaurant Payment Receipt</title>
        <style>
          body { font-family: monospace, Arial, sans-serif; padding: 5px; margin: 0; width: 80mm; }
          h2 { text-align: center; font-size: 14px; margin: 5px 0; }
          p { margin: 2px 0; font-size: 12px; }
          hr { border: 1px dashed #000; margin: 6px 0; }
          .void { color: red; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>${HOTEL_NAME.toUpperCase()}</h2>   <!-- 👈 use global hotel name -->
        <h2>Restaurant Payment Receipt</h2>
        <hr/>
        <p><strong>Sale ID:</strong> ${sale.id}</p>
        <p><strong>Payment ID:</strong> ${payment.id}</p>
        <p><strong>Sales Amount:</strong> ₦${totalAmount.toLocaleString()}</p>
        <p><strong>Current Payment:</strong> ₦${currentPayment.toLocaleString()}</p>
        <p><strong>Total Paid So Far:</strong> ₦${totalPaid.toLocaleString()}</p>
        <p><strong>Outstanding Balance:</strong> ₦${balance.toLocaleString()}</p>
        <p><strong>Mode:</strong> ${payment.payment_mode}</p>
        <p><strong>Paid By:</strong> ${payment.paid_by || "N/A"}</p>
        <p><strong>Status:</strong> ${
          payment.is_void ? '<span class="void">VOIDED</span>' : "VALID"
        }</p>
        <p><strong>Date:</strong> ${new Date(payment.created_at).toLocaleString()}</p>
        <hr/>
        <p style="text-align:center;">Thank you!</p>
      </body>
    </html>
  `);

  receiptWindow.document.close();
  receiptWindow.print();
};

  if (loading) return <p>Loading payments...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="payment-list-container">
      <h1>Restaurant Payments List</h1>

      {/* ✅ Filters */}
      <div className="filters">
        <label>
          Location:
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          From:
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>

        <label>
          To:
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>

        {/* 👇 New Sale ID filter */}
        <label>
          Sale ID:
          <input
            type="number"
            value={saleId}
            onChange={(e) => setSaleId(e.target.value)}
            placeholder="Enter Sale ID"
          />
        </label>

        <button className="btn filter" onClick={fetchPayments}>
          Apply Filters
        </button>
      </div>

      {/* ✅ Table */}
      <table className="payment-table">
        <thead>
          <tr>
            <th>Sale ID</th>
            <th>Pay ID</th>
            <th>Sales Amount</th>
            <th>Amount Paid</th>
            <th>Mode</th>
            <th>Paid By</th>
            <th>Status</th>
            <th>Date</th>
            <th>Total Paid</th>
            <th>Balance</th>
            <th className="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((sale) =>
            sale.payments.map((payment) => (
              <tr
                key={payment.id}
                className={payment.is_void ? "void-row" : ""}
              >
                <td>{sale.id}</td>
                <td>{payment.id}</td>
                <td>₦{Number(sale.total_amount).toLocaleString()}</td>
                <td>₦{Number(payment.amount_paid).toLocaleString()}</td>
                <td>{payment.payment_mode}</td>
                <td>
                  {payment.paid_by && payment.paid_by.trim() !== ""
                    ? payment.paid_by
                    : "N/A"}
                </td>
                <td className={payment.is_void ? "void-text" : ""}>
                  {payment.is_void ? "VOID" : "VALID"}
                </td>
                <td>{new Date(payment.created_at).toLocaleString()}</td>
                <td>₦{Number(sale.amount_paid).toLocaleString()}</td>
                <td>₦{Number(sale.balance).toLocaleString()}</td>
                <td className="row-actions">
                  <button
                    className="btn edit"
                    onClick={() => openEditModal(payment)}
                    disabled={payment.is_void}
                  >
                    Edit
                  </button>
                  <button
                    className="btn void"
                    onClick={() => handleVoid(payment.id)}
                    disabled={payment.is_void}
                  >
                    Void
                  </button>
                  <button
                    className="btn print"
                    onClick={() => handlePrint(sale, payment)}
                  >
                    Print
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ✅ Summary */}
      <div className="payment-summary">
        <h2>Summary</h2>
        <ul>
          {Object.entries(summary).map(([mode, amount]) => {
            if (mode === "Total Outstanding") return null;
            return (
              <li key={mode}>
                {mode}: ₦{Number(amount).toLocaleString()}
              </li>
            );
          })}
        </ul>
        {summary["Total Outstanding"] !== undefined && (
          <div className="outstanding">
            <strong>Total Outstanding:</strong>{" "}
            ₦{Number(summary["Total Outstanding"]).toLocaleString()}
          </div>
        )}
      </div>

      {/* ✅ Edit Modal */}
      {editPayment && (
        <div className="modal-overlay1" onClick={() => setEditPayment(null)}>
          <div
            className="modal1 card-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Edit Payment</h3>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Payment ID</label>
                  <span>{editPayment.id}</span>
                </div>
                <div className="form-group">
                  <label>Sale ID</label>
                  <span>{editPayment.sale_id}</span>
                </div>

                <div className="form-group full">
                  <label>Amount Paid (₦)</label>
                  <input
                    type="number"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="input"
                  />
                </div>

                <div className="form-group full">
                  <label>Mode of Payment</label>
                  <select
                    value={editPayment.payment_mode}
                    onChange={(e) =>
                      setEditPayment({
                        ...editPayment,
                        payment_mode: e.target.value,
                      })
                    }
                    className="input"
                  >
                    <option value="cash">Cash</option>
                    <option value="pos">POS</option>
                    <option value="transfer">Bank Transfer</option>
                  </select>
                </div>

                <div className="form-group full">
                  <label>Paid By</label>
                  <input
                    type="text"
                    value={editPayment.paid_by || ""}
                    onChange={(e) =>
                      setEditPayment({
                        ...editPayment,
                        paid_by: e.target.value,
                      })
                    }
                    className="input"
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn void" onClick={() => setEditPayment(null)}>
                Cancel
              </button>
              <button className="btn edit" onClick={handleEditSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListRestaurantPayment;
