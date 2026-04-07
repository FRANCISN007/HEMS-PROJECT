import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./GuestOrderCreate.css";

const currencyNGN = (value) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(Number(value || 0));

const GuestOrderCreate = () => {
  const [locations, setLocations] = useState([]);
  const [kitchens, setKitchens] = useState([]);
  const [message, setMessage] = useState("");

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = Array.isArray(storedUser.roles)
    ? storedUser.roles
    : typeof storedUser.role === "string"
    ? [storedUser.role]
    : [];
  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("restaurant"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to create guest order.</p>
      </div>
    );
  }

  const axios = axiosWithAuth();

  const [order, setOrder] = useState({
    location_id: "",
    kitchen_id: "",
    order_type: "room_service",
    room_number: "",
    guest_name: "",
    status: "open",
    items: [],
  });

  const [newItem, setNewItem] = useState({
    store_item_id: "",
    quantity: 1,
    price_per_unit: "",
    search: "",
    suggestions: [],
    selectedItem: null, // store the full item
  });

  // Auto clear message
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(t);
  }, [message]);

  // Fetch locations and kitchens
  useEffect(() => {
    Promise.all([axios.get("/restaurant/locations"), axios.get("/kitchen/simple")])
      .then(([locRes, kitRes]) => {
        setLocations(locRes.data || []);
        setKitchens(kitRes.data || []);
      })
      .catch(() => setMessage("❌ Failed to load dropdown data"));
  }, []);

  // Fetch items for search
  const fetchItems = async (searchText) => {
    if (!searchText) return [];
    try {
      const res = await axios.get("/restaurant/items/store-selling", { params: { search: searchText } });
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  };

  const handleNewItemChange = async (field, value) => {
    const updated = { ...newItem, [field]: value };

    // Search input
    if (field === "search") {
      updated.store_item_id = "";
      updated.price_per_unit = "";
      updated.selectedItem = null;
      if (value.length > 0) updated.suggestions = await fetchItems(value);
      else updated.suggestions = [];
    }

    // Select from suggestions
    if (field === "store_item_id") {
      const selected = updated.suggestions.find((i) => i.id === Number(value));
      if (selected) {
        updated.store_item_id = selected.id;
        updated.price_per_unit = selected.selling_price || 0;
        updated.search = selected.name;
        updated.selectedItem = selected; // store the full object
      }
      updated.suggestions = [];
    }

    setNewItem(updated);
  };

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
          selectedItem: newItem.selectedItem, // keep the full object for table display
        },
      ],
    }));

    setNewItem({ store_item_id: "", quantity: 1, price_per_unit: "", search: "", suggestions: [], selectedItem: null });
  };

  const removeItem = (idx) => {
    setOrder((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const submitOrder = async (e) => {
    e.preventDefault();
    if (!order.location_id) return setMessage("❌ Please select a location.");
    if (!order.kitchen_id) return setMessage("❌ Please select a kitchen.");
    if (order.order_type === "room_service" && !order.room_number)
      return setMessage("❌ Room Service requires a room number.");
    if (order.items.length === 0) return setMessage("❌ Please add at least one item.");

    const payload = {
      ...order,
      location_id: Number(order.location_id),
      kitchen_id: Number(order.kitchen_id),
      items: order.items.map((i) => ({
        store_item_id: Number(i.store_item_id),
        quantity: Number(i.quantity),
        price_per_unit: Number(i.price_per_unit) || 0,
      })),
    };

    try {
      await axios.post("/restaurant/meal-orders", payload);
      setMessage("✅ Guest order created successfully!");
      setOrder({ location_id: "", kitchen_id: "", order_type: "room_service", room_number: "", guest_name: "", status: "open", items: [] });
      setNewItem({ store_item_id: "", quantity: 1, price_per_unit: "", search: "", suggestions: [], selectedItem: null });
    } catch (err) {
      setMessage(err?.response?.data?.detail || "❌ Failed to create order.");
    }
  };

  // Build table rows
  const rows = order.items.map((it) => {
    const storeItem = it.selectedItem || {};
    const unit = Number(it.price_per_unit) || Number(storeItem.selling_price) || 0;
    return {
      name: storeItem.name || "--",
      type: storeItem.item_type?.toUpperCase() || "",
      quantity: it.quantity,
      unitPrice: unit,
      lineTotal: unit * it.quantity,
    };
  });

  const grandTotal = rows.reduce((sum, r) => sum + r.lineTotal, 0);

  return (
    <div className="guestorder-container">
      <h2>🧾 Create Guest Order</h2>
      {message && <p className="guestorder-message">{message}</p>}

      <form className="guestorder-form" onSubmit={submitOrder}>
        <select value={order.location_id} onChange={(e) => setOrder({ ...order, location_id: e.target.value })}>
          <option value="">-- Select Location --</option>
          {locations.map((loc) => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}
        </select>

        <select value={order.kitchen_id} onChange={(e) => setOrder({ ...order, kitchen_id: e.target.value })}>
          <option value="">-- Select Kitchen --</option>
          {kitchens.map((k) => (<option key={k.id} value={k.id}>{k.name}</option>))}
        </select>

        <select value={order.order_type} onChange={(e) => setOrder({ ...order, order_type: e.target.value })}>
          <option value="room_service">Room Service</option>
          <option value="dine_in">Dine In</option>
          <option value="takeaway">Takeaway</option>
        </select>

        <input type="text" placeholder="Guest Name (optional)" value={order.guest_name} onChange={(e) => setOrder({ ...order, guest_name: e.target.value })} />
        <input type="text" placeholder="Room Number (required for room service)" value={order.room_number} onChange={(e) => setOrder({ ...order, room_number: e.target.value })} />

        {/* Searchable item */}
        <div className="guestorder-item-form">
          <input type="text" placeholder="Type to search item..." value={newItem.search} onChange={(e) => handleNewItemChange("search", e.target.value)} />
          {newItem.suggestions.length > 0 && (
            <ul className="suggestions-list">
              {newItem.suggestions.map((item) => (
                <li key={item.id} onClick={() => handleNewItemChange("store_item_id", item.id)}>
                  {item.name} ({currencyNGN(item.selling_price)}) [{item.item_type?.toUpperCase() || ""}]
                </li>
              ))}
            </ul>
          )}
          <input type="number" min="1" value={newItem.quantity} onChange={(e) => handleNewItemChange("quantity", e.target.value)} />
          <input type="number" min="0" value={newItem.price_per_unit} onChange={(e) => handleNewItemChange("price_per_unit", e.target.value)} />
          <button type="button" onClick={addItem}>➕ Add Item</button>
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
                  <td><button type="button" className="delete action-btn" onClick={() => removeItem(i)}>❌</button></td>
                </tr>
              ))}
              <tr>
                <td colSpan="4" style={{ textAlign: "right", fontWeight: 600 }}>Total</td>
                <td colSpan="2" style={{ fontWeight: 700 }}>{currencyNGN(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        )}

        <button type="submit" className="submit-btn">✅ Create Order</button>
      </form>
    </div>
  );
};

export default GuestOrderCreate;
