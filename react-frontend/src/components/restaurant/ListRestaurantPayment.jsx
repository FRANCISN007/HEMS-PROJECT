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
  const [banks, setBanks] = useState([]);


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

  const getToday = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());
  const [saleId, setSaleId] = useState("");

  const fetchBanks = async () => {
    try {
      const res = await axiosWithAuth().get("/bank/simple"); // simple list: id + name
      setBanks(res.data);
    } catch (err) {
      console.error("Failed to fetch banks", err);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchPayments();
    fetchBanks(); // fetch banks
  }, []);


  const fetchPayments = async () => {
    try {
      setLoading(true);

      const params = {};
      if (selectedLocation) params.location_id = selectedLocation;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (saleId) params.sale_id = saleId;

      const response = await axiosWithAuth().get(
        "/restpayment/sales/payments",
        { params }
      );

      const normalizedSales = (response.data.sales || []).map((sale) => ({
        ...sale,
        total_amount: Number(sale.total_amount) || 0,
        amount_paid: Number(sale.amount_paid) || 0,
        balance: Number(sale.balance) || 0,
      }));

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
          payment_mode: editPayment.payment_mode.toUpperCase(),
          paid_by: editPayment.paid_by,
          bank: editPayment.bank || null, // selected bank name
        }
      );

      setEditPayment(null);
      fetchPayments();
    } catch (err) {
      alert("Failed to update payment");
    }
  };


  const handleDelete = async (paymentId) => {
    if (!window.confirm("Are you sure you want to delete this payment?")) return;
    try {
      await axiosWithAuth().delete(`/restpayment/sales/payments/${paymentId}`);
      fetchPayments();
    } catch (err) {
      alert("Failed to delete payment");
      console.error(err);
    }
  };

  const handlePrint = (sale, payment) => {
    const receiptWindow = window.open("", "_blank");

    const totalAmount = Number(sale.total_amount) || 0;
    const currentPayment = Number(payment.amount_paid) || 0;
    const totalPaid = Number(sale.amount_paid) || 0;
    const balance = Number(sale.balance) || 0;

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
          <h2>${HOTEL_NAME.toUpperCase()}</h2>
          <h2>Restaurant Payment Receipt</h2>
          <hr/>
          <p><strong>Sale ID:</strong> ${sale.id}</p>
          <p><strong>Payment ID:</strong> ${payment.id}</p>
          <p><strong>Sales Amount:</strong> ₦${totalAmount.toLocaleString()}</p>
          <p><strong>Current Payment:</strong> ₦${currentPayment.toLocaleString()}</p>
          <p><strong>Total Paid So Far:</strong> ₦${totalPaid.toLocaleString()}</p>
          <p><strong>Outstanding Balance:</strong> ₦${balance.toLocaleString()}</p>
          <p><strong>Mode:</strong> ${payment.payment_mode}</p>
          <p><strong>Bank:</strong> ${payment.bank || "N/A"}</p>
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

      {/* FILTERS */}
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

      {/* TABLE */}
      <table className="payment-table">
        <thead>
          <tr>
            <th>Sale ID</th>
            <th>Pay ID</th>
            <th>Sales Amount</th>
            <th>Amount Paid</th>
            <th>Mode</th>
            <th>Bank</th>
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
                <td>{payment.bank ? payment.bank.toUpperCase() : "N/A"}</td>

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

                <td
                  style={{
                    color: Number(sale.balance) === 0 ? "green" : "red",
                    fontWeight: "bold",
                  }}
                >
                  ₦{Number(sale.balance).toLocaleString()}
                </td>

                <td className="row-actions">
                  <button
                    className="btn edit"
                    onClick={() => openEditModal(payment)}
                    disabled={payment.is_void}
                  >
                    Edit
                  </button>

                  <button
                    className="btn delete"
                    onClick={() => handleDelete(payment.id)}
                  >
                    Delete
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

      {/* SUMMARY */}
      <div className="payment-summary" style={{ fontSize: "0.9rem", lineHeight: "1.3", marginTop: "1rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Summary</h2>

        <ul style={{ listStyle: "none", padding: 0, marginBottom: "0.8rem" }}>
          <li><strong>Total Sales:</strong> ₦{Number(summary.total_sales || 0).toLocaleString()}</li>
          <li><strong>Total Paid:</strong> ₦{Number(summary.total_paid || 0).toLocaleString()}</li>
          <li><strong>Total Due:</strong> ₦{Number(summary.total_due || 0).toLocaleString()}</li>
        </ul>

        <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Payment Modes</h3>
        <ul style={{ listStyle: "none", padding: 0, marginBottom: "0.8rem" }}>
          <li><strong>Cash:</strong> ₦{Number(summary.total_cash || 0).toLocaleString()}</li>
          <li><strong>POS:</strong> ₦{Number(summary.total_pos || 0).toLocaleString()}</li>
          <li><strong>Transfer:</strong> ₦{Number(summary.total_transfer || 0).toLocaleString()}</li>
        </ul>

        {summary.banks && Object.keys(summary.banks).length > 0 && (
          <>
            <h3 style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>Bank Breakdown</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {Object.entries(summary.banks).map(([bank, values]) => (
                <li key={bank} style={{ marginBottom: "0.2rem" }}>
                  <strong>{bank}:</strong> POS ₦{Number(values.pos).toLocaleString()} | 
                  Transfer ₦{Number(values.transfer).toLocaleString()}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>


      {/* EDIT MODAL */}
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
                      setEditPayment({
                        ...editPayment,
                        payment_mode: e.target.value,
                      })
                    }
                    className="input"
                  >
                    <option value="CASH">Cash</option>
                    <option value="POS">POS</option>
                    <option value="TRANSFER">Bank Transfer</option>
                  </select>
                </div>

                {/* ------------------------------ */}
                {/*     NEW BANK INPUT FIELD       */}
                {/* ------------------------------ */}
                <div className="form-group full">
                  <label>Bank</label>
                  <select
                    value={editPayment.bank || ""}
                    onChange={(e) =>
                      setEditPayment({
                        ...editPayment,
                        bank: e.target.value,
                      })
                    }
                    className="input"
                  >
                    <option value="">No Bank</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name.toUpperCase()}
                      </option>
                    ))}
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
