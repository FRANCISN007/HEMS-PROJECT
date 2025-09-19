import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./StockAdjustment.css";

const StockAdjustment = () => {
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState("");
  const [quantityAdjusted, setQuantityAdjusted] = useState("");
  const [reason, setReason] = useState("");
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
      <p>You do not have permission to adjust store stock.</p>
    </div>
  );
}

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer); // cleanup if message changes or component unmounts
    }
  }, [message]);

  const fetchItems = async () => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get("/store/items/simple");
      setItems(res.data || []);
    } catch (error) {
      console.error("Error fetching items:", error);
      setItems([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!itemId || !quantityAdjusted || !reason) {
      setMessage("⚠ Please fill in all fields.");
      return;
    }

    try {
      const axios = axiosWithAuth();
      await axios.post("/store/adjust", {
        item_id: parseInt(itemId),
        quantity_adjusted: parseInt(quantityAdjusted),
        reason: reason.trim(),
      });
      setMessage("✅ Stock adjustment successful!");
      setItemId("");
      setQuantityAdjusted("");
      setReason("");
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.detail || "❌ Adjustment failed.");
    }
  };

  return (
    <div className="stock-adjustment-container">
      <h2>Stock Adjustment</h2>
      {message && <div className="message">{message}</div>}

      <form onSubmit={handleSubmit} className="adjustment-form">
        {/* Item Selection */}
        <label>Item</label>
        <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">-- Select Item --</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.unit}) - ₦
              {item.unit_price?.toLocaleString("en-NG")}
            </option>
          ))}
        </select>

        {/* Quantity */}
        <label>Quantity to Deduct</label>
        <input
          type="number"
          min="1"
          value={quantityAdjusted}
          onChange={(e) => setQuantityAdjusted(e.target.value)}
        />

        {/* Reason */}
        <label>Reason</label>
        <textarea
          rows="3"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        ></textarea>

        <button type="submit" className="adjust-btn">
          Adjust Stock
        </button>
      </form>
    </div>
  );
};

export default StockAdjustment;
