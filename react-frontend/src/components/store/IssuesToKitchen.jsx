// src/components/kitchen/IssueToKitchen.jsx

import React, { useState, useEffect, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./IssuesToKitchen.css";

const IssueToKitchen = () => {
  const [kitchens, setKitchens] = useState([]);
  const [issuedTo, setIssuedTo] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [message, setMessage] = useState("");

  const [rows, setRows] = useState([
    { itemId: "", itemName: "", search: "", suggestions: [], quantity: "" },
  ]);

  const fetchTimeout = useRef(null);
  const axios = axiosWithAuth();

  const getToday = () => new Date().toISOString().split("T")[0];

  useEffect(() => {
    setIssueDate(getToday());
  }, []);

  // 🔐 Role check
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

  // =============================
  // FETCH KITCHENS
  // =============================
  useEffect(() => {
    axios
      .get("/kitchen/simple")
      .then((res) => setKitchens(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("❌ Error fetching kitchens", err));
  }, []);

  // =============================
  // SEARCH API (normalized)
  // =============================
  const fetchItems = async (searchText) => {
    if (!searchText || !issuedTo) return [];

    try {
      const res = await axios.get(
        "/store/store/kitchen-items/simple-search",
        {
          params: {
            search: searchText,
            kitchen_id: issuedTo,
            limit: 50,
          },
        }
      );

      // ✅ Normalize backend response
      return (res.data || []).map((item) => ({
        id: item.item_id,
        name: item.item_name,
        price: item.selling_price,
      }));
    } catch {
      return [];
    }
  };

  // =============================
  // ROW CHANGE HANDLER
  // =============================
  const handleRowChange = (index, field, value) => {
    const updated = [...rows];

    // 🔍 SEARCH INPUT
    if (field === "search") {
      updated[index].search = value;
      updated[index].itemId = "";
      updated[index].itemName = "";

      if (fetchTimeout.current) clearTimeout(fetchTimeout.current);

      fetchTimeout.current = setTimeout(async () => {
        const results = await fetchItems(value);

        setRows((prev) => {
          const temp = [...prev];
          temp[index].suggestions = results;
          return temp;
        });
      }, 300);
    }

    // ✅ SELECT ITEM
    if (field === "select_item") {
      updated[index].itemId = value.id;
      updated[index].itemName = value.name;
      updated[index].search = value.name;
      updated[index].suggestions = [];
    }

    // 🔢 QUANTITY
    if (field === "quantity") {
      updated[index].quantity = value;
    }

    setRows(updated);
  };

  // =============================
  // ADD / REMOVE ROW
  // =============================
  const addRow = () => {
    setRows([
      ...rows,
      { itemId: "", itemName: "", search: "", suggestions: [], quantity: "" },
    ]);
  };

  const removeRow = (index) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  // =============================
  // SUBMIT
  // =============================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!issuedTo) return alert("Select kitchen");

    const validRows = rows.filter((r) => r.itemId && r.quantity);

    if (!validRows.length) {
      alert("Add at least one valid item");
      return;
    }

    const payload = {
      kitchen_id: parseInt(issuedTo),
      issue_items: validRows.map((row) => ({
        item_id: parseInt(row.itemId),
        quantity: parseFloat(row.quantity),
      })),
      issue_date: issueDate + "T00:00:00",
    };

    try {
      await axios.post("/store/kitchen", payload);

      setMessage("✅ Items successfully issued");

      setRows([
        { itemId: "", itemName: "", search: "", suggestions: [], quantity: "" },
      ]);
      setIssuedTo("");
      setIssueDate(getToday());
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Error issuing items");
    }
  };

  // =============================
  // RENDER
  // =============================
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
          readOnly={roles.includes("store")}
          onChange={(e) => setIssueDate(e.target.value)}
        />

        <table className="issue-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td>
                  <div className="autocomplete">
                    <input
                      type="text"
                      placeholder="Search item..."
                      value={row.search}
                      onChange={(e) =>
                        handleRowChange(idx, "search", e.target.value)
                      }
                    />

                    {row.suggestions.length > 0 && (
                      <ul className="suggestions-list">
                        {row.suggestions.map((item) => (
                          <li
                            key={item.id}
                            onClick={() =>
                              handleRowChange(idx, "select_item", item)
                            }
                          >
                            {item.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
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
