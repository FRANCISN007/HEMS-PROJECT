import React, { useEffect, useState, useMemo } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./BarSalesCreate.css";

const BarSalesCreate = () => {
  const [bars, setBars] = useState([]);
  const [items, setItems] = useState([]);
  const [barId, setBarId] = useState("");

  // ✅ Sale Date (default = now)
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 16));

  const [saleItems, setSaleItems] = useState([{ item_id: "", quantity: 1, selling_price: 0, total: 0 }]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // 🔐 Role check
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const roles = user.roles || [];

  if (!(roles.includes("admin") || roles.includes("bar"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to create bar sales.</p>
      </div>
    );
  }

  // ⏬ Fetch bars
  useEffect(() => {
    axiosWithAuth()
      .get("/bar/bars/simple")
      .then((res) => setBars(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("❌ Fetch bars failed:", err));
  }, []);

  // ⏬ Fetch items
  useEffect(() => {
    axiosWithAuth()
      .get("/bar/items/simplesellprice")
      .then((res) => setItems(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("❌ Fetch items failed:", err));
  }, []);

  // 🔢 Recalculate totals
  const totalAmount = useMemo(() => saleItems.reduce((sum, row) => sum + row.total, 0), [saleItems]);

  const recalcRow = (row) => {
    const qty = Number(row.quantity || 0);
    const price = Number(row.selling_price || 0);
    return { ...row, total: qty * price };
  };

  // ➕ Add row
  const handleAddRow = () => {
    setSaleItems([...saleItems, { item_id: "", quantity: 1, selling_price: 0, total: 0 }]);
  };

  // ❌ Remove row
  const handleRemoveRow = (index) => setSaleItems(saleItems.filter((_, i) => i !== index));

  // ✏️ Row changes
  const handleRowChange = (index, field, value) => {
    const updated = [...saleItems];
    if (field === "item_id") {
      const selected = items.find((i) => i.item_id === Number(value));
      updated[index] = recalcRow({
        ...updated[index],
        item_id: value,
        selling_price: selected?.selling_price || 0,
      });
    } else {
      updated[index] = recalcRow({ ...updated[index], [field]: value });
    }
    setSaleItems(updated);
  };

  // 🔔 Messages
  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, 3000);
  };

  // 💾 Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!barId) return showMessage("⚠ Please select a bar.", "warning");

    const validItems = saleItems.filter((r) => r.item_id && r.quantity > 0 && r.selling_price > 0);
    if (!validItems.length) return showMessage("⚠ Add at least one valid item.", "warning");

    try {
      const payload = {
        bar_id: Number(barId),
        sale_date: new Date(saleDate).toISOString(),
        items: validItems.map((row) => ({
          item_id: Number(row.item_id),
          quantity: Number(row.quantity),
          selling_price: Number(row.selling_price),
        })),
      };
      await axiosWithAuth().post("/bar/sales", payload);
      showMessage("✅ Sale recorded successfully!");

      // Reset
      setBarId("");
      setSaleDate(new Date().toISOString().slice(0, 16));
      setSaleItems([{ item_id: "", quantity: 1, selling_price: 0, total: 0 }]);
    } catch (err) {
      console.error("❌ Sale failed:", err);
      showMessage(err.response?.data?.detail || "❌ Failed to record sale.", "error");
    }
  };

  return (
    <div className="sale-container">
      <h2>🍹 Record Bar Sale</h2>

      {message && <p className={`sale-message msg-${messageType}`}>{message}</p>}

      <form onSubmit={handleSubmit}>
        {/* Bar + Sale Date Row */}
        <div className="bar-date-row">
          <div className="form-group">
            <label>Bar</label>
            <select value={barId} onChange={(e) => setBarId(e.target.value)}>
              <option value="">-- Select Bar --</option>
              {bars.map((bar) => (
                <option key={bar.id} value={bar.id}>
                  {bar.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Sale Date</label>
            <input
              type="datetime-local"
              value={saleDate}
              max={new Date().toISOString().slice(0, 16)}
              onChange={(e) => setSaleDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Sale Items Table */}
        <table className="sale-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price (₦)</th>
              <th>Total (₦)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {saleItems.map((row, index) => (
              <tr key={index}>
                <td>
                  <select
                    value={row.item_id}
                    onChange={(e) => handleRowChange(index, "item_id", e.target.value)}
                  >
                    <option value="">-- Select --</option>
                    {items.map((item) => (
                      <option key={item.item_id} value={item.item_id}>
                        {item.item_name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    value={row.quantity}
                    onChange={(e) => handleRowChange(index, "quantity", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    value={row.selling_price}
                    onChange={(e) => handleRowChange(index, "selling_price", e.target.value)}
                  />
                </td>
                <td>₦{row.total.toLocaleString()}</td>
                <td>
                  <button type="button" className="remove-btn" onClick={() => handleRemoveRow(index)}>
                    ❌
                  </button>
                </td>
              </tr>
            ))}

            {/* Grand Total Row */}
            <tr className="grand-total-row">
              <td colSpan="3" style={{ textAlign: "right" }}>
                <strong>Grand Total:</strong>
              </td>
              <td>
                <strong>₦{totalAmount.toLocaleString()}</strong>
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div className="buttons-row">
          <button type="button" className="add-btn" onClick={handleAddRow}>
            ➕ Add Item
          </button>
          <button type="submit" className="submit-btn">
            💾 Save Sale
          </button>
        </div>
      </form>
    </div>
  );
};

export default BarSalesCreate;
