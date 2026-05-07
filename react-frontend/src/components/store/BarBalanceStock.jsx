import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./BarBalanceStock.css";

const BarBalanceStock = () => {
  const [balances, setBalances] = useState([]);
  const [bars, setBars] = useState([]);
  const [selectedBar, setSelectedBar] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const axios = axiosWithAuth();

  // -----------------------------
  // ROLE CHECK
  // -----------------------------
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];
  if (Array.isArray(storedUser.roles)) roles = storedUser.roles;
  else if (storedUser.role) roles = [storedUser.role];
  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("store"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to view bar stock.</p>
      </div>
    );
  }

  // -----------------------------
  // FETCH BARS
  // -----------------------------
  useEffect(() => {
    const fetchBars = async () => {
      try {
        const res = await axios.get("/bar/bars/simple");
        setBars(res.data || []);
      } catch (err) {
        console.error("Failed to fetch bars:", err);
      }
    };
    fetchBars();
  }, []);

  // -----------------------------
  // FETCH BALANCES
  // -----------------------------
  useEffect(() => {
    const delay = setTimeout(() => {
      fetchStockBalances();
    }, 300);
    return () => clearTimeout(delay);
  }, [selectedBar, startDate, endDate, search, selectedItemId]);

  const fetchStockBalances = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedBar) params.append("bar_id", selectedBar);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (selectedItemId) params.append("item_id", selectedItemId);
      if (search) params.append("search", search);

      const res = await axios.get(`/store/bar-balance-stock?${params.toString()}`);
      setBalances(res.data || []);
    } catch (err) {
      console.error("Failed to fetch balances:", err);
      setMessage("❌ Failed to load stock balances");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // TOTALS
  // -----------------------------
  const totalStockAmount = balances.reduce(
    (sum, item) => sum + (item.balance_total_amount || 0),
    0
  );
  const totalStockBalance = balances.reduce((sum, item) => sum + (item.balance || 0), 0);

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <div className="stock-balance-container1">
      <div className="stock-balance-header">
        <h2>📊 Bar Stock Balance Report</h2>

        <div className="filter-frame1">
          {/* Bar */}
          <div className="filter-group1 bar-filter">
            <label>Bar</label>
            <select value={selectedBar} onChange={(e) => setSelectedBar(e.target.value)}>
              <option value="">All Bars</option>
              {bars.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="filter-group1">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* End Date */}
          <div className="filter-group1">
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Search */}
          <div className="filter-group1 search-filter">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search item..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedItemId("");
              }}
            />
          </div>

          {/* Item */}
          <div className="filter-group1 item-filter">
            <label>Item</label>
            <select
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                setSearch("");
              }}
            >
              <option value="">All Items</option>
              {balances.map((item) => (
                <option key={item.item_id} value={item.item_id}>
                  {item.item_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="total-stock1">
          <div>Total Stock Value: <strong>₦{totalStockAmount.toLocaleString()}</strong></div>
          <div>Stock Balance: <strong>{totalStockBalance.toLocaleString()}</strong></div>
        </div>
      </div>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="table-scroll-container">
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
                <th>Unit Price</th>
                <th>Balance Value</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((item, idx) => (
                <tr
                  key={`${item.bar_id}-${item.item_id}`}
                  className={idx % 2 === 0 ? "even-row" : "odd-row"}
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
                    {item.last_unit_price ? `₦${item.last_unit_price.toLocaleString()}` : "-"}
                  </td>
                  <td>
                    {item.balance_total_amount ? `₦${item.balance_total_amount.toLocaleString()}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BarBalanceStock;