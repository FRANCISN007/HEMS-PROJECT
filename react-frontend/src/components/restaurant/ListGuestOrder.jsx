// src/components/restaurant/ListGuestOrder.jsx
import React, { useEffect, useState, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListGuestOrder.css";
import "./Receipt.css"; // ✅ Reuse receipt styles
import { HOTEL_NAME } from "../../config/constants";

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
  const [locationFilter, setLocationFilter] = useState("");   // ✅ new

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];

  if (Array.isArray(storedUser.roles)) {
    roles = storedUser.roles;
  } else if (typeof storedUser.role === "string") {
    roles = [storedUser.role];
  }

  roles = roles.map((r) => r.toLowerCase());


  if (!(roles.includes("admin") || roles.includes("restaurant"))) {
  return (
    <div className="unauthorized">
      <h2>🚫 Access Denied</h2>
      <p>You do not have permission to list guest order.</p>
    </div>
  );
}


  // Get today in YYYY-MM-DD
  const getToday = () => {
    const t = new Date();
    return t.toISOString().split("T")[0];
  };

  useEffect(() => {
    const today = getToday();
    setStartDate(today);
    setEndDate(today);

    // ✅ fetch after state is set
    fetchLocations();
    fetchOrdersWithDates(today, today);
  }, []);

  // For editing
  const [editingOrder, setEditingOrder] = useState(null);
  const [formData, setFormData] = useState({
    guest_name: "",
    room_number: "",
    order_type: "",
    location_id: "",
    items: [],
  });

  // For printing
  const [printOrder, setPrintOrder] = useState(null);
  const [printTime, setPrintTime] = useState(null);
  const printRef = useRef();

  // Locations
  const [locations, setLocations] = useState([]);

  // Flash message auto-clear
    useEffect(() => {
      if (!message) return;
      const t = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(t);
    }, [message]);

    // Fetch Orders
    const fetchOrdersWithDates = async (from, to) => {
    try {
      const params = {};
      if (status) params.status = status;
      if (from) params.start_date = from;
      if (to) params.end_date = to;
      if (locationFilter) params.location_id = locationFilter;

      const res = await axiosWithAuth().get("/restaurant/list", { params });
      setOrders(res.data || []);
    } catch (err) {
      setMessage("❌ Failed to load orders.");
      console.error(err);
    }
  };

