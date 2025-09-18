import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./BarBalanceStock.css";

const BarBalanceStock = () => {
  const [balances, setBalances] = useState([]);
  const [categories, setCategories] = useState([]);
  const [bars, setBars] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBar, setSelectedBar] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchCategories();
    fetchBars();
  }, []);

  useEffect(() => {
    // Whenever category or bar changes, fetch filtered balances
    fetchStockBalances(selectedCategory, selectedBar);
  }, [selectedCategory, selectedBar]);

  const fetchCategories = async () => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get("/store/categories");
      setCategories(res.data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchBars = async () => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get("/bar/bars/simple");
      setBars(res.data || []);
    } catch (error) {
      console.error("Error fetching bars:", error);
    }
  };

  const fetchStockBalances = async (categoryId = "", barId = "") => {
    try {
      setLoading(true);
      const axios = axiosWithAuth();

      let url = `/store/bar-balance-stock?`;
      if (categoryId) url += `category_id=${categoryId}&`;
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

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
  };

  const handleBarChange = (e) => {
    setSelectedBar(e.target.value);
  };

  const totalStockAmount = balances.reduce(
    (sum, item) => sum + (item.balance_total_amount || 0),
    0
  );

  if (loading) return <p>Loading...</p>;

  return (
    <div className="stock-balance-container">
      <div className="stock-balance-header">
        <h2>📊 Bar Stock Balance Report</h2>

        <div className="filter-frame">
          <div className="filter-group">
            <label htmlFor="categoryFilter">Category:</label>
            <select
              id="categoryFilter"
              value={selectedCategory}
              onChange={handleCategoryChange}
            >
              <option value="">All</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

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
          Total Stock Value:{" "}
          <strong>₦{totalStockAmount.toLocaleString()}</strong>
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
            <th>Total Received</th>
            <th>Total Sold</th>
            <th>Total Adjusted</th>
            <th>Balance</th>
            <th>Last Unit Price</th>
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
