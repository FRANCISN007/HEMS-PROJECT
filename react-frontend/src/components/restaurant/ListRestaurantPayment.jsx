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

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await axiosWithAuth().get("/restpayment/sales/payments");
      setPayments(response.data.sales);
      setSummary(response.data.summary);
    } catch (err) {
      setError("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

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
      await axiosWithAuth().put(`/restpayment/sales/payments/${paymentId}/void`);
      fetchPayments();
    } catch (err) {
      alert("Failed to void payment");
    }
  };

  const handlePrint = (payment) => {
    const receiptWindow = window.open("", "_blank");
    receiptWindow.document.write(`
      <html>
        <head>
          <title>Payment Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h2 { margin-bottom: 10px; }
            p { margin: 5px 0; }
            .void { color: red; font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>Payment Receipt</h2>
          <p><strong>Sale ID:</strong> ${payment.sale_id}</p>
          <p><strong>Payment ID:</strong> ${payment.id}</p>
          <p><strong>Amount Paid:</strong> ₦${payment.amount_paid.toFixed(2)}</p>
          <p><strong>Payment Mode:</strong> ${payment.payment_mode}</p>
          <p><strong>Paid By:</strong> ${payment.paid_by}</p>
          <p><strong>Status:</strong> ${
            payment.is_void ? '<span class="void">VOIDED</span>' : "VALID"
          }</p>
          <p><strong>Date:</strong> ${new Date(
            payment.created_at
          ).toLocaleString()}</p>
          <hr/>
          <p>Thank you for your payment.</p>
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

      <table className="payment-table">
        <thead>
          <tr>
            <th>Sale ID</th>
            <th>Pay ID</th>
            <th>Amount</th>
            <th>Mode</th>
            <th>Paid By</th>
            <th>Status</th>
            <th>Date</th>
            <th className="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((sale) =>
            sale.payments.map((payment) => (
              <tr key={payment.id} className={payment.is_void ? "void-row" : ""}>
                <td>{sale.id}</td>
                <td>{payment.id}</td>
                <td>₦{payment.amount_paid.toFixed(2)}</td>
                <td>{payment.payment_mode}</td>
                <td>{payment.paid_by}</td>
                <td className={payment.is_void ? "void-text" : ""}>
                  {payment.is_void ? "VOID" : "VALID"}
                </td>
                <td>{new Date(payment.created_at).toLocaleString()}</td>
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
                    onClick={() => handlePrint(payment)}
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
          {Object.entries(summary).map(([mode, amount]) => (
            <li key={mode}>
              {mode}: ₦{amount.toFixed(2)}
            </li>
          ))}
        </ul>
      </div>

      {/* ✅ Professional Edit Modal */}
      {editPayment && (
        <div className="modal-overlay1" onClick={() => setEditPayment(null)}>
          <div className="modal1 card-scale-in" onClick={(e) => e.stopPropagation()}>
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
                      setEditPayment({ ...editPayment, payment_mode: e.target.value })
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
                      setEditPayment({ ...editPayment, paid_by: e.target.value })
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