// keep your existing fetchOrders for filter button reuse
const fetchOrders = () => fetchOrdersWithDates(startDate, endDate);


  // Fetch Locations
  const fetchLocations = async () => {
    try {
      const res = await axiosWithAuth().get("/restaurant/locations");
      setLocations(res.data || []);
    } catch (err) {
      setMessage("❌ Failed to load locations.");
      console.error(err);
    }
  };

  // Derived totals
  const entriesTotal = orders.length;
  const grossTotal = orders.reduce((sum, o) => {
    const orderTotal = o.items.reduce(
      (s, it) =>
        s +
        (Number(it.total_price) ||
          (Number(it.price_per_unit) || 0) * (Number(it.quantity) || 0)),
      0
    );
    return sum + orderTotal;
  }, 0);

  

  // Delete order
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this order?")) return;
    try {
      await axiosWithAuth().delete(`/restaurant/${id}`);
      setMessage("✅ Order deleted successfully!");
      fetchOrders();
    } catch (err) {
      setMessage("❌ Failed to delete order.");
      console.error(err);
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
        meal_name: i.meal_name,
        quantity: Number(i.quantity),
        price_per_unit: Number(i.price_per_unit || 0),
      })),
    });
  };

  // Open print modal
  const handlePrint = (order) => {
    setPrintOrder(order);
    setPrintTime(new Date()); // save current time of print
  };

  // Close modal
  const closePrintModal = () => {
    setPrintOrder(null);
    setPrintTime(null);
  };

  // Print receipt-style content
  const printModalContent = () => {
    if (!printRef.current) return;

    const printWindow = window.open("", "_blank", "width=400,height=600");
    printWindow.document.write(`
      <html>
        <head>
          <title>Kitchen Order #${printOrder.id}</title>
          <style>
            ${document.querySelector("style")?.innerHTML || ""}
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  // Update item field (quantity)
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData.items];
    if (field === "quantity") {
      const qty = Number(value);
      updatedItems[index][field] = isNaN(qty) ? 0 : qty;
    } else {
      updatedItems[index][field] = value;
    }
    setFormData({ ...formData, items: updatedItems });
  };

  // Remove item from edit
  const removeItemFromEdit = (index) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: updatedItems });
  };

  // Save edited order
  const handleSaveEdit = async () => {
    try {
      const payload = {
        guest_name: formData.guest_name,
        room_number: formData.room_number,
        order_type: formData.order_type,
        location_id: Number(formData.location_id) || null,
        items: formData.items.map((i) => ({
          meal_id: i.meal_id,
          quantity: Number(i.quantity),
        })),
      };

      await axiosWithAuth().put(`/restaurant/${editingOrder.id}`, payload);
      setMessage(`✅ Order #${editingOrder.id} updated successfully!`);
      setEditingOrder(null);
      fetchOrders();
    } catch (err) {
      setMessage("❌ Failed to update order.");
      console.error(err);
    }
  };

  // Modal grand total
  const modalGrandTotal =
    formData.items?.reduce(
      (sum, it) =>
        sum + Number(it.price_per_unit || 0) * Number(it.quantity || 0),
      0
    ) || 0;

  return (
    <div className="listorder-container">
      {/* Header */}
      <div className="listorder-header">
        <h2>📋 Guest Orders List</h2>
        <button className="refresh-btn" onClick={fetchOrders}>
          🔄 Refresh
        </button>
      </div>

      {/* Filters + Totals */}
      <div className="listorder-filters-summary">
        <div className="filters-left">
          <select
            className="location-filter"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>

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

        <div className="filters-right">
          <div>
            Entries: <strong>{entriesTotal}</strong>
          </div>
          <div>
            Gross Total: <strong>{currencyNGN(grossTotal)}</strong>
          </div>
        </div>
      </div>

      <hr className="listorder-divider" />

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
                (sum, it) =>
                  sum +
                  (Number(it.total_price) ||
                    (Number(it.price_per_unit) || 0) * (Number(it.quantity) || 0)),
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
                    <button
                      className="action-btn print"
                      onClick={() => handlePrint(o)}
                    >
                      🖨️ Print
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

      {/* ✅ Print Modal for Kitchen */}
      {printOrder && (
        <div className="modal-overlay" onClick={closePrintModal}>
          <div className="print-modal" onClick={(e) => e.stopPropagation()}>
            <div ref={printRef} className="receipt-container">
              <div className="receipt-header">
                <h2>{HOTEL_NAME.toUpperCase()}</h2>  
                <h2>Kitchen Order</h2>
                <p>{printTime.toLocaleString()}</p>
                <hr />
              </div>

              <div className="receipt-info">
                <p>
                  <strong>Order #:</strong> {printOrder.id}
                </p>
                <p>
                  <strong>Guest:</strong> {printOrder.guest_name || "--"}
                </p>
                <p>
                  <strong>Room:</strong> {printOrder.room_number || "--"}
                </p>
                <p>
                  <strong>Type:</strong> {printOrder.order_type}
                </p>
              </div>
              <hr />

              <div className="receipt-items">
                {printOrder.items && printOrder.items.length > 0 ? (
                  printOrder.items.map((item, idx) => (
                    <div key={idx} className="receipt-item">
                      <span>
                        {item.quantity} × {item.meal_name}
                      </span>
                      <span className="amount">
                        {currencyNGN(
                          item.total_price ||
                            item.price_per_unit * item.quantity
                        )}
                      </span>
                    </div>
                  ))
                ) : (
                  <p>No items</p>
                )}
              </div>
              <hr />

              <div className="receipt-footer">
                <p>-- Send to Kitchen --</p>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={printModalContent} className="print-btn">
                🖨️ Print Now
              </button>
              <button onClick={closePrintModal} className="close-btn">
                ❌
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Restored Edit Modal */}
      {editingOrder && (
        <div className="edit-modal">
          <div className="edit-modal-content">
            <h3>✏️ Edit Order #{editingOrder.id}</h3>

            <div className="edit-form-grid">
              <div className="form-group">
                <label>Guest Name</label>
                <input
                  type="text"
                  value={formData.guest_name}
                  onChange={(e) =>
                    setFormData({ ...formData, guest_name: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Room Number</label>
                <input
                  type="text"
                  value={formData.room_number}
                  onChange={(e) =>
                    setFormData({ ...formData, room_number: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Order Type</label>
                <input
                  type="text"
                  value={formData.order_type}
                  onChange={(e) =>
                    setFormData({ ...formData, order_type: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
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
              </div>
            </div>

            <h4>🛒 Items</h4>

            <table className="edit-items-table">
              <thead>
                <tr>
                  <th>Meal</th>
                  <th style={{ width: 110 }}>Qty</th>
                  <th style={{ width: 140 }}>Price/Unit</th>
                  <th style={{ width: 140 }}>Line Total</th>
                  <th style={{ width: 80 }}>Remove</th>
                </tr>
              </thead>
              <tbody>
                {formData.items.length > 0 ? (
                  formData.items.map((item, idx) => {
                    const unit = Number(item.price_per_unit || 0);
                    const qty = Number(item.quantity || 0);
                    return (
                      <tr key={idx}>
                        <td>{item.meal_name}</td>
                        <td>
                          <input
                            className="qty-input"
                            type="number"
                            min="1"
                            value={qty}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "quantity",
                                Number(e.target.value)
                              )
                            }
                          />
                        </td>
                        <td>{currencyNGN(unit)}</td>
                        <td>{currencyNGN(unit * qty)}</td>
                        <td>
                          <button
                            className="action-btn delete"
                            onClick={() => removeItemFromEdit(idx)}
                            title="Remove item"
                            type="button"
                          >
                            ✖
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan="5"
                      style={{ textAlign: "center", padding: "12px" }}
                    >
                      No items on this order.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3" className="total-cell-right">
                    Grand Total
                  </td>
                  <td className="total-amount">
                    {currencyNGN(modalGrandTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>

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
