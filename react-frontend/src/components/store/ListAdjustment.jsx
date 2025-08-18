// src/pages/store/StockAdjustment/ListAdjustment.jsx
import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListAdjustment.css";

const ListAdjustment = () => {
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingAdjustment, setEditingAdjustment] = useState(null);
  const [items, setItems] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // On first load, set default date range to current month
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    setStartDate(firstDay);
    setEndDate(lastDay);

    fetchAdjustments(firstDay, lastDay);
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer); // cleanup if message changes or component unmounts
    }
  }, [message]);

  const fetchAdjustments = async (start = startDate, end = endDate) => {
    try {
      const axios = axiosWithAuth();
      let url = "/store/adjustments";

      const params = [];
      if (start) params.push(`start_date=${start}T00:00:00`);
      if (end) params.push(`end_date=${end}T23:59:59`);

      if (params.length > 0) {
        url += "?" + params.join("&");
      }

      const res = await axios.get(url);
      setAdjustments(res.data || []);
    } catch (error) {
      console.error("Error fetching adjustments:", error);
      setMessage("❌ Failed to load adjustments");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this adjustment?")) return;
    try {
      const axios = axiosWithAuth();
      await axios.delete(`/store/adjustments/${id}`);
      setMessage("✅ Adjustment deleted successfully");
      setTimeout(() => setMessage(""), 3000);
      fetchAdjustments();
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.detail || "❌ Failed to delete");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const fetchItems = async () => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get("/store/items/simple");
      setItems(res.data || []);
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  };

  const handleEditClick = (adj) => {
    fetchItems();
    setEditingAdjustment({
      id: adj.id,
      item_id: String(adj.item.id),
      quantity_adjusted: adj.quantity_adjusted,
      reason: adj.reason
    });
  };

  const handleEditSave = async () => {
    try {
      const axios = axiosWithAuth();
      await axios.put(`/store/adjustments/${editingAdjustment.id}`, {
        item_id: parseInt(editingAdjustment.item_id),
        quantity_adjusted: parseInt(editingAdjustment.quantity_adjusted),
        reason: editingAdjustment.reason,
      });
      setMessage("✅ Adjustment updated successfully!");
      setTimeout(() => setMessage(""), 3000);

      setEditingAdjustment(null);
      fetchAdjustments();
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.detail || "❌ Failed to update");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="list-adjustment-container">
      <h2>List Adjustments</h2>
      {message && <div className="message">{message}</div>}

      {/* Date Filter */}
      <div className="filter-section">
        <label>Start Date:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        <label>End Date:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />

        <button onClick={() => fetchAdjustments(startDate, endDate)}>🔍 Search</button>
        <button
          onClick={() => {
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
              .toISOString()
              .split("T")[0];
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
              .toISOString()
              .split("T")[0];
            setStartDate(firstDay);
            setEndDate(lastDay);
            fetchAdjustments(firstDay, lastDay);
          }}
        >
          📅 This Month
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Item</th>
            <th>Quantity Adjusted</th>
            <th>Reason</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {adjustments.map((adj, index) => (
            <tr key={adj.id} className={index % 2 === 0 ? "even-row" : "odd-row"}>
              <td>{new Date(adj.adjusted_at).toLocaleString()}</td>
              <td>{adj.item?.name}</td>
              <td>{adj.quantity_adjusted}</td>
              <td>{adj.reason}</td>
              <td>
                <button onClick={() => handleEditClick(adj)}>✏ Edit</button>
                <button onClick={() => handleDelete(adj.id)}>🗑 Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Edit Form Modal */}
      {editingAdjustment && (
        <div className="edit-modal">
          <div className="edit-modal-content">
            <h3>Edit Adjustment</h3>

            <label>Item</label>
            <select
              value={editingAdjustment.item_id}
              onChange={(e) =>
                setEditingAdjustment({ ...editingAdjustment, item_id: e.target.value })
              }
            >
              <option value="">-- Select Item --</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <label>Quantity Adjusted</label>
            <input
              type="number"
              value={editingAdjustment.quantity_adjusted}
              onChange={(e) =>
                setEditingAdjustment({ ...editingAdjustment, quantity_adjusted: e.target.value })
              }
            />

            <label>Reason</label>
            <textarea
              value={editingAdjustment.reason}
              onChange={(e) =>
                setEditingAdjustment({ ...editingAdjustment, reason: e.target.value })
              }
            />

            <div className="edit-buttons">
              <button onClick={handleEditSave}>💾 Save</button>
              <button onClick={() => setEditingAdjustment(null)}>❌ Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListAdjustment;
