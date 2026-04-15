import React, { useEffect, useState, useMemo, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./BarSalesCreate.css";

const BarSalesCreate = () => {
  const [bars, setBars] = useState([]);
  const [barId, setBarId] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 16));
  const [saleItems, setSaleItems] = useState([
    { item_id: "", item_name: "", search: "", suggestions: [], quantity: 1, selling_price: 0, total: 0 },
  ]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  

  const user = JSON.parse(localStorage.getItem("user")) || {};
  const roles = user.roles || [];

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  const businessName = storedUser.business?.name || "HEMS Hotel";


  const axios = axiosWithAuth();
  const fetchTimeout = useRef(null);

  // Role check
  if (!(roles.includes("admin") || roles.includes("bar"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to create bar sales.</p>
      </div>
    );
  }

  // Fetch bars
  useEffect(() => {
    axios
      .get("/bar/bars/simple")
      .then((res) => setBars(Array.isArray(res.data) ? res.data : []))
      .catch(() => showMessage("❌ Failed to load bars", "error"));
  }, []);

  // ===============================
  // Helpers
  // ===============================
  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, 3000);
  };

  const recalcRow = (row) => {
    const qty = Number(row.quantity || 0);
    const price = Number(row.selling_price || 0);
    return { ...row, total: qty * price };
  };

  const fetchItems = async (searchText) => {
    if (!searchText) return [];
    try {
      const res = await axios.get("/bar/items/simple-search", { params: { search: searchText, limit: 50 } });
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  };

  // ===============================
  // Row handlers
  // ===============================
  const handleRowChange = (index, field, value) => {
    const updated = [...saleItems];

    // Search input
    if (field === "search") {
      updated[index].search = value;
      updated[index].item_id = "";
      updated[index].item_name = "";
      updated[index].selling_price = 0;

      // Debounce
      if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
      fetchTimeout.current = setTimeout(async () => {
        if (value) {
          const results = await fetchItems(value);
          setSaleItems((prev) => {
            const temp = [...prev];
            temp[index].suggestions = results;
            return temp;
          });
        } else {
          setSaleItems((prev) => {
            const temp = [...prev];
            temp[index].suggestions = [];
            return temp;
          });
        }
      }, 300);
    }

    // Selecting a suggestion
    if (field === "select_item") {
      const selected = value; // full item object
      updated[index].item_id = selected.item_id;
      updated[index].item_name = selected.item_name;
      updated[index].selling_price = selected.selling_price || 0;
      updated[index].search = selected.item_name;
      updated[index].suggestions = [];
    }

    // Quantity or price
    if (field === "quantity" || field === "selling_price") {
      updated[index][field] = value;
    }

    updated[index] = recalcRow(updated[index]);
    setSaleItems(updated);
  };

  const handleAddRow = () => {
    setSaleItems([
      ...saleItems,
      { item_id: "", item_name: "", search: "", suggestions: [], quantity: 1, selling_price: 0, total: 0 },
    ]);
  };

  const handleRemoveRow = (index) => setSaleItems(saleItems.filter((_, i) => i !== index));

  const totalAmount = useMemo(() => saleItems.reduce((sum, row) => sum + row.total, 0), [saleItems]);

  // ===============================
  // Submit
  // ===============================
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!barId) return showMessage("⚠ Please select a bar.", "warning");

    const validItems = saleItems.filter((r) => r.item_id && r.quantity > 0 && r.selling_price > 0);
    if (!validItems.length) return showMessage("⚠ Add at least one valid item.", "warning");

    try {
      const payload = {
        bar_id: Number(barId),
        sale_date: new Date(saleDate).toISOString(),
        items: validItems.map((r) => ({
          item_id: Number(r.item_id),
          quantity: Number(r.quantity),
          selling_price: Number(r.selling_price),
        })),
      };
      await axios.post("/bar/sales", payload);
      showMessage("✅ Sale recorded successfully!");

      // Reset form
      setBarId("");
      setSaleDate(new Date().toISOString().slice(0, 16));
      setSaleItems([{ item_id: "", item_name: "", search: "", suggestions: [], quantity: 1, selling_price: 0, total: 0 }]);
    } catch (err) {
      console.error(err);
      showMessage(err.response?.data?.detail || "❌ Failed to record sale.", "error");
    }
  };

  const handlePreviewPrint = () => {
    const validItems = saleItems.filter(
      (r) => r.item_name && r.quantity > 0 && r.selling_price > 0
    );

    if (!validItems.length) {
      return showMessage("⚠ Add at least one item to preview.", "warning");
    }

    const selectedBarName =
      bars.find((b) => String(b.id) === String(barId))?.name || "N/A";

    const receiptWindow = window.open("", "_blank");

    receiptWindow.document.write(`
      <html>
        <head>
          <title>Bar Sales Preview</title>
          <style>
            body { font-family: monospace; width: 80mm; }
            h2 { text-align: center; font-size: 14px; margin: 5px 0; }
            p { margin: 2px 0; font-size: 12px; }
            table { width: 100%; font-size: 12px; }
            td { padding: 2px 0; }
            hr { border: 1px dashed #000; margin: 6px 0; }
            .right { text-align: right; }
          </style>
        </head>
        <body>

          <h2>${businessName.toUpperCase()}</h2>
          <h2>Bar Sales Preview</h2>

          <hr/>

          <p><strong>Bar:</strong> ${selectedBarName}</p>
          <p><strong>Date:</strong> ${new Date(saleDate).toLocaleString()}</p>

          <hr/>

          <table>
            ${validItems
              .map(
                (item) => `
                  <tr>
                    <td>${item.item_name} x${item.quantity}</td>
                    <td class="right">₦${Number(item.total).toLocaleString()}</td>
                  </tr>
                `
              )
              .join("")}
          </table>

          <hr/>

          <p><strong>Total:</strong> ₦${totalAmount.toLocaleString()}</p>

          <hr/>
          <p style="text-align:center;">Preview Only (Not Saved)</p>

        </body>
      </html>
    `);

    receiptWindow.document.close();
    receiptWindow.print();
  };


  // ===============================
  // Render
  // ===============================
  return (
    <div className="sale-container">
      <h2>🍹 Record Bar Sale</h2>
      {message && <p className={`sale-message msg-${messageType}`}>{message}</p>}

      <form onSubmit={handleSubmit}>
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
                  <div className="autocomplete">
                    <input
                      type="text"
                      placeholder="Type to search item..."
                      value={row.search}
                      onChange={(e) => handleRowChange(index, "search", e.target.value)}
                    />
                    {row.suggestions.length > 0 && (
                      <ul className="suggestions-list">
                        {row.suggestions.map((item) => (
                          <li key={item.item_id} onClick={() => handleRowChange(index, "select_item", item)}>
                            {item.item_name} (₦{item.selling_price})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
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

          <button
            type="button"
            className="preview-btn"
            onClick={handlePreviewPrint}
          >
            👁 Preview / Print
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
