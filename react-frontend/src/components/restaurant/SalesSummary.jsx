// src/components/restaurant/SalesSummary.jsx

import React, { useEffect, useState, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./SalesSummary.css";

const SalesSummary = () => {
  const today = new Date().toISOString().split("T")[0];

  const printRef = useRef();

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [locationId, setLocationId] = useState("");
  const [locations, setLocations] = useState([]);

  const [itemSummary, setItemSummary] = useState([]);
  const [itemsSummary, setItemsSummary] = useState({});
  const [paymentSummary, setPaymentSummary] = useState({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const storedUser =
    JSON.parse(localStorage.getItem("user")) || {};

  let roles = [];

  if (Array.isArray(storedUser.roles)) {
    roles = storedUser.roles;
  } else if (typeof storedUser.role === "string") {
    roles = [storedUser.role];
  }

  roles = roles.map((r) => r.toLowerCase());

  const businessName =
    storedUser.business?.name || "HEMS Hotel";

  if (
    !(
      roles.includes("admin") ||
      roles.includes("restaurant")
    )
  ) {
    return (
      <div className="unauthorized">
        🚫 Access Denied
      </div>
    );
  }

  // =========================
  // FORMAT
  // =========================
  const formatAmount = (value) =>
    Number(value || 0).toLocaleString("en-NG");

  // =========================
  // FETCH LOCATIONS
  // =========================
  const fetchLocations = async () => {
    try {
      const res = await axiosWithAuth().get(
        "/restaurant/locations"
      );

      setLocations(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // =========================
  // FETCH SUMMARY
  // =========================
  const fetchSummary = async () => {
    setLoading(true);
    setError("");

    try {
      const params = {};

      if (locationId) {
        params.location_id = locationId;
      }

      if (startDate) {
        params.start_date = startDate;
      }

      if (endDate) {
        params.end_date = endDate;
      }

      const res = await axiosWithAuth().get(
        "/restaurant/sales/items-summary",
        { params }
      );

      setItemSummary(res.data.items || []);

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
          "Failed to fetch restaurant summary"
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // PRINT
  // =========================
  const handlePrint = () => {
    if (!printRef.current) return;

    const content = printRef.current.innerHTML;

    const win = window.open(
      "",
      "",
      "width=900,height=700"
    );

    win.document.write(`
      <html>
        <head>
          <title>Restaurant Sales Summary</title>

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

            .restaurant-grand-total-row {
              font-weight: bold;
              border-top: 2px solid #000;
              background: #e0e0e0;
            }

            .restaurant-summary-grid {
              display: grid;
              grid-template-columns:
                repeat(auto-fit, minmax(110px, 1fr));
              gap: 6px;
              margin-bottom: 8px;
            }

            .restaurant-card {
              background: #f1efef;
              border: 1px solid #797373;
              padding: 6px;
              text-align: center;
              border-radius: 6px;
              font-size: 13px;
            }

            .restaurant-card span {
              color: #555;
              font-weight: 700;
              font-size: 12px;
            }

            .restaurant-card h3 {
              margin-top: 3px;
              font-weight: 600;
              font-size: 13px;
            }

            .restaurant-card.highlight {
              background: #eafaf0;
              border: 1px solid #28a745;
              font-weight: bold;
            }

            .restaurant-bank-section {
              margin-top: 6px;
              font-size: 13px;
            }

            .restaurant-bank-section h4 {
              margin-bottom: 4px;
              font-size: 14px;
            }

            .restaurant-bank-line {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 4px 0;
              border-bottom: 1px dashed #ddd;
            }

            .restaurant-bank-line span {
              white-space: nowrap;
              font-size: 13px;
            }
          </style>
        </head>

        <body>
          <h1>${businessName}</h1>

          <h2>
            📊 Restaurant Sales Summary
            (${startDate} → ${endDate})
          </h2>

          ${content}
        </body>
      </html>
    `);

    win.document.close();
    win.print();
  };

  // =========================
  // INIT
  // =========================
  useEffect(() => {
    fetchLocations();
    fetchSummary();
  }, []);

  // =========================
  // AUTO RELOAD
  // =========================
  useEffect(() => {
    fetchSummary();
  }, [locationId, startDate, endDate]);

  // =========================
  // UI
  // =========================
  return (
    <div className="restaurant-summary-page">
      <h2>📊 Restaurant Sales Summary</h2>

      {/* FILTERS */}
      <div className="restaurant-filter-bar">
        <select
          value={locationId}
          onChange={(e) =>
            setLocationId(e.target.value)
          }
        >
          <option value="">
            All Locations
          </option>

          {locations.map((loc) => (
            <option
              key={loc.id}
              value={loc.id}
            >
              {loc.name}
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
          className="restaurant-print-btn"
          onClick={fetchSummary}
        >
          🔄 Load
        </button>

        <button
          className="restaurant-print-btn"
          onClick={handlePrint}
        >
          🖨️ Print
        </button>
      </div>

      {loading && (
        <p>⏳ Loading report...</p>
      )}

      {error && (
        <p className="restaurant-error">
          {error}
        </p>
      )}

      {!loading && (
        <div className="restaurant-summary-scroll-container">
          <div ref={printRef}>
            {/* TABLE */}
            <div className="restaurant-summary-table-container">
              <table className="restaurant-summary-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {itemSummary.length > 0 ? (
                    itemSummary.map(
                      (item, idx) => (
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
                      )
                    )
                  ) : (
                    <tr>
                      <td colSpan="4">
                        No restaurant sales found
                      </td>
                    </tr>
                  )}

                  <tr className="restaurant-grand-total-row">
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

            {/* TOP SUMMARY */}
            <div className="restaurant-summary-grid">
              <div className="restaurant-card">
                <span>Sales</span>

                <h3>
                  ₦
                  {formatAmount(
                    paymentSummary.total_sales
                  )}
                </h3>
              </div>

              <div className="restaurant-card highlight">
                <span>Paid</span>

                <h3>
                  ₦
                  {formatAmount(
                    paymentSummary.total_paid
                  )}
                </h3>
              </div>

              <div className="restaurant-card">
                <span>Balance</span>

                <h3>
                  ₦
                  {formatAmount(
                    paymentSummary.total_due
                  )}
                </h3>
              </div>
            </div>

            {/* PAYMENT SUMMARY */}
            <div className="restaurant-summary-grid">
              <div className="restaurant-card highlight">
                <span>Cash</span>

                <h3>
                  ₦
                  {formatAmount(
                    paymentSummary.total_cash
                  )}
                </h3>
              </div>

              <div className="restaurant-card">
                <span>POS</span>

                <h3>
                  ₦
                  {formatAmount(
                    paymentSummary.total_pos
                  )}
                </h3>
              </div>

              <div className="restaurant-card">
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
                <div className="restaurant-bank-section">
                  <h4>
                    🏦 Bank Breakdown
                  </h4>

                  {Object.entries(
                    paymentSummary.banks
                  ).map(
                    ([bank, data]) => (
                      <div
                        key={bank}
                        className="restaurant-bank-line"
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

export default SalesSummary;