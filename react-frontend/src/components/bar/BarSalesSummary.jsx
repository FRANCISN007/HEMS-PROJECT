// src/components/bar/BarSalesSummary.jsx
import React, { useEffect, useState, useCallback } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./BarSalesSummary.css";

const BarSalesSummary = () => {
  const [summary, setSummary] = useState([]);
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [grandTotal, setGrandTotal] = useState(0);

  const [barId, setBarId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ✅ Fetch sales summary (memoized to avoid ESLint warning)
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {};
      if (barId) params.bar_id = barId;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await axiosWithAuth().get("/bar/item-summary", { params });

      const items = res.data.items || [];
      setSummary(items);
      setGrandTotal(res.data.grand_total || 0);
    } catch (err) {
      console.error("❌ Fetch error:", err);
      setError("❌ Failed to fetch bar sales summary.");
    } finally {
      setLoading(false);
    }
  }, [barId, startDate, endDate]);

  // ✅ Fetch list of bars once
  const fetchBars = useCallback(async () => {
    try {
      const res = await axiosWithAuth().get("/bar/bars/simple");
      setBars(res.data || []);
    } catch (err) {
      console.error("❌ Failed to fetch bars:", err);
    }
  }, []);

  // ✅ Initial fetch
  useEffect(() => {
    fetchBars();
    fetchSummary();
  }, [fetchBars, fetchSummary]);

  return (
    <div className="bar-sales-summary">
      <h2>🍷 Bar Item Sales Summary</h2>

      {/* Filters */}
      <div className="filters">
        <label>Bar:</label>
        <select value={barId} onChange={(e) => setBarId(e.target.value)}>
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

        <button onClick={fetchSummary} className="refresh-btn">
          🔍 Apply
        </button>
      </div>

      {/* Loading and Error */}
      {loading && <p>Loading sales summary...</p>}
      {error && <p className="error">{error}</p>}

      {/* Table */}
      {!loading && !error && summary.length > 0 && (
        <table className="summary-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity Sold</th>
              <th>Selling Price</th>
              <th>Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row, idx) => (
              <tr
                key={row.item_id}
                className={idx % 2 === 0 ? "even" : "odd"}
              >
                <td>{row.item_name}</td>
                <td>{row.total_quantity}</td>
                <td>₦{Number(row.selling_price).toLocaleString()}</td>
                <td>₦{Number(row.total_amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan="3">GRAND TOTAL</td>
              <td>₦{Number(grandTotal).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      )}

      {/* Empty state */}
      {!loading && !error && summary.length === 0 && (
        <p>No sales summary available.</p>
      )}
    </div>
  );
};

export default BarSalesSummary;
