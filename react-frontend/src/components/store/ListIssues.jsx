import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListIssues.css";

const ListIssues = () => {
  const [issues, setIssues] = useState([]);
  const [bars, setBars] = useState([]);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedBarId, setSelectedBarId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingIssue, setEditingIssue] = useState(null);
  const [formData, setFormData] = useState({
    issue_to: "bar",
    issued_to_id: "",
    issue_date: "",
    issue_items: [],
  });
  const [originalIssueCounts, setOriginalIssueCounts] = useState({}); // item_id -> qty originally

  const getToday = () => new Date().toISOString().split("T")[0];

  useEffect(() => {
    const { firstDay, lastDay } = (() => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      return { firstDay: first, lastDay: last };
    })();
    setStartDate(firstDay);
    setEndDate(lastDay);
  }, []);

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];
  if (Array.isArray(storedUser.roles)) roles = storedUser.roles;
  else if (typeof storedUser.role === "string") roles = [storedUser.role];
  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("store"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to list items issued.</p>
      </div>
    );
  }

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3500);
  };

  // fetch bars and items once
  useEffect(() => {
    (async () => {
      try {
        const [barsRes, itemsRes] = await Promise.all([
          axiosWithAuth().get("/bar/bars/simple"),
          axiosWithAuth().get("/store/items/simple"),
        ]);
        setBars(Array.isArray(barsRes.data) ? barsRes.data : []);
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
      } catch (err) {
        console.error("Error fetching bars/items", err);
      }
    })();
  }, []);

  const fetchIssues = async (
    barId = selectedBarId,
    sDate = startDate,
    eDate = endDate
  ) => {
    try {
      const params = {};

      if (barId) params.bar_id = barId;
      if (sDate) params.start_date = sDate;
      if (eDate) params.end_date = eDate;

      const res = await axiosWithAuth().get("/store/bar", { params });

      setIssues(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching issues", err);
    }
  };


  useEffect(() => {
    fetchIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBarId, startDate, endDate]);

  const handleEditClick = (issue) => {
    const issue_items = (issue.issue_items || []).map((it) => ({
      item_id: it.item?.id || "",
      quantity: it.quantity || 0,
    }));

    const orig = {};
    issue_items.forEach((it) => {
      const id = Number(it.item_id);
      if (!id) return;
      orig[id] = (orig[id] || 0) + Number(it.quantity || 0);
    });

    setOriginalIssueCounts(orig);

    setFormData({
      issue_to: "bar",
      issued_to_id: issue.issued_to_id || "",
      issue_date: issue.issue_date ? issue.issue_date.split("T")[0] : getToday(),
      issue_items,
    });

    setEditingIssue(issue.id);
  };

  const handleFormChange = (index, field, value) => {
    const newItems = [...formData.issue_items];
    if (field === "quantity") value = Number(value || 0);
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, issue_items: newItems });
  };

  // Add / Remove lines
  const addIssueLine = () => {
    setFormData({ ...formData, issue_items: [...(formData.issue_items || []), { item_id: "", quantity: 1 }] });
  };
  const removeIssueLine = (index) => {
    const newItems = [...formData.issue_items];
    newItems.splice(index, 1);
    setFormData({ ...formData, issue_items: newItems });
  };

  const handleSubmitEdit = async (id) => {
    try {
      if (!formData.issued_to_id) {
        showMessage("❌ Select a bar to issue to.");
        return;
      }
      if (!formData.issue_items || formData.issue_items.length === 0) {
        showMessage("❌ Add at least one item.");
        return;
      }

      // Aggregate requested quantities by item_id
      const requested = {};
        for (const row of formData.issue_items) {
          const iid = Number(row.item_id || 0);
          const qty = Number(row.quantity || 0);
          if (!iid) {
            showMessage("❌ Every line must have an item selected.");
            return;
          }
          if (!qty || qty <= 0) {
            showMessage("❌ Quantity must be greater than 0 for all items.");
            return;
          }
          requested[iid] = (requested[iid] || 0) + qty;
        }

        for (const iidStr of Object.keys(requested)) {
      const iid = Number(iidStr);
      const reqQty = requested[iid];

      const resp = await axiosWithAuth().get(`/store/stock/${iid}`);
      const available = Number(resp.data?.available || 0);

      const oldQty = Number(originalIssueCounts[iid] || 0);
      const allowed = available + oldQty;

      if (reqQty > allowed) {
          const itemObj = items.find((it) => it.id === iid) || {};
          showMessage(
            `❌ Not enough stock for "${itemObj.name}". Requested: ${reqQty}, Available: ${allowed}`
          );
          return;
      }
  }


      // All validations passed -> send update
      const payload = {
        issue_to: formData.issue_to,
        issued_to_id: Number(formData.issued_to_id),
        issue_date: formData.issue_date,
        issue_items: formData.issue_items.map((it) => ({
          item_id: Number(it.item_id),
          quantity: Number(it.quantity),
        })),
      };

      await axiosWithAuth().put(`/store/bar-issues/${id}`, payload);
      showMessage("✅ Issue updated successfully.");
      setEditingIssue(null);
      setFormData({ issue_to: "bar", issued_to_id: "", issue_date: getToday(), issue_items: [] });
      setOriginalIssueCounts({});
      fetchIssues();
    } catch (err) {
      console.error("Update failed", err.response?.data || err.message);
      const detail = err.response?.data?.detail || err.response?.data || err.message || "Update failed";
      showMessage(`❌ ${detail}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this issue?")) return;
    try {
      await axiosWithAuth().delete(`/store/bar-issues/${id}`);

      showMessage("✅ Issue deleted successfully.");
      fetchIssues();
    } catch (err) {
      console.error("Delete failed", err);
      showMessage("❌ Failed to delete issue.");
    }
  };

  // summary values
  const totalIssued = issues.length;
  const totalQuantity = issues.reduce((acc, issue) => acc + (issue.issue_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0), 0);

  return (
    <div className="list-issues-container">
      <h2>📦 List of Issued Items</h2>

      <div className="filters">
        <select
          value={selectedBarId}
          onChange={(e) => setSelectedBarId(e.target.value)}
        >
          <option value="">-- All Bars --</option>
          {bars.map((bar) => (
            <option key={bar.id} value={bar.id}>
              {bar.name}
            </option>
          ))}
        </select>


        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <button
          onClick={() => {
            const now = new Date();
            const first = new Date(now.getFullYear(), now.getMonth(), 1)
              .toISOString()
              .split("T")[0];
            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
              .toISOString()
              .split("T")[0];

            setSelectedBarId("");
            setStartDate(first);
            setEndDate(last);
          }}
        >
          ♻️ Reset
        </button>

        
      </div>

      {message && <p className="issue-message">{message}</p>}

      <div className="summary">
        <p>Total Entries: {totalIssued}</p>
        <p>Total Quantity Issued: {totalQuantity}</p>
      </div>

      <table className="list-issues-table">
        <thead>
          <tr><th>ID</th><th>Issue To</th><th>Issue Date</th><th>Items Issued</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {issues.length === 0 ? (
            <tr><td colSpan="5">No issues found.</td></tr>
          ) : issues.map((issue) => (
            <tr key={issue.id}>
              <td>{issue.id}</td>
              <td>{issue.issued_to?.name || "Unnamed Bar"}</td>
              <td>{new Date(issue.issue_date).toLocaleDateString()}</td>
              <td><ul style={{ paddingLeft: "1rem", margin: 0 }}>{issue.issue_items.map(it => <li key={it.id}>{it.item?.name || 'Item'} — Qty: {it.quantity}</li>)}</ul></td>
              <td>
                <button className="edit-btn" onClick={() => handleEditClick(issue)}>✏️ Edit</button>
                <button className="delete-btn" onClick={() => handleDelete(issue.id)}>🗑️ Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingIssue && (
        <div className="edit-modal-overlay">
          <div className="edit-form">
            <h3>Edit Issue</h3>

            <label>Bar:</label>
            <select value={formData.issued_to_id} onChange={(e) => setFormData({ ...formData, issued_to_id: e.target.value })}>
              <option value="">-- Select a bar --</option>
              {bars.map(bar => <option key={bar.id} value={bar.id}>{bar.name}</option>)}
            </select>

            <label>Issue Date:</label>
            <input type="date" value={formData.issue_date} onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })} />

            <h4>Items</h4>
            {(formData.issue_items || []).map((item, index) => (
              <div key={index} className="item-row">
                <select value={item.item_id} onChange={(e) => handleFormChange(index, "item_id", e.target.value)}>
                  <option value="">-- Select an item --</option>
                  {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                </select>

                <input type="number" min={1} value={item.quantity} onChange={(e) => handleFormChange(index, "quantity", e.target.value)} placeholder="Qty" />

                <button type="button" className="remove-line" onClick={() => removeIssueLine(index)}>❌</button>
              </div>
            ))}

            <button type="button" className="add-btn" onClick={addIssueLine}>➕ Add Item</button>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button className="save-btn" onClick={() => handleSubmitEdit(editingIssue)}>✅ Save</button>
              <button className="cancel-btn" onClick={() => setEditingIssue(null)}>❌ Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListIssues;