// src/components/kitchen/IssueToKitchen.jsx

import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./IssueItems.css"; // reuse the same CSS

const IssueToKitchen = () => {
  const [kitchens, setKitchens] = useState([]);
  const [items, setItems] = useState([]);
  const [rows, setRows] = useState([{ itemId: "", quantity: "" }]);
  const [issuedTo, setIssuedTo] = useState(""); // kitchen_id
  const [issueDate, setIssueDate] = useState("");
  const [message, setMessage] = useState("");

  // 👉 Format as YYYY-MM-DD
  const getToday = () => new Date().toISOString().split("T")[0];

  useEffect(() => {
    setIssueDate(getToday());
  }, []);

  // Get user roles
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
        <p>You do not have permission to issue items to kitchens.</p>
      </div>
    );
  }

  // Fetch kitchens on mount
  useEffect(() => {
    fetchKitchens();
  }, []);

  // Fetch items whenever a kitchen is selected
  useEffect(() => {
    if (issuedTo) {
      fetchItems(issuedTo);
    } else {
      setItems([]); // clear items if no kitchen selected
    }
  }, [issuedTo]);

  const fetchKitchens = async () => {
    try {
      const res = await axiosWithAuth().get("/kitchen/simple");
      setKitchens(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("❌ Error fetching kitchens", err);
    }
  };

  const fetchItems = async (kitchenId) => {
    try {
      const res = await axiosWithAuth().get(
        `/kitchen/inventory/simple?kitchen_id=${kitchenId}`
      );
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("❌ Error fetching items", err);
    }
  };

  const handleRowChange = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const addRow = () => setRows([...rows, { itemId: "", quantity: "" }]);
  const removeRow = (index) => {
    const updated = [...rows];
    updated.splice(index, 1);
    setRows(updated);
  };

  // =============================
  // SUBMIT HANDLER
  // =============================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!issuedTo || rows.length === 0) {
      alert("Please select a kitchen and at least one item.");
      return;
    }

    // Convert "YYYY-MM-DD" → "YYYY-MM-DDT00:00:00"
    const issueDateISO = issueDate + "T00:00:00";

    const payload = {
      kitchen_id: parseInt(issuedTo),
      issue_items: rows.map((row) => ({
        item_id: parseInt(row.itemId),
        quantity: parseFloat(row.quantity),
      })),
      issue_date: issueDateISO,
    };

    try {
      await axiosWithAuth().post("/store/kitchen", payload);
      setMessage("✅ Items successfully issued to kitchen.");

      // Reset form
      setRows([{ itemId: "", quantity: "" }]);
      setIssuedTo("");
      setIssueDate(getToday());
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Error issuing items.");
      console.error("Issue error", err);
    }
  };

  return (
    <div className="issue-items-container">
      <h2>📤 Issue Items to Kitchen</h2>
      <form onSubmit={handleSubmit} className="issue-form">

        <label>Select Kitchen</label>
        <select
          value={issuedTo}
          onChange={(e) => setIssuedTo(e.target.value)}
          required
        >
          <option value="">-- Choose Kitchen --</option>
          {kitchens.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>

        <label>Issue Date</label>
        <input
          type="date"
          value={issueDate}
          onChange={(e) => setIssueDate(e.target.value)}
          required
          readOnly={roles.includes("store")} // store cannot change date
        />

        <table className="issue-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>❌</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td>
                  <select
                    value={row.itemId}
                    onChange={(e) =>
                      handleRowChange(idx, "itemId", e.target.value)
                    }
                    required
                  >
                    <option value="">-- Item --</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </td>

                <td>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={row.quantity}
                    onChange={(e) =>
                      handleRowChange(idx, "quantity", e.target.value)
                    }
                    required
                  />
                </td>

                <td>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(idx)}>
                      ❌
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button type="button" onClick={addRow} className="add-row-btn">
          ➕ Add Item
        </button>

        <button type="submit" className="submit-btn">
          📤 Issue Items
        </button>
      </form>

      {message && <p className="issue-message">{message}</p>}
    </div>
  );
};

export default IssueToKitchen;
