import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./KitchenIssueList.css";

const KitchenIssueList = () => {
  const [issues, setIssues] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [items, setItems] = useState([]);

  const [message, setMessage] = useState("");

  const [filterKitchenId, setFilterKitchenId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [editingIssue, setEditingIssue] = useState(null);
  const [formData, setFormData] = useState({
    kitchen_id: "",
    issue_date: "",
    issue_items: [],
  });

  // =====================
  // Helpers
  // =====================
  const getToday = () => new Date().toISOString().split("T")[0];

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3500);
  };

  // =====================
  // Role Guard
  // =====================
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
        <p>You do not have permission to view kitchen issues.</p>
      </div>
    );
  }

  // =====================
  // Initial Dates
  // =====================
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setStartDate(today);
    setEndDate(today);
  }, []);

  // =====================
  // Fetch Kitchens
  // =====================
  useEffect(() => {
    (async () => {
      try {
        const res = await axiosWithAuth().get("/kitchen/simple");
        setKitchens(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Error fetching kitchens", err);
      }
    })();
  }, []);

  // =====================
  // Fetch Issues
  // =====================
  const fetchIssues = async () => {
    try {
      const params = {};
      if (filterKitchenId) params.kitchen_id = filterKitchenId;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await axiosWithAuth().get("/store/kitchen", { params });
      setIssues(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching issues", err);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [filterKitchenId, startDate, endDate]);

  // =====================
  // Fetch Items by Kitchen
  // =====================
  const fetchItemsByKitchen = async (kitchenId) => {
    if (!kitchenId) {
      setItems([]);
      return;
    }
    try {
      const res = await axiosWithAuth().get(
        `/kitchen/inventory/simple?kitchen_id=${kitchenId}`
      );
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching items", err);
      setItems([]);
    }
  };

  // =====================
  // Edit Issue
  // =====================
  const handleEditClick = async (issue) => {
    const kitchenId = issue.kitchen?.id || "";

    const issueItems = (issue.issue_items || []).map((it) => ({
      item_id: it.item?.id || "",
      quantity: Number(it.quantity || 0),
    }));

    setFormData({
      kitchen_id: kitchenId,
      issue_date: issue.issue_date
        ? issue.issue_date.split("T")[0]
        : getToday(),
      issue_items: issueItems,
    });

    setEditingIssue(issue.id);
    await fetchItemsByKitchen(kitchenId);
  };

  // =====================
  // Form Handlers
  // =====================
  const handleItemChange = (index, field, value) => {
    const updated = [...formData.issue_items];
    updated[index] = {
      ...updated[index],
      [field]: field === "quantity" ? Number(value) : value,
    };
    setFormData({ ...formData, issue_items: updated });
  };

  const addIssueLine = () => {
    setFormData({
      ...formData,
      issue_items: [...formData.issue_items, { item_id: "", quantity: 1 }],
    });
  };

  const removeIssueLine = (index) => {
    const updated = [...formData.issue_items];
    updated.splice(index, 1);
    setFormData({ ...formData, issue_items: updated });
  };

  // =====================
  // Submit Edit
  // =====================
  const handleSubmitEdit = async () => {
    try {
      if (!formData.kitchen_id) {
        showMessage("❌ Select a kitchen.");
        return;
      }
      if (!formData.issue_items.length) {
        showMessage("❌ Add at least one item.");
        return;
      }

      const payload = {
        kitchen_id: Number(formData.kitchen_id),
        issue_date: formData.issue_date,
        issue_items: formData.issue_items.map((it) => ({
          item_id: Number(it.item_id),
          quantity: Number(it.quantity),
        })),
      };

      await axiosWithAuth().put(`/store/kitchen/${editingIssue}`, payload);

      showMessage("✅ Issue updated successfully.");
      setEditingIssue(null);
      setFormData({ kitchen_id: "", issue_date: "", issue_items: [] });
      fetchIssues();
    } catch (err) {
      console.error("Update failed", err.response?.data || err.message);
      showMessage("❌ Failed to update issue.");
    }
  };

  // =====================
  // Delete
  // =====================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this issue?")) return;
    try {
      await axiosWithAuth().delete(`/store/kitchen/${id}`);
      showMessage("✅ Issue deleted.");
      fetchIssues();
    } catch (err) {
      showMessage("❌ Delete failed.");
    }
  };

  return (
    <div className="list-issues-container">
      <h2>📦 Kitchen Issue List</h2>

      <div className="filters">
        <select
          value={filterKitchenId}
          onChange={(e) => setFilterKitchenId(e.target.value)}
        >
          <option value="">-- Filter by Kitchen --</option>
          {kitchens.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>

        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

        <button onClick={() => fetchIssues()}>🔍 Filter</button>
      </div>

      {message && <p className="issue-message">{message}</p>}

      {/* Vertical Scroll Table */}
      <div className="table-scroll-container">
        <table className="list-issues-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Kitchen</th>
              <th>Date</th>
              <th>Items</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {issues.length === 0 ? (
              <tr>
                <td colSpan="5">No issues found.</td>
              </tr>
            ) : (
              issues.map((issue) => (
                <tr key={issue.id}>
                  <td>{issue.id}</td>
                  <td>{issue.kitchen?.name}</td>
                  <td>{new Date(issue.issue_date).toLocaleDateString()}</td>
                  <td>
                    <ul>
                      {issue.issue_items.map((it, idx) => (
                        <li key={idx}>
                          {it.item?.name} — {it.quantity}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    <button onClick={() => handleEditClick(issue)}>✏️ Edit</button>
                    <button onClick={() => handleDelete(issue.id)}>🗑️ Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ================= EDIT MODAL ================= */}
      {editingIssue && (
        <div className="edit-modal-overlay">
          <div className="edit-form">
            <h3>Edit Kitchen Issue</h3>

            <label>Kitchen</label>
            <select
              value={formData.kitchen_id}
              onChange={(e) => {
                setFormData({ ...formData, kitchen_id: e.target.value });
                fetchItemsByKitchen(e.target.value);
              }}
            >
              <option value="">-- Select Kitchen --</option>
              {kitchens.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>

            <label>Issue Date</label>
            <input
              type="date"
              value={formData.issue_date}
              onChange={(e) =>
                setFormData({ ...formData, issue_date: e.target.value })
              }
            />

            <h4>Items</h4>

            {formData.issue_items.map((row, idx) => (
              <div key={idx} className="item-row">
                <select
                  value={row.item_id}
                  onChange={(e) =>
                    handleItemChange(idx, "item_id", e.target.value)
                  }
                >
                  <option value="">-- Item --</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={row.quantity}
                  onChange={(e) =>
                    handleItemChange(idx, "quantity", e.target.value)
                  }
                />

                <button onClick={() => removeIssueLine(idx)}>❌</button>
              </div>
            ))}

            <button onClick={addIssueLine}>➕ Add Item</button>

            <div className="modal-actions">
              <button onClick={handleSubmitEdit}>✅ Save</button>
              <button onClick={() => setEditingIssue(null)}>❌ Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitchenIssueList;