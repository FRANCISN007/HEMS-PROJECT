import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./BarStockAdjustment.css";

const BarStockAdjustment = () => {
  const [bars, setBars] = useState([]);
  const [barId, setBarId] = useState("");
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState("");
  const [quantityAdjusted, setQuantityAdjusted] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  // ✅ Get user roles from localStorage
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const roles = user.roles || [];

  // ✅ Restrict access: only admin and bar can create payments
  if (!(roles.includes("admin") || roles.includes("bar"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to create bar adjustment.</p>
      </div>
    );
  }


  // ⏬ Fetch bars for dropdown
  useEffect(() => {
    const fetchBars = async () => {
      try {
        const res = await axiosWithAuth().get("/bar/bars/simple");
        if (Array.isArray(res.data)) {
          setBars(res.data);
        } else {
          console.error("⚠️ Expected array for bars, got:", res.data);
          setBars([]);
        }
      } catch (err) {
        console.error("❌ Failed to fetch bars:", err);
        setBars([]);
      }
    };
    fetchBars();
  }, []);

  // ⏬ Fetch items for dropdown
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await axiosWithAuth().get("/store/items/simple");
        setItems(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("❌ Failed to fetch items:", err);
        setItems([]);
      }
    };
    fetchItems();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!barId || !itemId || !quantityAdjusted || !reason) {
      setMessage("⚠ Please fill in all fields.");
      return;
    }

    try {
      await axiosWithAuth().post("/bar/adjust", {
        bar_id: parseInt(barId),
        item_id: parseInt(itemId),
        quantity_adjusted: parseInt(quantityAdjusted),
        reason: reason.trim(),
      });
      setMessage("✅ Stock adjustment successful!");
      setBarId("");
      setItemId("");
      setQuantityAdjusted("");
      setReason("");
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.detail || "❌ Adjustment failed.");
    }
  };

  return (
    <div className="bar-stock-adjustment-container">
      <h2>🔧 Bar Stock Adjustment</h2>
      {message && <div className="message">{message}</div>}

      <form onSubmit={handleSubmit} className="adjustment-form">
        {/* Bar Selection */}
        <label>Bar</label>
        <select value={barId} onChange={(e) => setBarId(e.target.value)}>
          <option value="">-- Select Bar --</option>
          {bars.map((bar) => (
            <option key={bar.id} value={bar.id}>
              {bar.name}
            </option>
          ))}
        </select>

        {/* Item Selection */}
        <label>Item</label>
        <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">-- Select Item --</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.unit}) - ₦{item.unit_price?.toLocaleString()}
            </option>
          ))}
        </select>

        {/* Quantity */}
        <label>Quantity to Deduct</label>
        <input
          type="number"
          value={quantityAdjusted}
          onChange={(e) => setQuantityAdjusted(e.target.value)}
          placeholder="e.g. 5 to reduce, -5 to add"
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

export default BarStockAdjustment;
