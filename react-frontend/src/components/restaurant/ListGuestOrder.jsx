// src/components/restaurant/ListGuestOrder.jsx
import React, { useEffect, useState, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListGuestOrder.css";
import "./Receipt.css"; // Reuse receipt styles
import { HOTEL_NAME } from "../../config/constants";

// Currency formatter for NGN
const currencyNGN = (value) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    Number(value || 0)
  );

const ListGuestOrder = () => {
  // States
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [kitchenFilter, setKitchenFilter] = useState("");
  const [meals, setMeals] = useState([]);
  const [locations, setLocations] = useState([]);
  const [kitchens, setKitchens] = useState([]);

  // Editing state
  const [editingOrder, setEditingOrder] = useState(null);
  const [formData, setFormData] = useState({
    guest_name: "",
    room_number: "",
    order_type: "",
    location_id: "",
    kitchen_id: "",
    items: [],
    newMealId: "",
    newQty: "",
  });

  // Printing
  const [printOrder, setPrintOrder] = useState(null);
  const [printTime, setPrintTime] = useState(null);
  const printRef = useRef();

  // Role-based access
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
        <p>You do not have permission to list guest orders.</p>
      </div>
    );
  }

  // Helpers
  const getToday = () => new Date().toISOString().split("T")[0];

  // Initial load
  useEffect(() => {
    const today = getToday();
    setStartDate(today);
    setEndDate(today);
    fetchLocations();
    fetchKitchens();
    fetchMeals();
    fetchOrdersWithDates(today, today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when filters change
  useEffect(() => {
    if (startDate && endDate) fetchOrdersWithDates(startDate, endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, locationFilter, kitchenFilter, startDate, endDate]);

  // Flash message auto-clear
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(t);
  }, [message]);

  // Fetch meals (simple list)
  const fetchMeals = async () => {
    try {
      const res = await axiosWithAuth().get("/restaurant/items/simple");
      setMeals(res.data || []);
    } catch (err) {
      console.error("Failed to load meals:", err);
    }
  };

  // Fetch locations
  const fetchLocations = async () => {
    try {
      const res = await axiosWithAuth().get("/restaurant/locations");
      setLocations(res.data || []);
    } catch (err) {
      setMessage("❌ Failed to load locations.");
      console.error(err);
    }
  };

  // Fetch kitchens
  const fetchKitchens = async () => {
    try {
      const res = await axiosWithAuth().get("/kitchen/simple");
      setKitchens(res.data || []);
    } catch (err) {
      console.error("Failed to load kitchens:", err);
    }
  };

  // Fetch orders with date range + filters (includes kitchen_id)
  const fetchOrdersWithDates = async (from, to) => {
    try {
      const params = {};
      if (status) params.status = status;
      if (from) params.start_date = from;
      if (to) params.end_date = to;
      if (locationFilter) params.location_id = Number(locationFilter);
      if (kitchenFilter) params.kitchen_id = Number(kitchenFilter);

      const res = await axiosWithAuth().get("/restaurant/meal-orders", {
        params,
      });
      console.log("📌 RAW ORDER RESPONSE:", res.data);
      setOrders(Array.isArray(res.data) ? res.data : res.data?.orders || []);
    } catch (err) {
      setMessage("❌ Failed to load orders.");
      console.error(err);
    }
  };

  const fetchOrders = () => fetchOrdersWithDates(startDate, endDate);

  // Derived totals
  const entriesTotal = orders.length;
  const grossTotal = Array.isArray(orders)
    ? orders.reduce((sum, o) => {
        const orderTotal = Array.isArray(o.items)
          ? o.items.reduce(
              (s, it) =>
                s +
                (Number(it.total_price) ||
                  (Number(it.price_per_unit) || 0) * (Number(it.quantity) || 0)),
              0
            )
          : 0;
        return sum + orderTotal;
      }, 0)
    : 0;

  // Delete order
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this order?")) return;
    try {
      await axiosWithAuth().delete(`/restaurant/meal-orders/${id}`);
      setMessage("✅ Order deleted successfully!");
      fetchOrders();
    } catch (err) {
      setMessage("❌ Failed to delete order.");
      console.error(err);
    }
  };

  // Open edit form and map current order into formData
  const handleEdit = (order) => {
    setEditingOrder(order);
    setFormData({
      guest_name: order.guest_name || "",
      room_number: order.room_number || "",
      order_type: order.order_type || "",
      location_id: order.location_id || "",
      kitchen_id: order.kitchen_id || "",
      items: (order.items || []).map((i) => ({
        store_item_id: i.store_item_id,
        item_name: i.item_name,
        quantity: Number(i.quantity),
        price_per_unit: Number(i.price_per_unit || i.price || 0),
      })),
      newMealId: "",
      newQty: "",
    });
  };

  // Update item fields
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...formData.items];
    const normalized =
      field === "quantity" || field === "price_per_unit" ? Number(value) : value;
    updatedItems[index] = { ...updatedItems[index], [field]: normalized };
    setFormData({ ...formData, items: updatedItems });
  };

  const removeItemFromEdit = (index) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: updatedItems });
  };

  // Add item (from newMealId/newQty)
  const addItemToEdit = () => {
    const mealId = formData.newMealId;
    if (!mealId) return alert("Please select a meal to add.");
    const meal = meals.find((m) => String(m.id) === String(mealId));
    if (!meal) return alert("Selected meal not found.");
    const qty = Number(formData.newQty) || 1;
    const unitPrice = Number(meal.price || meal.unit_price || 0);

    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          store_item_id: meal.id,
          item_name: meal.name,
          quantity: qty,
          price_per_unit: unitPrice,
        },
      ],
      newMealId: "",
      newQty: "",
    });
  };

  // Save edited order (PUT)
  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    try {
      const payload = {
        guest_name: formData.guest_name,
        room_number: formData.room_number,
        order_type: formData.order_type,
        location_id: Number(formData.location_id) || null,
        kitchen_id: Number(formData.kitchen_id) || null,
        items: formData.items.map((i) => ({
          store_item_id: i.store_item_id,
          quantity: Number(i.quantity),
          price_per_unit: Number(i.price_per_unit || 0),
        })),
      };
      await axiosWithAuth().put(`/restaurant/meal-orders/${editingOrder.id}`, payload);
      setMessage(`✅ Order #${editingOrder.id} updated successfully!`);
      setEditingOrder(null);
      fetchOrders();
    } catch (err) {
      setMessage(err?.response?.data?.detail || "❌ Failed to update order.");
      console.error(err);
    }
  };

  // Print handlers
  const handlePrint = (order) => {
    setPrintOrder(order);
    setPrintTime(new Date());
  };
  const closePrintModal = () => {
    setPrintOrder(null);
    setPrintTime(null);
  };
  const printModalContent = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank", "width=400,height=600");
    w.document.write(
      `<html>
         <head>
           <title>Kitchen Order #${printOrder.id}</title>
           <style>${document.querySelector("style")?.innerHTML || ""}</style>
         </head>
         <body>${printRef.current.innerHTML}</body>
       </html>`
    );
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  // Modal grand total
  const modalGrandTotal =
    formData.items?.reduce(
      (sum, it) => sum + Number(it.price_per_unit || 0) * Number(it.quantity || 0),
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

          <select
            className="kitchen-filter"
            value={kitchenFilter}
            onChange={(e) => setKitchenFilter(e.target.value)}
          >
            <option value="">All Kitchens</option>
            {kitchens.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>

          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
            <th>Date</th>
            <th>Room</th>
            <th>Type</th>
            <th>Status</th>
            <th>Location</th>
            <th>Kitchen</th>
            <th>Total</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {orders.length > 0 ? (
            orders.map((order) => {
              const orderTotal = (order.items || []).reduce(
                (s, it) =>
                  s +
                  (Number(it.total_price) ||
                    (Number(it.price_per_unit) || 0) * (Number(it.quantity) || 0)),
                0
              );
              return (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.guest_name}</td>
                  <td>{order.created_at}</td>
                  <td>{order.room_number}</td>
                  <td>{order.order_type}</td>
                  <td>{order.status}</td>
                  <td>{locations.find((l) => l.id === order.location_id)?.name || "--"}</td>
                  <td>{kitchens.find((k) => k.id === order.kitchen_id)?.name || "--"}</td>
                  <td>{currencyNGN(orderTotal)}</td>
                  <td>
                    <button className="action-btn edit" onClick={() => handleEdit(order)}>✏️ Edit</button>
                    <button className="action-btn print" onClick={() => handlePrint(order)}>🖨️ Print</button>
                    <button className="action-btn delete" onClick={() => handleDelete(order.id)}>❌ Delete</button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="9" style={{ textAlign: "center", padding: "12px" }}>
                No guest orders found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Print Modal */}
      {printOrder && (
        <div className="modal-overlay" onClick={closePrintModal}>
          <div className="print-modal" onClick={(e) => e.stopPropagation()}>
            <div ref={printRef} className="receipt-container">
              <div className="receipt-header">
                <h2>{HOTEL_NAME.toUpperCase()}</h2>
                <h2>Kitchen Order</h2>
                <p>{printTime?.toLocaleString()}</p>
                <hr />
              </div>

              <div className="receipt-info">
                <p><strong>Order #:</strong> {printOrder.id}</p>
                <p><strong>Guest:</strong> {printOrder.guest_name || "--"}</p>
                <p><strong>Room:</strong> {printOrder.room_number || "--"}</p>
                <p><strong>Type:</strong> {printOrder.order_type}</p>
                <p><strong>Kitchen:</strong> {kitchens.find((k) => k.id === printOrder.kitchen_id)?.name || "--"}</p>
              </div>

              <hr />

              <div className="receipt-items">
                {printOrder.items && printOrder.items.length > 0 ? (
                  printOrder.items.map((item, idx) => (
                    <div key={idx} className="receipt-item">
                      <span>{item.quantity} × {item.item_name}</span>
                      <span className="amount">
                        {currencyNGN(item.total_price || (item.price_per_unit || 0) * item.quantity)}
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
              <button onClick={printModalContent} className="print-btn">🖨️ Print Now</button>
              <button onClick={closePrintModal} className="close-btn">❌</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingOrder && (
        <div className="modal-overlay" onClick={() => setEditingOrder(null)}>
          <div
            className="edit-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">✏️ Edit Order #{editingOrder.id}</h3>

            {/* Scrollable Content */}
            <div className="edit-modal-scroll">

              {/* ===== Form Inputs ===== */}
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

                <div className="form-group">
                  <label>Kitchen</label>
                  <select
                    value={formData.kitchen_id}
                    onChange={(e) =>
                      setFormData({ ...formData, kitchen_id: e.target.value })
                    }
                  >
                    <option value="">-- Select Kitchen --</option>
                    {kitchens.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ===== Items Section ===== */}
              <h4>🛒 Items</h4>

              <div className="add-item-row">
                <select
                  value={formData.newMealId || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, newMealId: e.target.value })
                  }
                >
                  <option value="">-- Select Meal --</option>
                  {meals.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({currencyNGN(m.price || m.unit_price)})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={formData.newQty || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, newQty: e.target.value })
                  }
                />

                <button className="add-item-btn" onClick={addItemToEdit}>
                  ➕ Add
                </button>
              </div>

              {/* ===== Items Table ===== */}
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
                      const unit = Number(item.price_per_unit);
                      const qty = Number(item.quantity || 0);

                      return (
                        <tr key={idx}>
                          <td>{item.item_name}</td>
                          <td>
                            <input
                              className="qty-input"
                              type="number"
                              min="1"
                              value={qty}
                              onChange={(e) =>
                                handleItemChange(idx, "quantity", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="price-input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={unit}
                              onChange={(e) =>
                                handleItemChange(idx, "price_per_unit", e.target.value)
                              }
                            />
                          </td>
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
                      <td colSpan="5" style={{ textAlign: "center", padding: "12px" }}>
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
                    <td className="total-amount">{currencyNGN(modalGrandTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ===== Modal Actions ===== */}
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
