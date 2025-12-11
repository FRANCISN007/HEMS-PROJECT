import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./BarBalanceStock.css";

const BarBalanceStock = () => {
  const [balances, setBalances] = useState([]);
  const [bars, setBars] = useState([]);
  const [selectedBar, setSelectedBar] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];

  if (Array.isArray(storedUser.roles)) {
    roles = storedUser.roles;
  } else if (typeof storedUser.role === "string") {
    roles = [storedUser.role];
  }
  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("store"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to view bar stock.</p>
      </div>
    );
  }

  // Load bars on mount
  useEffect(() => {
    fetchBars();
  }, []);

  // Load balances when bar changes
  useEffect(() => {
    fetchStockBalances(selectedBar);
  }, [selectedBar]);

  const fetchBars = async () => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get("/bar/bars/simple");
      setBars(res.data || []);
    } catch (error) {
      console.error("Error fetching bars:", error);
    }
  };

  const fetchStockBalances = async (barId = "") => {
    try {
      setLoading(true);
      const axios = axiosWithAuth();

      let url = `/store/bar-balance-stock?`;
      if (barId) url += `bar_id=${barId}`;

      const res = await axios.get(url);
      setBalances(res.data || []);
    } catch (error) {
      console.error("Error fetching stock balances:", error);
      setMessage("❌ Failed to load stock balances");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleBarChange = (e) => setSelectedBar(e.target.value);

  const totalStockAmount = balances.reduce(
    (sum, item) => sum + (item.balance_total_amount || 0),
    0
  );

  const totalStockBalance = balances.reduce(
    (sum, item) => sum + (item.balance || 0),
    0
  );

  if (loading) return <p>Loading...</p>;

  return (
    <div className="stock-balance-container">
      <div className="stock-balance-header">
        <h2>📊 Bar Stock Balance Report.</h2>

        <div className="filter-frame">
          {/* 🔥 ONLY BAR FILTER REMAINS */}
          <div className="filter-group">
            <label htmlFor="barFilter">Bar:</label>
            <select
              id="barFilter"
              value={selectedBar}
              onChange={handleBarChange}
            >
              <option value="">All Bars</option>
              {bars.map((bar) => (
                <option key={bar.id} value={bar.id}>
                  {bar.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="total-stock">
          <div>
            Total Stock Value:{" "}
            <strong>₦{totalStockAmount.toLocaleString()}</strong>
          </div>
          <div>
            Stock Balance (Quantity):{" "}
            <strong>{totalStockBalance.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {message && <div className="message">{message}</div>}

      <table>
        <thead>
          <tr>
            <th>Bar</th>
            <th>Item</th>
            <th>Unit</th>
            <th>Category</th>
            <th>Item Type</th>
            <th>Total Received</th>
            <th>Total Sold</th>
            <th>Total Adjusted</th>
            <th>Balance</th>
            <th>Current Unit Price</th>
            <th>Balance Value</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((item, index) => (
            <tr
              key={`${item.item_id}-${item.bar_id}`}
              className={index % 2 === 0 ? "even-row" : "odd-row"}
            >
              <td>{item.bar_name}</td>
              <td>{item.item_name}</td>
              <td>{item.unit}</td>
              <td>{item.category_name}</td>
              <td>{item.item_type}</td>
              <td>{item.total_received}</td>
              <td>{item.total_sold}</td>
              <td>{item.total_adjusted}</td>
              <td>{item.balance}</td>
              <td>
                {item.last_unit_price
                  ? `₦${item.last_unit_price.toLocaleString()}`
                  : "-"}
              </td>
              <td>
                {item.balance_total_amount
                  ? `₦${item.balance_total_amount.toLocaleString()}`
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BarBalanceStock;


