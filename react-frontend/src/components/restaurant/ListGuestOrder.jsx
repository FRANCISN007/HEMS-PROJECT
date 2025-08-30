import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListGuestOrder.css";

// Currency formatter for NGN
const currencyNGN = (value) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(Number(value || 0));

const ListGuestOrder = () => {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");

  // For editing
  const [editingOrder, setEditingOrder] = useState(null);
  const [formData, setFormData] = useState({
    guest_name: "",
    room_number: "",
    order_type: "",
    location_id: "",
    items: [],
  });

  // Locations
  const [locations, setLocations] = useState([]);

  // Flash message auto-clear
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(t);
  }, [message]);

  // Fetch Orders
  const fetchOrders = async () => {
    try {
      const params = {};
      if (status) params.status = status;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await axiosWithAuth().get("/restaurant/list", { params });
      setOrders(res.data || []);
    } catch (err) {
      setMessage("❌ Failed to load orders.");
    }
  };

  // Fetch Locations
  const fetchLocations = async () => {
    try {
      const res = await axiosWithAuth().get("/restaurant/locations");
      setLocations(res.data || []);
    } catch (err) {
      setMessage("❌ Failed to load locations.");
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchLocations();
  }, []);

  // Delete order
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this order?")) return;
    try {
      await axiosWithAuth().delete(`/restaurant/${id}`);
      setMessage("✅ Order deleted successfully!");
      fetchOrders();
    } catch (err) {
      setMessage("❌ Failed to delete order.");
    }
  };

  // Open edit form
  const handleEdit = (order) => {
    setEditingOrder(order);
    setFormData({
      guest_name: order.guest_name,
      room_number: order.room_number,
      order_type: order.order_type,
      location_id: order.location_id,
      items: order.items.map((i) => ({
        meal_id: i.meal_id,
        quantity: i.quantity,
      })),
    });
  };

  // Save edited order
  const handleSaveEdit = async () => {
    try {
      await axiosWithAuth().put(`/restaurant/${editingOrder.id}`, formData);
      setMessage(`✅ Order #${editingOrder.id} updated successfully!`);
      setEditingOrder(null);
      fetchOrders();
    } catch (err) {
      setMessage("❌ Failed to update order.");
    }
  };

  return (
    <div className="listorder-container">
      {/* Header */}
      <div className="listorder-header">
        <h2>📋 Guest Orders</h2>
        <button className="refresh-btn" onClick={fetchOrders}>
          🔄 Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="listorder-filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <button className="filter-btn" onClick={fetchOrders}>
          🔍 Filter
        </button>
      </div>

      {/* Orders Table */}
      <table className="listorder-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Guest</th>
            <th>Room</th>
            <th>Type</th>
            <th>Status</th>
            <th>Created</th>
            <th>Total</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.length > 0 ? (
            orders.map((o) => {
              const total = o.items.reduce(
                (sum, it) => sum + (it.total_price || 0),
                0
              );
              return (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.guest_name || "--"}</td>
                  <td>{o.room_number || "--"}</td>
                  <td>{o.order_type}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        o.status === "open" ? "open" : "closed"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td>
                    {new Date(o.created_at).toLocaleString("en-NG", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td>{currencyNGN(total)}</td>
                  <td>
                    <button
                      className="action-btn edit"
                      onClick={() => handleEdit(o)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDelete(o.id)}
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="8" style={{ textAlign: "center", padding: "20px" }}>
                No orders found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Edit Modal */}
      {editingOrder && (
        <div className="edit-modal">
          <div className="edit-modal-content">
            <h3>✏️ Edit Order #{editingOrder.id}</h3>

            <label>Guest Name</label>
            <input
              type="text"
              value={formData.guest_name}
              onChange={(e) =>
                setFormData({ ...formData, guest_name: e.target.value })
              }
            />

            <label>Room Number</label>
            <input
              type="text"
              value={formData.room_number}
              onChange={(e) =>
                setFormData({ ...formData, room_number: e.target.value })
              }
            />

            <label>Order Type</label>
            <input
              type="text"
              value={formData.order_type}
              onChange={(e) =>
                setFormData({ ...formData, order_type: e.target.value })
              }
            />

            <label>Location</label>
            <select
              value={formData.location_id}
              onChange={(e) =>
                setFormData({ ...formData, location_id: e.target.value })
              }
            >
              <option value="">-- Select Location --</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>

            <div className="modal-actions">
              <button onClick={handleSaveEdit}>💾 Save</button>
              <button onClick={() => setEditingOrder(null)}>❌ Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Flash message */}
      {message && <p className="listorder-message">{message}</p>}
    </div>
  );
};

export default ListGuestOrder;
