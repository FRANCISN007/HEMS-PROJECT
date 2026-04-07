import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./StockBalance.css";

const StockBalance = () => {
  const [balances, setBalances] = useState([]);
  const [categories, setCategories] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedItemType, setSelectedItemType] = useState("");

  const [search, setSearch] = useState("");          // ✅ NEW (typing search)
  const [selectedItemId, setSelectedItemId] = useState(""); // ✅ NEW (exact item)

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const axios = axiosWithAuth();

  /* ================= AUTH ================= */
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = Array.isArray(storedUser.roles)
    ? storedUser.roles
    : storedUser.role
    ? [storedUser.role]
    : [];

  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("store"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to view store stock balance.</p>
      </div>
    );
  }

  /* ================= FETCH ================= */
  useEffect(() => {
    fetchCategories();
  }, []);

  // ✅ debounce all filters
  useEffect(() => {
    const delay = setTimeout(() => {
      fetchStockBalances();
    }, 300);

    return () => clearTimeout(delay);
  }, [selectedCategory, selectedItemType, search, selectedItemId]);

  const fetchCategories = async () => {
    try {
      const res = await axios.get("/store/categories");
      setCategories(res.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchStockBalances = async () => {
    try {
      setLoading(true);

      const res = await axios.get("/store/balance-stock", {
        params: {
          category_id: selectedCategory || undefined,
          item_type: selectedItemType || undefined,
          item_id: selectedItemId || undefined,
          search: search || undefined,
        },
      });

      setBalances(res.data || []);
    } catch (error) {
      console.error(error);
      setMessage("❌ Failed to load stock balances");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  /* ================= TOTAL ================= */
  const totalStockAmount = balances.reduce(
    (sum, item) => sum + (item.balance_total_amount || 0),
    0
  );

  /* ================= UI ================= */
  return (
    <div className="stock-balance-container3">
    <div className="stock-balance-header">
      <h2>📊 Stock Balance Report</h2>

      <div className="filter-frame3">
        {/* CATEGORY */}
        <div className="filter-group3 category-filter">
          <label>Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* ITEM TYPE */}
        <div className="filter-group3 type-filter">
          <label>Type</label>
          <select
            value={selectedItemType}
            onChange={(e) => setSelectedItemType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="Store">Store</option>
            <option value="Kitchen">Kitchen</option>
            <option value="Bar">Bar</option>
            <option value="Restaurant">Restaurant</option>
          </select>
        </div>

        {/* SEARCH INPUT */}
        <div className="filter-group3 search-filter">
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

        {/* ITEM DROPDOWN */}
        <div className="filter-group3 item-filter">
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

      <div className="total-stock3">
        Total: <strong>₦{totalStockAmount.toLocaleString()}</strong>
      </div>
    </div>

    {message && <div className="message">{message}</div>}

    {loading ? (
      <p>Loading...</p>
    ) : (
      <table>
        <thead>
          <tr>
            <th>Items</th>
            <th>Unit</th>
            <th>Category</th>
            <th>Type</th>
            <th>Received</th>
            <th>Issued</th>
            <th>Adjusted</th>
            <th>Balance</th>
            <th>Unit Price</th>
            <th>Value</th>
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
              <td>{item.item_type}</td>
              <td>{item.total_received}</td>
              <td>{item.total_issued}</td>
              <td>{item.total_adjusted}</td>
              <td>{item.balance}</td>
              <td>
                {item.current_unit_price
                  ? `₦${item.current_unit_price.toLocaleString()}`
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
    )}
  </div>

  );
};

export default StockBalance;
