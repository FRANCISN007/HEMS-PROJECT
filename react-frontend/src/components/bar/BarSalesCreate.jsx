import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./BarSalesCreate.css";

const BarSalesCreate = () => {
  const [bars, setBars] = useState([]);
  const [items, setItems] = useState([]);
  const [barId, setBarId] = useState("");
  const [saleItems, setSaleItems] = useState([
    { item_id: "", quantity: "", selling_price: "", total: 0 },
  ]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // ✅ success | error | warning

  // ⏬ Fetch bars
  useEffect(() => {
    const fetchBars = async () => {
      try {
        const res = await axiosWithAuth().get("/bar/bars/simple");
        setBars(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("❌ Failed to fetch bars:", err);
      }
    };
    fetchBars();
  }, []);

  // ⏬ Fetch bar items (with selling_price included)
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await axiosWithAuth().get("/bar/items/simple");
        setItems(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("❌ Failed to fetch items:", err);
      }
    };
    fetchItems();
  }, []);

  // ⏬ Recalculate totals
  useEffect(() => {
    let total = 0;
    const updated = saleItems.map((row) => {
      const item = items.find((i) => i.item_id === Number(row.item_id));
      const price = row.selling_price || item?.selling_price || "";
      const rowTotal = row.quantity * price;
      total += rowTotal;
      return { ...row, selling_price: price, total: rowTotal };
    });
    setSaleItems(updated);
    setTotalAmount(total);
  }, [
    saleItems.length,
    items,
    saleItems.map((r) => `${r.item_id}-${r.quantity}-${r.selling_price}`).join(","),
  ]);

  // ⏬ Add new row
  const handleAddRow = () => {
    setSaleItems([
      ...saleItems,
      { item_id: "", quantity: "", selling_price: "", total: 0 },
    ]);
  };

  // ⏬ Remove row
  const handleRemoveRow = (index) => {
    const updated = [...saleItems];
    updated.splice(index, 1);
    setSaleItems(updated);
  };

  // ⏬ Handle row change
  const handleRowChange = (index, field, value) => {
    const updated = [...saleItems];

    if (field === "item_id") {
      updated[index][field] = value;
      // Auto-fill selling_price from selected item
      const selected = items.find((i) => i.item_id === Number(value));
      updated[index].selling_price = selected ? selected.selling_price : 0;
    } else if (field === "quantity") {
      updated[index][field] = Number(value);
    } else {
      updated[index][field] = value;
    }

    setSaleItems(updated);
  };

  // ✅ Helper to show timed message
  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, 3000); // disappear after 3s
  };

  // ⏬ Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!barId || saleItems.length === 0) {
      showMessage("⚠ Please select a bar and add at least one item.", "warning");
      return;
    }

    try {
      const payload = {
        bar_id: Number(barId),
        items: saleItems
          .filter((row) => row.item_id && row.quantity > 0)
          .map((row) => ({
            item_id: Number(row.item_id),
            quantity: row.quantity,
            selling_price: row.selling_price,
          })),
      };

      const res = await axiosWithAuth().post("/bar/sales", payload);
      showMessage("✅ Sale recorded successfully!", "success");
      console.log("Sale response:", res.data);

      // Reset form
      setBarId("");
      setSaleItems([{ item_id: "", quantity: 1, selling_price: 0, total: 0 }]);
      setTotalAmount(0);
    } catch (err) {
      console.error("❌ Sale failed:", err);
      showMessage(err.response?.data?.detail || "❌ Failed to record sale.", "error");
    }
  };

  return (
    <div className="sale-container">
      <h2>🍹 Record Bar Sale</h2>

      {message && (
        <p
          className={`sale-message ${
            messageType === "success"
              ? "msg-success"
              : messageType === "error"
              ? "msg-error"
              : "msg-warning"
          }`}
        >
          {message}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        {/* Select Bar */}
        <div className="form-group">
          <label>Bar:</label>
          <select value={barId} onChange={(e) => setBarId(e.target.value)}>
            <option value="">-- Select Bar --</option>
            {bars.map((bar) => (
              <option key={bar.id} value={bar.id}>
                {bar.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sales Table */}
        <table className="sale-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Selling Price (₦)</th>
              <th>Total (₦)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {saleItems.map((row, index) => (
              <tr key={index}>
                <td>
                  <select
                    value={row.item_id}
                    onChange={(e) =>
                      handleRowChange(index, "item_id", e.target.value)
                    }
                  >
                    <option value="">-- Select Item --</option>
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
                    onChange={(e) =>
                      handleRowChange(index, "quantity", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    value={row.selling_price}
                    onChange={(e) =>
                      handleRowChange(index, "selling_price", Number(e.target.value))
                    }
                  />
                </td>
                <td>₦{row.total.toLocaleString()}</td>
                <td>
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => handleRemoveRow(index)}
                  >
                    ❌
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button type="button" className="add-btn" onClick={handleAddRow}>
          ➕ Add Item
        </button>

        <div className="totals">
          <p>Total Entries: {saleItems.length}</p>
          <p>Total Sales: ₦{totalAmount.toLocaleString()}</p>
        </div>

        <button type="submit" className="submit-btn">
          💾 Save Sale
        </button>
      </form>
    </div>
  );
};

export default BarSalesCreate;
