import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListAdjustment.css";

const KitchenAdjustmentList = () => {
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingAdjustment, setEditingAdjustment] = useState(null);
  const [items, setItems] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [kitchenId, setKitchenId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Roles
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];
  if (Array.isArray(storedUser.roles)) roles = storedUser.roles;
  else if (typeof storedUser.role === "string") roles = [storedUser.role];
  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("store"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to view kitchen adjustments.</p>
      </div>
    );
  }

  // -------------------------
  // Initial load
  // -------------------------
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

    fetchAdjustments(firstDay, lastDay, "");
    fetchKitchens();
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(t);
  }, [message]);

  // -------------------------
  // API calls
  // -------------------------
  const fetchKitchens = async () => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get("/kitchen/simple");
      setKitchens(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchItems = async () => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get("/store/items/simple");
      setItems(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdjustments = async (start = startDate, end = endDate, kId = kitchenId) => {
    setLoading(true);
    try {
      const axios = axiosWithAuth();
      let url = "/kitchen/adjustments";
      const params = [];
      if (kId) params.push(`kitchen_id=${kId}`);
      if (start) params.push(`start_date=${start}T00:00:00`);
      if (end) params.push(`end_date=${end}T23:59:59`);
      if (params.length) url += `?${params.join("&")}`;
      const res = await axios.get(url);
      setAdjustments(res.data || []);
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to load kitchen adjustments");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // Edit & Delete Handlers
  // -------------------------
  const handleEditClick = async (adj) => {
    await fetchItems();
    setEditingAdjustment({
      id: adj.id,
      kitchen_id: adj.kitchen_id, // MUST include kitchen_id for backend
      item_id: String(adj.item?.id || ""),
      quantity_adjusted: String(adj.quantity_adjusted),
      reason: adj.reason || "",
    });
  };

  const handleEditSave = async () => {
    if (!editingAdjustment) return;

    const qty = parseFloat(editingAdjustment.quantity_adjusted);
    if (isNaN(qty)) {
      setMessage("❌ Quantity must be a number");
      return;
    }

    try {
      const axios = axiosWithAuth();
      await axios.put(`/kitchen/adjustments/${editingAdjustment.id}`, {
        kitchen_id: editingAdjustment.kitchen_id,
        item_id: parseInt(editingAdjustment.item_id),
        quantity_adjusted: qty,
        reason: editingAdjustment.reason || "",
      });

      setMessage("✅ Adjustment updated successfully!");
      setTimeout(() => setMessage(""), 3000);
      setEditingAdjustment(null);
      fetchAdjustments(startDate, endDate, kitchenId);
    } catch (err) {
      console.error(err);
      setMessage(
        typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : JSON.stringify(err.response?.data?.detail)
      );
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this adjustment?")) return;
    try {
      const axios = axiosWithAuth();
      await axios.delete(`/kitchen/adjustments/${id}`);
      setMessage("✅ Adjustment deleted");
      setTimeout(() => setMessage(""), 3000);
      fetchAdjustments(startDate, endDate, kitchenId);
    } catch (err) {
      setMessage(
        typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : JSON.stringify(err.response?.data?.detail)
      );
      setTimeout(() => setMessage(""), 3000);
    }
  };

  if (loading) return <p>Loading...</p>;

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="list-adjustment-container">
      <h2>Kitchen Inventory Adjustment List</h2>
      {message && <div className="message">{message}</div>}

      {/* Filters */}
      <div className="filter-section">
        <label>Kitchen</label>
        <select value={kitchenId} onChange={(e) => setKitchenId(e.target.value)}>
          <option value="">-- All Kitchens --</option>
          {kitchens.map((k) => (
            <option key={k.id} value={k.id}>{k.name}</option>
          ))}
        </select>

        <label>Start Date</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />

        <label>End Date</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

        <button onClick={() => fetchAdjustments(startDate, endDate, kitchenId)}>🔍 Search</button>
      </div>

      {/* Table */}
      <table className="adjustment-table">

        <thead>
          <tr>
            <th>Date</th>
            <th>Item</th>
            <th>Quantity</th>
            <th>Reason</th>
            <th>Adjusted By</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {adjustments.map((adj, i) => (
            <tr key={adj.id} className={i % 2 === 0 ? "even-row" : "odd-row"}>
              <td>{new Date(adj.adjusted_at).toLocaleString()}</td>
              <td>{adj.item?.name || "-"}</td>
              <td>{adj.quantity_adjusted}</td>
              <td>{adj.reason}</td>
              <td>{adj.adjusted_by?.username || adj.adjusted_by || "-"}</td>
              <td>
                {(roles.includes("admin") || roles.includes("store")) && (
                  <>
                    <button onClick={() => handleEditClick(adj)}>✏ Edit</button>
                    <button onClick={() => handleDelete(adj.id)}>🗑 Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Edit Modal */}
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
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>

            <label>Quantity</label>
            <input
              type="number"
              min="0"
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

export default KitchenAdjustmentList;
