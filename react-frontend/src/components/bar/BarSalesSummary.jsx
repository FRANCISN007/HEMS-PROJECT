// src/components/bar/BarSalesSummary.jsx
import React, { useEffect, useState, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./BarSalesSummary.css";

const BarSalesSummary = () => {
  const getToday = () => new Date().toISOString().split("T")[0];
  const printRef = useRef();

  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());
  const [barId, setBarId] = useState("");
  const [bars, setBars] = useState([]);

  const [items, setItems] = useState([]);
  const [itemsSummary, setItemsSummary] = useState({});
  const [paymentSummary, setPaymentSummary] = useState({});
  const [loading, setLoading] = useState(false);

  // Get business name from login response (user.business.name)
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const businessName = user.business?.name || "HEMS Hotel";

  // ================= FORMAT =================
  const formatAmount = (value) => {
    return new Intl.NumberFormat("en-NG").format(Number(value || 0));
  };

  // ================= FETCH BARS =================
  const fetchBars = async () => {
    try {
      const res = await axiosWithAuth().get("/bar/bars/simple");
      setBars(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // ================= FETCH SUMMARY =================
  const fetchSummary = async () => {
    setLoading(true);

    try {
      const params = {};
      if (barId) params.bar_id = barId;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await axiosWithAuth().get("/bar/item-summary", { params });

      setItems(res.data.items || []);
      setItemsSummary(res.data.items_summary || {});
      setPaymentSummary(res.data.payment_summary || {});
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchBars();
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [barId, startDate, endDate]);

  // ================= PRINT =================
  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open("", "", "width=900,height=700");

    win.document.write(`
      <html>
        <head>
          <title>Bar Sales Summary</title>
          <style>
            body { font-family: Arial; padding: 10px; font-size: 12px; }
            h1, h2, h4 { text-align: center; }

            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th, td { border: 1px solid #000; padding: 5px; text-align: center; }
            th { background: #eee; }

            .grand-total-row {
              font-weight: bold;
              border-top: 3px solid #000;
              background: #f0f0f0;
            }

            .summary-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8px;
              margin-bottom: 8px;
            }

            .card {
              border: 1px solid #000;
              padding: 6px;
              text-align: center;
            }

            .highlight {
              background: #eafaf0;
              border: 1px solid #28a745;
            }

            .bank-line {
              display: grid;
              grid-template-columns: 120px 1fr 1fr;
              gap: 10px;
            }
          </style>
        </head>
        <body>
          <h1>${businessName}</h1>
          <h2>🍷 Bar Sales Summary</h2>
          ${content}
        </body>
      </html>
    `);

    win.document.close();
    win.print();
  };

  return (
    <div className="sales-summary-page">
      <h2>🍷 Bar Sales Summary</h2>

      {/* ================= FILTERS ================= */}
      <div className="filter-bar">
        <select value={barId} onChange={(e) => setBarId(e.target.value)}>
          <option value="">All Bars</option>
          {bars.map((bar) => (
            <option key={bar.id} value={bar.id}>
              {bar.name}
            </option>
          ))}
        </select>

        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

        <button className="print-btn" onClick={handlePrint}>
          🖨️ Print
        </button>
      </div>

      {loading ? <p>Loading...</p> : (
        <div ref={printRef}>
          {/* ================= ITEMS TABLE ================= */}
          <div className="summary-table-container">
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.item}</td>
                    <td>{item.qty}</td>
                    <td>₦{formatAmount(item.price)}</td>
                    <td>₦{formatAmount(item.amount)}</td>
                  </tr>
                ))}

                <tr className="grand-total-row">
                  <td colSpan="3">Total</td>
                  <td>₦{formatAmount(itemsSummary.grand_total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ================= SUMMARY ================= */}
          <div className="summary-grid">
            <div className="card">
              <span>Sales</span>
              <h3>₦{formatAmount(paymentSummary.total_sales)}</h3>
            </div>

            <div className="card">
              <span>Paid</span>
              <h3>₦{formatAmount(paymentSummary.total_paid)}</h3>
            </div>

            <div className="card">
              <span>Balance</span>
              <h3>₦{formatAmount(paymentSummary.total_due)}</h3>
            </div>
          </div>

          {/* ================= PAYMENT TYPES ================= */}
          <div className="summary-grid">
            <div className="card highlight">
              <span>Cash</span>
              <h3>₦{formatAmount(paymentSummary.total_cash)}</h3>
            </div>

            <div className="card">
              <span>POS</span>
              <h3>₦{formatAmount(paymentSummary.total_pos)}</h3>
            </div>

            <div className="card">
              <span>Transfer</span>
              <h3>₦{formatAmount(paymentSummary.total_transfer)}</h3>
            </div>
          </div>

          {/* ================= BANK ================= */}
          <div className="bank-section">
            <h4>🏦 Bank Breakdown</h4>

            {paymentSummary.banks &&
              Object.entries(paymentSummary.banks).map(([bank, data]) => (
                <div key={bank} className="bank-line">
                  <span>{bank}</span>
                  <span>POS: ₦{formatAmount(data.pos)}</span>
                  <span>Transfer: ₦{formatAmount(data.transfer)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BarSalesSummary;