import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./KitchenStockAdjust.css"; // ✅ css

const KitchenStockAdjust = () => {
  const [kitchens, setKitchens] = useState([]);
  const [items, setItems] = useState([]);
  const [kitchenId, setKitchenId] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantityAdjusted, setQuantityAdjusted] = useState("");
  const [reason, setReason] = useState("");
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

  if (!roles.includes("admin")) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to adjust kitchen stock.</p>
      </div>
    );
  }

  // -----------------------------
  // LOAD DATA
  // -----------------------------
  useEffect(() => {
    fetchKitchens();
  }, []);

  useEffect(() => {
    if (kitchenId) {
      fetchKitchenItems(kitchenId);
    } else {
      setItems([]);
      setItemId("");
    }
  }, [kitchenId]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

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

  const fetchKitchenItems = async (kitchenId) => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get(
        `/kitchen/inventory/simple?kitchen_id=${kitchenId}`
      );
      setItems(res.data || []);
      setItemId(""); // reset item when kitchen changes
    } catch (error) {
      console.error("Error fetching kitchen items:", error);
      setItems([]);
    }
  };


  // -----------------------------
  // SUBMIT
  // -----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!kitchenId || !itemId || !quantityAdjusted || !reason) {
      setMessage("⚠ Please fill in all fields.");
      return;
    }

    try {
      const axios = axiosWithAuth();
      await axios.post("/kitchen/adjust", {
        kitchen_id: parseInt(kitchenId),
        item_id: parseInt(itemId),
        quantity_adjusted: parseInt(quantityAdjusted),
        reason: reason.trim(),
      });

      setMessage("✅ Kitchen stock adjusted successfully!");

      // ✅ RESET FORM
      setItemId("");
      setQuantityAdjusted("");
      setReason("");

      // ✅ AUTO REFRESH INVENTORY
      fetchKitchenItems(kitchenId);

    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.detail || "❌ Adjustment failed.");
    }
  };


  return (
    <div className="stock-adjustment-container">
      <h2>Kitchen Stock Adjustment</h2>

      {message && <div className="message">{message}</div>}

      <form onSubmit={handleSubmit} className="adjustment-form">
        {/* Kitchen */}
        <label>Kitchen</label>
        <select
          value={kitchenId}
          onChange={(e) => setKitchenId(e.target.value)}
        >
          <option value="">-- Select Kitchen --</option>
          {kitchens.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>

        {/* Item */}
        <label>Item</label>
        <select
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          disabled={!kitchenId}
        >
          <option value="">-- Select Item --</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.unit}) – Available: {item.quantity}
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
          Adjust Kitchen Stock
        </button>
      </form>
    </div>
  );
};

export default KitchenStockAdjust;
