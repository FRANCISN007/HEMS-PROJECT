import React, { useState, useEffect, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./IssueItems.css";

const IssueItems = () => {
  const [bars, setBars] = useState([]);
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

  // Role Check
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
        <p>You do not have permission to issue items.</p>
      </div>
    );
  }

  // Fetch Bars
  useEffect(() => {
    axios
      .get("/bar/bars/simple")
      .then((res) =>
        setBars(Array.isArray(res.data) ? res.data : res.data.bars || [])
      )
      .catch((err) => console.error("❌ Error fetching bars", err));
  }, []);

  // Search Items
  const fetchItems = async (searchText) => {
    if (!searchText) return [];

    try {
      const res = await axios.get("/bar/items/simple-search", {
        params: { search: searchText, limit: 50 },
      });
      return (res.data || []).map((item) => ({
        id: item.item_id,
        name: item.item_name,
        price: item.selling_price,
      }));
    } catch {
      return [];
    }
  };

  const handleRowChange = (index, field, value) => {
    const updated = [...rows];

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

    if (field === "select_item") {
      updated[index].itemId = value.id;
      updated[index].itemName = value.name;
      updated[index].search = value.name;
      updated[index].suggestions = [];
    }

    if (field === "quantity") {
      updated[index].quantity = value;
    }

    setRows(updated);
  };

  const addRow = () => {
    setRows([
      ...rows,
      { itemId: "", itemName: "", search: "", suggestions: [], quantity: "" },
    ]);
  };

  const removeRow = (index) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!issuedTo) return alert("Select a bar");

    const validRows = rows.filter((r) => r.itemId && r.quantity);
    if (!validRows.length) {
      alert("Add at least one valid item");
      return;
    }

    const payload = {
      issue_to: "bar",
      issued_to_id: parseInt(issuedTo),
      issue_items: validRows.map((row) => ({
        item_id: parseInt(row.itemId),
        quantity: parseFloat(row.quantity),
      })),
      issue_date: issueDate + "T00:00:00",
    };

    try {
      await axios.post("/store/bar", payload);
      setMessage("✅ Items successfully issued to bar");

      setRows([{ itemId: "", itemName: "", search: "", suggestions: [], quantity: "" }]);
      setIssuedTo("");
      setIssueDate(getToday());
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Error issuing items");
    }
  };

  return (
    <div className="issue-items-container">
      <h2>📤 Issue Items to Bar</h2>

      <form onSubmit={handleSubmit} className="issue-form">
        <label>Select Bar</label>
        <select
          value={issuedTo}
          onChange={(e) => setIssuedTo(e.target.value)}
          required
        >
          <option value="">-- Choose Bar --</option>
          {bars.map((bar) => (
            <option key={bar.id} value={bar.id}>
              {bar.name}
            </option>
          ))}
        </select>

        <label>Issue Date</label>
        <input
          type="date"
          value={issueDate}
          onChange={(e) => setIssueDate(e.target.value)}
          readOnly={roles.includes("store")}
        />

        {/* Scrollable Table */}
        <div className="table-scroll-container">
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
                        onChange={(e) => handleRowChange(idx, "search", e.target.value)}
                      />

                      {row.suggestions.length > 0 && (
                        <ul className="suggestions-list">
                          {row.suggestions.map((item) => (
                            <li
                              key={item.id}
                              onClick={() => handleRowChange(idx, "select_item", item)}
                            >
                              {item.name} - ₦{item.price}
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
                      onChange={(e) => handleRowChange(idx, "quantity", e.target.value)}
                    />
                  </td>

                  <td>
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(idx)} className="remove-btn">
                        ❌
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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

export default IssueItems;