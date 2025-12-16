import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./KitchenStock.css";

const KitchenStock = () => {
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

  if (!(roles.includes("admin") || roles.includes("restaurant"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to view kitchen stock.</p>
      </div>
    );
  }

  // -----------------------------
  // Load data on mount
  // -----------------------------
  useEffect(() => {
    fetchKitchens();
  }, []);

  useEffect(() => {
    fetchStockBalances(selectedKitchen);
  }, [selectedKitchen]);

  // -----------------------------
  // Fetch Kitchens
  // -----------------------------
  const fetchKitchens = async () => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get("/restaurant/kitchens/simple");

      setKitchens(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error fetching kitchens:", error);
      setKitchens([]);
    }
  };

  // -----------------------------
  // Fetch Kitchen Stock
  // -----------------------------
  const fetchStockBalances = async (kitchenId = "") => {
    try {
      setLoading(true);
      const axios = axiosWithAuth();

      let url = `/store/kitchen-balance-stock?`;
      if (kitchenId) url += `kitchen_id=${kitchenId}`;

      const res = await axios.get(url);

      // 🔥 PROTECT AGAINST NON-ARRAY RESPONSE
      if (Array.isArray(res.data)) {
        setBalances(res.data);
      } else {
        console.warn("Backend did NOT return array:", res.data);
        setBalances([]);
      }
    } catch (error) {
      console.error("Error fetching kitchen balances:", error);

      // Handle unauthorized
      if (error?.response?.status === 401) {
        setMessage("⚠️ Unauthorized. Please log in again.");
      } else {
        setMessage("❌ Failed to load kitchen stock balances.");
      }
      setTimeout(() => setMessage(""), 3000);

      setBalances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKitchenChange = (e) => {
    setSelectedKitchen(e.target.value);
  };

  // -----------------------------
  // Calculations
  // -----------------------------
  const totalStockAmount = Array.isArray(balances)
    ? balances.reduce(
        (sum, item) => sum + (item.balance_total_amount || 0),
        0
      )
    : 0;

  const totalStockBalance = Array.isArray(balances)
    ? balances.reduce((sum, item) => sum + (item.balance || 0), 0)
    : 0;

  if (loading) return <p>Loading...</p>;

  return (
    <div className="stock-balance-container">
      <div className="stock-balance-header">
        <h2>👨‍🍳 Kitchen Stock Balance Report</h2>

        <div className="filter-frame">
          <div className="filter-group">
            <label htmlFor="kitchenFilter">Kitchen:</label>
            <select
              id="kitchenFilter"
              value={selectedKitchen}
              onChange={handleKitchenChange}
            >
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
            <th>Total Issued</th>
            <th>Qty Sold</th>
            <th>Balance</th>
            <th>Unit Price</th>
            <th>Balance Value</th>
          </tr>
        </thead>

        <tbody>
          {Array.isArray(balances) && balances.length > 0 ? (
            balances.map((item, index) => (
              <tr
                key={`${item.item_id}-${item.kitchen_id}`}
                className={index % 2 === 0 ? "even-row" : "odd-row"}
              >
                <td>{item.kitchen_name}</td>
                <td>{item.item_name}</td>
                <td>{item.unit}</td>
                <td>{item.category_name}</td>
                <td>{item.item_type}</td>
                <td>{item.total_issued}</td>
                <td>{item.total_used}</td>
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
            ))
          ) : (
            <tr>
              <td colSpan="9" style={{ textAlign: "center", padding: "20px" }}>
                No stock records available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default KitchenStock;
