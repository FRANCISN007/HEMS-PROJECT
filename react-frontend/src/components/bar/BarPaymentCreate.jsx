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
  const [bankId, setBankId] = useState("");
  const [note, setNote] = useState("");
  const [banks, setBanks] = useState([]);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const user = JSON.parse(localStorage.getItem("user")) || {};
  const roles = user.roles || [];

  if (!(roles.includes("admin") || roles.includes("bar"))) {
    return <div className="unauthorized">🚫 Access Denied</div>;
  }


  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0] // default today
  );

  // ================= FORMATTERS =================
  const formatAmount = (val) =>
    `₦${Number(val || 0).toLocaleString("en-NG")}`;

  const formatDate = (date) => {
    if (!date) return "-";
    try {
      const d = new Date(date);
      if (isNaN(d)) return "-";
      return d.toLocaleDateString("en-NG", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  };

  // ================= FETCH BARS =================
  useEffect(() => {
    axiosWithAuth()
      .get("/bar/bars/simple")
      .then((res) => setBars(res.data || []))
      .catch(console.error);
  }, []);

  // ================= FETCH BANKS =================
  useEffect(() => {
    axiosWithAuth()
      .get("/bank/simple")
      .then((res) => setBanks(res.data || []))
      .catch(console.error);
  }, []);

  // ================= FETCH SALES =================
  useEffect(() => {
    if (!selectedBar) return;

    const fetchSales = async () => {
      setLoading(true);
      try {
        const res = await axiosWithAuth().get(
          `/bar/unpaid_sales?bar_id=${selectedBar}` // 🔹 Updated path
        );

        console.log("SALES DATA 👉", res.data.results);

        setSales(res.data.results || []);
        setSummary({
          total_entries: res.data.total_entries || 0,
          total_due: res.data.total_due || 0,
        });
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };

    fetchSales();
  }, [selectedBar]);

  // ================= HANDLE PAYMENT =================
  const handlePayment = async (e) => {
    e.preventDefault();

    if (!selectedSale || !amountPaid || !paymentMethod) {
      setMessage("⚠️ Fill all required fields");
      setMessageType("warning");
      return;
    }

    try {
      await axiosWithAuth().post("/barpayment/", {
        bar_sale_id: selectedSale.bar_sale_id,
        amount_paid: parseFloat(amountPaid),
        payment_method: paymentMethod,
        bank: paymentMethod === "cash" ? null : bankId,
        note,
        date_paid: paymentDate, // ✅ must match backend schema
      });

      setMessage("✅ Payment successful");
      setMessageType("success");

      // Reset form
      setSelectedSale(null);
      setAmountPaid("");
      setPaymentMethod("");
      setBankId("");
      setNote("");
      setPaymentDate(new Date().toISOString().split("T")[0]); // reset to today

      // Refresh sales
      const res = await axiosWithAuth().get(
        `/bar/unpaid_sales?bar_id=${selectedBar}` // 🔹 Updated path
      );
      setSales(res.data.results || []);
      setSummary({
        total_entries: res.data.total_entries || 0,
        total_due: res.data.total_due || 0,
      });
    } catch (err) {
      console.error(err);
      setMessage("❌ Payment failed");
      setMessageType("error");
    }
  };

  // ================= UI =================
  return (
    <div className="bar-payment-container2">
      <h2>🍷 Bar Payments</h2>

      {/* SUMMARY */}
      {selectedBar && (
        <div className="summary-box">
          <p><strong>Total Entries:</strong> {summary.total_entries}</p>
          <p>
            <strong>Total Due:</strong>{" "}
            <span style={{ color: "red" }}>{formatAmount(summary.total_due)}</span>
          </p>
        </div>
      )}

      {/* BAR FILTER */}
      <select value={selectedBar} onChange={(e) => setSelectedBar(e.target.value)}>
        <option value="">-- Select Bar --</option>
        {bars.map((bar) => (
          <option key={bar.id} value={bar.id}>{bar.name}</option>
        ))}
      </select>

      {/* SALES TABLE */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="sales-table2">
          <thead>
            <tr>
              <th>Sale ID</th>
              <th>Date</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.bar_sale_id}>
                <td>{sale.bar_sale_id}</td>
                <td>{formatDate(sale.sale_date)}</td> {/* 🔹 Display date */}
                <td>{formatAmount(sale.sale_amount)}</td>
                <td>{formatAmount(sale.amount_paid)}</td>
                <td style={{ color: "red" }}>{formatAmount(sale.balance_due)}</td>
                <td>{sale.status}</td>
                <td>
                  <button onClick={() => setSelectedSale(sale)}>Pay</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* PAYMENT MODAL */}
      {selectedSale && (
        <div className="modal-overlay1">
          <div className="modal1">
            <h3>Payment - Sale #{selectedSale.bar_sale_id}</h3>

            <div className="payment-info">
              <p><strong>Total:</strong> {formatAmount(selectedSale.sale_amount)}</p>
              <p><strong>Paid:</strong> {formatAmount(selectedSale.amount_paid)}</p>
              <p><strong>Balance:</strong> {formatAmount(selectedSale.balance_due)}</p>
            </div>

            <label>Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                max={new Date().toISOString().split("T")[0]} // ❌ cannot go future
                onChange={(e) => setPaymentDate(e.target.value)}
              />



            <form onSubmit={handlePayment}>
              <label>Amount Paying</label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />

              <label>Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  if (e.target.value === "cash") setBankId("");
                }}
              >
                <option value="">-- Select --</option>
                <option value="cash">Cash</option>
                <option value="pos">POS</option>
                <option value="transfer">Transfer</option>
              </select>

              <label>Bank</label>
              <select
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                disabled={paymentMethod === "cash"}
              >
                <option value="">-- Select Bank --</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>

              <label>Note</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />

              <div className="modal-actions1">
                <button type="submit">Submit</button>
                <button type="button" onClick={() => setSelectedSale(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarPayment;
