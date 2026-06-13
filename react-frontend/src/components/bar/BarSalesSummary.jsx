// src/components/bar/BarSalesSummary.jsx

import React, {
  useEffect,
  useState,
  useRef,
} from "react";

import axiosWithAuth from "../../utils/axiosWithAuth";

import "./BarSalesSummary.css";

import {
  HOTEL_NAME,
} from "../../config/constants";

const BarSalesSummary = () => {
  const getToday = () =>
    new Date().toISOString().split("T")[0];

  const printRef = useRef();

  const [startDate, setStartDate] =
    useState(getToday());

  const [endDate, setEndDate] =
    useState(getToday());

  const [barId, setBarId] =
    useState("");

  const [bars, setBars] =
    useState([]);

  const [items, setItems] =
    useState([]);

  const [itemsSummary, setItemsSummary] =
    useState({});

  const [paymentSummary, setPaymentSummary] =
    useState({});

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  // ================= FORMAT =================
  const formatAmount = (value) =>
    Number(value || 0).toLocaleString(
      "en-NG"
    );

  // ================= FETCH BARS =================
  const fetchBars = async () => {
    try {
      const res =
        await axiosWithAuth().get(
          "/bar/bars/simple"
        );

      setBars(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // ================= FETCH SUMMARY =================
  const fetchSummary = async () => {
    setLoading(true);
    setError("");

    try {
      const params = {};

      if (barId)
        params.bar_id = barId;

      if (startDate)
        params.start_date = startDate;

      if (endDate)
        params.end_date = endDate;

      const res =
        await axiosWithAuth().get(
          "/bar/item-summary",
          { params }
        );

      setItems(res.data.items || []);

      setItemsSummary(
        res.data.items_summary || {}
      );

      setPaymentSummary(
        res.data.payment_summary || {}
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
          "Failed to fetch bar summary"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBars();
    fetchSummary();
  }, []);

  // ================= PRINT =================
  const handlePrint = () => {
    if (!printRef.current) return;

    const content =
      printRef.current.innerHTML;

    const win = window.open(
      "",
      "",
      "width=900,height=700"
    );

    win.document.write(`
      <html>
        <head>
          <title>Bar Sales Summary</title>

          <style>
            body {
              font-family: Arial;
              padding: 10px;
              font-size: 12px;
            }

            h1, h2 {
              text-align: center;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 10px;
              font-size: 12px;
            }

            th, td {
              border: 1px solid #000;
              padding: 6px;
              text-align: center;
            }

            th {
              background: #f0f2f5;
            }

            tbody tr:nth-child(odd) {
              background: #f7f7f7;
            }

            tbody tr:nth-child(even) {
              background: #dcf1c8;
            }

            .grand-total-row {
              font-weight: bold;
              border-top: 2px solid #000;
              background: #e0e0e0;
            }

            .summary-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
              gap: 6px;
              margin-bottom: 8px;
            }

            .card {
              background: #f1efef;
              border: 1px solid #797373;
              padding: 6px;
              text-align: center;
              border-radius: 6px;
              font-size: 13px;
            }

            .card span {
              color: #555;
              font-weight: 700;
              font-size: 12px;
            }

            .card h3 {
              margin-top: 3px;
              font-weight: 600;
              font-size: 13px;
            }

            .card.highlight {
              background: #eafaf0;
              border: 1px solid #28a745;
              font-weight: bold;
            }

            .bank-section {
              margin-top: 6px;
              font-size: 13px;
            }

            .bank-section h4 {
              margin-bottom: 4px;
              font-size: 14px;
            }

            .bank-line {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 4px 0;
              border-bottom: 1px dashed #ddd;
            }

            .bank-line span {
              white-space: nowrap;
              font-size: 13px;
            }
          </style>
        </head>

        <body>
          <h1>${HOTEL_NAME}</h1>

          <h2>
            🍷 Bar Sales Summary
            (${startDate} → ${endDate})
          </h2>

          ${content}
        </body>
      </html>
    `);

    win.document.close();
    win.print();
  };

  return (
    <div className="summary-report-page">
      <h2>🍷 Bar Sales Summary</h2>

      {/* FILTERS */}
      <div className="filter-bar">
        <select
          value={barId}
          onChange={(e) =>
            setBarId(e.target.value)
          }
        >
          <option value="">
            All Bars
          </option>

          {bars.map((bar) => (
            <option
              key={bar.id}
              value={bar.id}
            >
              {bar.name}
            </option>
          ))}
        </select>

        <label>Start Date:</label>

        <input
          type="date"
          value={startDate}
          onChange={(e) =>
            setStartDate(e.target.value)
          }
        />

        <label>End Date:</label>

        <input
          type="date"
          value={endDate}
          onChange={(e) =>
            setEndDate(e.target.value)
          }
        />

        <button
          className="print-btn"
          onClick={fetchSummary}
        >
          🔄 Load
        </button>

        <button
          className="print-btn"
          onClick={handlePrint}
        >
          🖨️ Print
        </button>
      </div>

      {loading && (
        <p>⏳ Loading report...</p>
      )}

      {error && (
        <p className="error">{error}</p>
      )}

      {!loading && (
        <div className="summary-scroll-container">
          <div ref={printRef}>

            {/* TABLE */}
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
                  {items.length > 0 ? (
                    items.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          {item.item}
                        </td>

                        <td>
                          {item.qty}
                        </td>

                        <td>
                          ₦
                          {formatAmount(
                            item.price
                          )}
                        </td>

                        <td>
                          ₦
                          {formatAmount(
                            item.amount
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4">
                        No sales found
                      </td>
                    </tr>
                  )}

                  <tr className="grand-total-row">
                    <td colSpan="3">
                      Total
                    </td>

                    <td>
                      ₦
                      {formatAmount(
                        itemsSummary.grand_total
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SUMMARY */}
            <div className="summary-grid">
              <div className="card">
                <span>Sales</span>

                <h3>
                  ₦
                  {formatAmount(
                    paymentSummary.total_sales
                  )}
                </h3>
              </div>

              <div className="card">
                <span>Paid</span>

                <h3>
                  ₦
                  {formatAmount(
                    paymentSummary.total_paid
                  )}
                </h3>
              </div>

              <div className="card">
                <span>Balance</span>

                <h3>
                  ₦
                  {formatAmount(
                    paymentSummary.total_due
                  )}
                </h3>
              </div>
            </div>

            {/* PAYMENT TYPES */}
            <div className="summary-grid">
              <div className="card highlight">
                <span>Cash</span>

                <h3>
                  ₦
                  {formatAmount(
                    paymentSummary.total_cash
                  )}
                </h3>
              </div>

              <div className="card">
                <span>POS</span>

                <h3>
                  ₦
                  {formatAmount(
                    paymentSummary.total_pos
                  )}
                </h3>
              </div>

              <div className="card">
                <span>Transfer</span>

                <h3>
                  ₦
                  {formatAmount(
                    paymentSummary.total_transfer
                  )}
                </h3>
              </div>
            </div>

            {/* BANK BREAKDOWN */}
            {paymentSummary.banks &&
              Object.keys(
                paymentSummary.banks
              ).length > 0 && (
                <div className="bank-section">
                  <h4>
                    🏦 Bank Breakdown
                  </h4>

                  {Object.entries(
                    paymentSummary.banks
                  ).map(
                    ([bank, data]) => (
                      <div
                        key={bank}
                        className="bank-line"
                      >
                        <span>
                          {bank}
                        </span>

                        <span>
                          POS: ₦
                          {formatAmount(
                            data.pos
                          )}
                        </span>

                        <span>
                          Transfer: ₦
                          {formatAmount(
                            data.transfer
                          )}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BarSalesSummary;