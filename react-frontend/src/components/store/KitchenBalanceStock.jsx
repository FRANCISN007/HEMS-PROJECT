import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./KitchenBalanceStock.css";

const KitchenBalanceStock = () => {
  const [balances, setBalances] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [selectedKitchen, setSelectedKitchen] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // -----------------------------
  // ROLE CHECK
  // -----------------------------
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
        <p>You do not have permission to view kitchen stock.</p>
      </div>
    );
  }

  // -----------------------------
  // Load Kitchens
  // -----------------------------
  useEffect(() => {
    fetchKitchens();
  }, []);

  const fetchKitchens = async () => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get("/kitchen/simple");
      setKitchens(res.data || []);
    } catch (error) {
      console.error("Error fetching kitchens:", error);
      setKitchens([]);
    }
  };

  // -----------------------------
  // Load Stock Balances
  // -----------------------------
  useEffect(() => {
    fetchStockBalances(selectedKitchen);
  }, [selectedKitchen]);

  const fetchStockBalances = async (kitchenId = "") => {
    try {
      setLoading(true);
      const axios = axiosWithAuth();

      let url = `/store/kitchen-balance-stock`;
      if (kitchenId) url += `?kitchen_id=${kitchenId}`;

      const res = await axios.get(url);
      setBalances(res.data || []);
    } catch (error) {
      console.error("Error fetching kitchen balances:", error);
      setMessage("❌ Failed to load kitchen stock balances");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleKitchenChange = (e) => setSelectedKitchen(e.target.value);

  // -----------------------------
  // TOTALS (backend-driven)
  // -----------------------------
  const totalStockAmount = balances.reduce(
    (sum, row) => sum + (row.balance_total_amount || 0),
    0
  );

  const totalStockBalance = balances.reduce(
    (sum, row) => sum + (row.balance || 0),
    0
  );

  if (loading) return <p>Loading...</p>;

  return (
    <div className="stock-balance-container">
      <div className="stock-balance-header">
        <h2>👨‍🍳 Kitchen Stock Balance Report.</h2>

        <div className="filter-frame">
          <div className="filter-group">
            <label>Kitchen:</label>
            <select value={selectedKitchen} onChange={handleKitchenChange}>
              <option value="">All Kitchens</option>
              {kitchens.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
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
            <th>Kitchen</th>
            <th>Item</th>
            <th>Unit</th>
            <th>Category</th>
            <th>Item Type</th>
            <th>Total Received</th>
            <th>Qty Sold</th>
            <th>Adjusted</th>
            <th>Balance</th>
            <th>Unit Price</th>
            <th>Balance Value</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((row, index) => (
            <tr
              key={`${row.kitchen_id}-${row.item_id}`}
              className={index % 2 === 0 ? "even-row" : "odd-row"}
            >
              <td>{row.kitchen_name}</td>
              <td>{row.item_name}</td>
              <td>{row.unit}</td>
              <td>{row.category_name}</td>
              <td>{row.item_type}</td>
              <td>{row.total_issued}</td>
              <td>{row.total_used}</td>
              <td>{row.total_adjusted}</td>
              <td>
                <strong>{row.balance}</strong>
              </td>
              <td>
                {row.last_unit_price
                  ? `₦${row.last_unit_price.toLocaleString()}`
                  : "-"}
              </td>
              <td>
                {row.balance_total_amount
                  ? `₦${row.balance_total_amount.toLocaleString()}`
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default KitchenBalanceStock;
