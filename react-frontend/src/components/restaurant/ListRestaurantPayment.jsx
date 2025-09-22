import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListRestaurantPayment.css";

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

  const fetchPayments = async () => {
    try {
      setLoading(true);

      const params = {};
      if (selectedLocation) params.location_id = selectedLocation;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await axiosWithAuth().get(
        "/restpayment/sales/payments",
        { params }
      );

      // ✅ Normalize: recalc amount_paid & filter voided
      const normalizedSales = (response.data.sales || []).map((sale) => {
        const allPayments = sale.payments || [];

        // ✅ Sum only valid payments
        const amountPaid = allPayments
          .filter((p) => !p.is_void)
          .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);

        return {
          ...sale,
          payments: allPayments, // ✅ keep voided for display
          total_amount: Number(sale.total_amount) || 0,
          amount_paid: amountPaid,
          balance: (Number(sale.total_amount) || 0) - amountPaid,
        };
      });

      setPayments(normalizedSales);
      setSummary(response.data.summary || {});
    } catch (err) {
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
  }, [selectedLocation, startDate, endDate]);

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
          <h2>RESTAURANT PAYMENT RECEIPT</h2>
          <hr/>
          <p><strong>Sale ID:</strong> ${sale.id}</p>
          <p><strong>Payment ID:</strong> ${payment.id}</p>
          <p><strong>Sales Amount:</strong> ₦${Number(sale.total_amount).toLocaleString()}</p>
          <p><strong>Amount Paid:</strong> ₦${Number(payment.amount_paid).toLocaleString()}</p>
          <p><strong>Total Paid:</strong> ₦${Number(sale.amount_paid).toLocaleString()}</p>
          <p><strong>Balance:</strong> ₦${Number(sale.balance).toLocaleString()}</p>
          <p><strong>Mode:</strong> ${payment.payment_mode}</p>
          <p><strong>Paid By:</strong> ${payment.paid_by || "N/A"}</p>
          <p><strong>Status:</strong> ${
            payment.is_void ? '<span class="void">VOIDED</span>' : "VALID"
          }</p>
          <p><strong>Date:</strong> ${new Date(
            payment.created_at
          ).toLocaleString()}</p>
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

        <button className="btn filter" onClick={fetchPayments}>
          Apply Filters
        </button>
      </div>

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

      <div className="payment-summary">
        <h2>Summary</h2>
        <ul>
          {Object.entries(summary).map(([mode, amount]) => {
            if (mode === "Total Outstanding") return null; // skip, we render separately
            return (
              <li key={mode}>
                {mode}: ₦{Number(amount).toLocaleString()}
              </li>
            );
          })}
        </ul>

        {/* ✅ Always show Total Outstanding clearly */}
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
              <button
                className="btn void"
                onClick={() => setEditPayment(null)}
              >
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
