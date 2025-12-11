import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./GuestOrderCreate.css";

const currencyNGN = (value) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" })
    .format(Number(value || 0));

const GuestOrderCreate = () => {
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");

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
        <p>You do not have permission to create guest order.</p>
      </div>
    );
  }

  const [order, setOrder] = useState({
    location_id: "",
    order_type: "room_service",
    room_number: "",
    guest_name: "",
    status: "open",
    items: [], // [{ store_item_id, quantity, price_per_unit }]
  });

  const [newItem, setNewItem] = useState({
    store_item_id: "",
    quantity: 1,
    price_per_unit: "",
  });

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(t);
  }, [message]);

  // Fetch dropdown values
  useEffect(() => {
    const api = axiosWithAuth();
    Promise.all([
      api.get("/restaurant/locations"),
      api.get("/restaurant/items/simple"),
    ])
      .then(([locRes, itemRes]) => {
        setLocations(locRes.data || []);
        setItems([...itemRes.data].sort((a, b) => a.id - b.id));
      })
      .catch(() => setMessage("❌ Failed to load dropdown data"));
  }, []);

  const addItem = () => {
    if (!newItem.store_item_id || Number(newItem.quantity) <= 0) return;

    setOrder((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          store_item_id: Number(newItem.store_item_id),
          quantity: Number(newItem.quantity),
          price_per_unit: Number(newItem.price_per_unit),
        },
      ],
    }));

    setNewItem({ store_item_id: "", quantity: 1, price_per_unit: "" });
  };

  const removeItem = (idx) => {
    setOrder((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const submitOrder = async (e) => {
    e.preventDefault();

    // Check for missing or invalid location and items
    if (!order.location_id) {
      setMessage("❌ Please select a location.");
      return;
    }

    if (order.items.length === 0) {
      setMessage("❌ Please add at least one item.");
      return;
    }

    if (order.order_type === "room_service" && !order.room_number) {
      setMessage("❌ Room Service requires a room number.");
      return;
    }

    const payload = {
      ...order,
      location_id: Number(order.location_id),
      items: order.items.map((i) => ({
        store_item_id: Number(i.store_item_id),
        quantity: Number(i.quantity),
        price_per_unit: Number(i.price_per_unit),
      })),
    };

    try {
      // Send the order to the backend
      await axiosWithAuth().post("/restaurant/meal-orders", payload);
      setMessage("✅ Guest order created successfully!");
      setOrder({
        location_id: "",
        order_type: "room_service",
        room_number: "",
        guest_name: "",
        status: "open",
        items: [],
      });
    } catch (err) {
      // If the backend returns an error (e.g., stock is insufficient), display it
      setMessage(err?.response?.data?.detail || "❌ Failed to create order.");
    }
  };


  // Table preview
  const rows = order.items.map((it) => {
    const storeItem = items.find((m) => Number(m.id) === Number(it.store_item_id));
    const unit = it.price_per_unit || storeItem?.price || 0;
    const line = Number(unit) * Number(it.quantity || 0);

    return {
      name: storeItem?.name || "--",
      quantity: it.quantity,
      unitPrice: unit,
      lineTotal: line,
    };
  });

  const grandTotal = rows.reduce((sum, r) => sum + r.lineTotal, 0);

  return (
    <div className="guestorder-container">
      <div className="guestorder-header">
        <h2>🧾 Create Guest Order</h2>
      </div>

      <form className="guestorder-form" onSubmit={submitOrder}>
        {/* Location */}
        <select
          value={order.location_id}
          onChange={(e) => setOrder({ ...order, location_id: e.target.value })}
          required
        >
          <option value="">-- Select Location --</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>

        {/* Order Type */}
        <select
          value={order.order_type}
          onChange={(e) => setOrder({ ...order, order_type: e.target.value })}
        >
          <option value="room_service">Room Service</option>
          <option value="dine_in">Dine In</option>
          <option value="takeaway">Takeaway</option>
        </select>

        {/* Guest Name */}
        <input
          type="text"
          placeholder="Guest Name (optional)"
          value={order.guest_name}
          onChange={(e) => setOrder({ ...order, guest_name: e.target.value })}
        />

        {/* Room Number */}
        <input
          type="text"
          placeholder="Room Number (required for room service)"
          value={order.room_number}
          onChange={(e) => setOrder({ ...order, room_number: e.target.value })}
        />

        {/* Add Item */}
        <div className="guestorder-item-form">
          <select
            value={newItem.store_item_id}
            onChange={(e) => setNewItem({ ...newItem, store_item_id: e.target.value })}
          >
            <option value="">-- Select Item --</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({currencyNGN(item.price)})
              </option>
            ))}
          </select>

          <input
            type="number"
            min="1"
            value={newItem.quantity}
            onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
          />

          {/* NEW PRICE INPUT */}
          <input
            type="number"
            min="0"
            placeholder="Price (₦)"
            value={newItem.price_per_unit}
            onChange={(e) => setNewItem({ ...newItem, price_per_unit: e.target.value })}
          />

          <button type="button" onClick={addItem}>
            ➕ Add Item
          </button>
        </div>

        {/* Items Table */}
        {order.items.length > 0 && (
          <table className="guestorder-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Line Total</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td>{r.quantity}</td>
                  <td>{currencyNGN(r.unitPrice)}</td>
                  <td>{currencyNGN(r.lineTotal)}</td>
                  <td>
                    <button type="button" className="delete action-btn" onClick={() => removeItem(i)}>
                      ❌
                    </button>
                  </td>
                </tr>
              ))}

              <tr>
                <td colSpan="3" style={{ textAlign: "right", fontWeight: 600 }}>
                  Total
                </td>
                <td colSpan="2" style={{ fontWeight: 700 }}>
                  {currencyNGN(grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        <button type="submit" className="submit-btn">
          ✅ Create Order
        </button>
      </form>

      {message && <p className="guestorder-message">{message}</p>}
    </div>
  );
};

export default GuestOrderCreate;
