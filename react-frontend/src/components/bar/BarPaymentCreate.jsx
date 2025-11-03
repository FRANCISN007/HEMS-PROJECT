// src/components/bar/BarPaymentCreate.jsx

import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./BarPaymentCreate.css";

const BarPayment = () => {
  const [bars, setBars] = useState([]);
  const [selectedBar, setSelectedBar] = useState("");
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState({ total_entries: 0, total_due: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // ✅ Get user roles from localStorage
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const roles = user.roles || [];

  // ✅ Restrict access: only admin and bar can create payments
  if (!(roles.includes("admin") || roles.includes("bar"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to create bar payments.</p>
      </div>
    );
  }

  // ✅ Fetch bars
  useEffect(() => {
    const fetchBars = async () => {
      try {
        const res = await axiosWithAuth().get("/bar/bars/simple");
        setBars(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("❌ Failed to fetch bars:", err);
      }
    };
    fetchBars();
  }, []);

  // ✅ Utility function for formatting amounts
  const formatAmount = (amount) => {
    if (!amount && amount !== 0) return "₦0.00";
    return `₦${Number(amount).toLocaleString()}`;
  };

  // ✅ Fetch outstanding sales for selected bar
  useEffect(() => {
    const fetchSales = async () => {
      if (!selectedBar) return;
      setLoading(true);
      try {
        const res = await axiosWithAuth().get(
          `/barpayment/outstanding?bar_id=${selectedBar}`
        );
        setSales(Array.isArray(res.data.results) ? res.data.results : []);
        setSummary({
          total_entries: res.data.total_entries || 0,
          total_due: res.data.total_due || 0,
        });
      } catch (err) {
        console.error("❌ Failed to fetch sales:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, [selectedBar]);

  // ✅ Handle Payment Submit
  const handlePayment = async (e) => {
    e.preventDefault();
    if (!selectedSale || !amountPaid || !paymentMethod) {
      setMessage("⚠️ Please fill all required fields.");
      setMessageType("warning");
      return;
    }

    try {
      const payload = {
        bar_sale_id: selectedSale.bar_sale_id,
        amount_paid: parseFloat(amountPaid),
        payment_method: paymentMethod,
        note: note,
      };

      await axiosWithAuth().post("/barpayment/", payload);

      setMessage("✅ Payment recorded successfully!");
      setMessageType("success");

      // Reset modal
      setSelectedSale(null);
      setAmountPaid("");
      setPaymentMethod("");
      setNote("");

      // Refresh sales
      const res = await axiosWithAuth().get(
        `/barpayment/outstanding?bar_id=${selectedBar}`
      );
      setSales(Array.isArray(res.data.results) ? res.data.results : []);
      setSummary({
        total_entries: res.data.total_entries || 0,
        total_due: res.data.total_due || 0,
      });

      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error("❌ Payment failed:", err.response?.data || err.message);
      setMessage(
        `❌ Failed: ${
          err.response?.data?.detail || "Unable to record payment."
        }`
      );
      setMessageType("error");
    }
  };

  return (
    <div className="bar-payment-container2">
      <div className="header-row">
        {/* ✅ Larger Header Text */}
        <h1 style={{ fontSize: "2rem", fontWeight: "700", margin: "10px 0" }}>
          🍽️ Restaurant Payments
        </h1>

        {selectedBar && (
          <div className="summary-box">
            <p>
              <strong>Total Entries:</strong> {summary.total_entries}
            </p>
            <p>
              <strong>Total Due:</strong>{" "}
              <span style={{ color: "red" }}>{formatAmount(summary.total_due)}</span>
            </p>
          </div>
        )}
      </div>

      {message && <div className={`message ${messageType}`}>{message}</div>}

      {/* ✅ Bar Selector */}
      <div className="bar-filter">
        <label htmlFor="barSelect">Select Bar:</label>
        <select
          id="barSelect"
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
      </div>

      {/* ✅ Sales Table */}
      {loading ? (
        <p>⏳ Loading sales...</p>
      ) : (
        selectedBar && (
          <table className="sales-table2">
            <thead>
              <tr>
                <th>Sale ID</th>
                <th>Total Amount</th>
                <th>Paid</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center" }}>
                    No outstanding sales for this bar.
                  </td>
                </tr>
              ) : (
                sales
                  .filter((sale) => sale.balance_due > 0)
                  .map((sale) => {
                    const total = sale.sale_amount || 0;
                    const paid = sale.amount_paid || 0;
                    const balance = sale.balance_due || 0;

                    let status = "Unpaid";
                    if (paid > 0 && balance > 0) {
                      status = "Part Payment";
                    }

                    return (
                      <tr key={sale.bar_sale_id}>
                        <td>{sale.bar_sale_id}</td>
                        <td>{formatAmount(total)}</td>
                        <td>{formatAmount(paid)}</td>
                        <td style={{ color: balance > 0 ? "red" : "green" }}>
                          {formatAmount(balance)}
                        </td>
                        <td>{status}</td>
                        <td>
                          <button
                            className="pay-btn"
                            onClick={() => setSelectedSale(sale)}
                          >
                            Make Payment
                          </button>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        )
      )}

      {/* ✅ Payment Modal */}
      {selectedSale && (
        <div className="modal-overlay1">
          <div className="modal1">
            <h3>Make Payment for Sale #{selectedSale.bar_sale_id}</h3>
            <form onSubmit={handlePayment}>
              <label>Amount Paid:</label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />

              <label>Payment Method:</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="">-- Select Method --</option>
                <option value="cash">Cash</option>
                <option value="pos">POS</option>
                <option value="transfer">Transfer</option>
              </select>

              <label>Note:</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note about this payment"
              />

              <div className="modal-actions1">
                <button type="submit">Submit Payment</button>
                <button type="button" onClick={() => setSelectedSale(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarPayment;
