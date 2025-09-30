import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./StockBalance.css";

const StockBalance = () => {
  const [balances, setBalances] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
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
        <p>You do not have permission to view store stock balance.</p>
      </div>
    );
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    // Whenever category changes, fetch filtered balances
    fetchStockBalances(selectedCategory);
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get("/store/categories");
      setCategories(res.data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchStockBalances = async (categoryId = "") => {
    try {
      setLoading(true);
      const axios = axiosWithAuth();
      const url = categoryId
        ? `/store/balance-stock?category_id=${categoryId}`
        : `/store/balance-stock`;
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

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
  };

  const totalStockAmount = balances.reduce(
    (sum, item) => sum + (item.balance_total_amount || 0),
    0
  );

  if (loading) return <p>Loading...</p>;

  return (
    <div className="stock-balance-container">
      <div className="stock-balance-header">
        <h2>📊 Stock Balance Report</h2>

        <div className="filter-frame">
          <label htmlFor="categoryFilter">Filter by Category:</label>
          <select
            id="categoryFilter"
            value={selectedCategory}
            onChange={handleCategoryChange}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="total-stock">
          Total Stock Value:{" "}
          <strong>₦{totalStockAmount.toLocaleString()}</strong>
        </div>
      </div>

      {message && <div className="message">{message}</div>}

      <table>
        <thead>
          <tr>
            <th>Items</th>
            <th>Unit</th>
            <th>Category</th>
            <th>Total Received</th>
            <th>Total Issued</th>
            <th>Total Adjusted</th>
            <th>Balance</th>
            <th>Current Unit Price</th> {/* Updated column header */}
            <th>Balance Value</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((item, index) => (
            <tr
              key={item.item_id}
              className={index % 2 === 0 ? "even-row" : "odd-row"}
            >
              <td>{item.item_name}</td>
              <td>{item.unit}</td>
              <td>{item.category_name}</td>
              <td>{item.total_received}</td>
              <td>{item.total_issued}</td>
              <td>{item.total_adjusted}</td>
              <td>{item.balance}</td>
              <td>
                {item.current_unit_price
                  ? `₦${item.current_unit_price.toLocaleString()}`
                  : "-"}{" "}
                {/* Use current_unit_price */}
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

export default StockBalance;
