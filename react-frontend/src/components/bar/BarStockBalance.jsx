import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./BarStockBalance.css";

const BarStockBalance = () => {
  const [stockData, setStockData] = useState([]);
  const [bars, setBars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Filters
  const [barFilter, setBarFilter] = useState(""); // stores bar ID
  const [itemFilter, setItemFilter] = useState("");

  const user = JSON.parse(localStorage.getItem("user")) || {};
  const roles = user.roles || [];

  if (!(roles.includes("admin") || roles.includes("bar"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to view bar stock balance.</p>
      </div>
    );
  }

  // Fetch bars for dropdown
  useEffect(() => {
    const fetchBars = async () => {
      try {
        const res = await axiosWithAuth().get("/bar/bars/simple");
        setBars(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("❌ Failed to fetch bars:", err);
        setBars([]);
      }
    };
    fetchBars();
  }, []);

  // Fetch stock balance
  useEffect(() => {
    fetchStockBalance();
  }, []);

  const fetchStockBalance = async () => {
    try {
      setLoading(true);
      const axios = axiosWithAuth();
      const res = await axios.get("/bar/stock-balance");
      setStockData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("❌ Failed to fetch bar stock balance:", err);
      setMessage("❌ Failed to load stock balance.");
      setStockData([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter by bar ID and item name
  const filteredData = stockData.filter((item) => {
    const matchesBar = barFilter ? item.bar_id === parseInt(barFilter) : true;
    const matchesItem = itemFilter
      ? item.item_name?.toLowerCase().includes(itemFilter.toLowerCase())
      : true;
    return matchesBar && matchesItem;
  });

  // Auto-clear messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (loading) return <p className="bar-message">⏳ Loading stock balance...</p>;

  return (
    <div className="bar-container">
      <div className="bar-header">
        <h2>📊 Bar Stock Balance</h2>
      </div>

      <div className="filter-controls" style={{ marginBottom: "15px", display: "flex", gap: "10px" }}>
        <select
          value={barFilter}
          onChange={(e) => setBarFilter(e.target.value)}
          className="filter-input"
        >
          <option value="">-- All Bars --</option>
          {bars.map((bar) => (
            <option key={bar.id} value={bar.id}>
              {bar.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Filter by Item Name..."
          value={itemFilter}
          onChange={(e) => setItemFilter(e.target.value)}
          className="filter-input"
        />
      </div>

      <div className="table-wrapper">
        <table className="bar-table">
          <thead>
            <tr>
              <th>Bar Name</th>
              <th>Item Name</th>
              <th>Total Received</th>
              <th>Total Sold</th>
              <th>Total Adjusted</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? "even-row" : "odd-row"}>
                  <td>{item.bar_name || "—"}</td>
                  <td>{item.item_name}</td>
                  <td>{item.total_received}</td>
                  <td>{item.total_sold}</td>
                  <td>{item.total_adjusted}</td>
                  <td className={item.balance < 0 ? "negative" : "positive"}>
                    {item.balance}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="no-data">
                  No stock balance data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {message && <p className="bar-message">{message}</p>}
    </div>
  );
};

export default BarStockBalance;
