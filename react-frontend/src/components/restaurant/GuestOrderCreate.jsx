import React, { useEffect, useMemo, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./GuestOrderCreate.css";

const currencyNGN = (value) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" })
    .format(Number(value || 0));

const GuestOrderCreate = () => {
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [meals, setMeals] = useState([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [message, setMessage] = useState("");

  const [order, setOrder] = useState({
    location_id: "",
    order_type: "room_service", // room_service | dine_in | takeaway
    room_number: "",
    guest_name: "",
    status: "open",
    items: [], // [{ meal_id, quantity }]
  });

  const [newItem, setNewItem] = useState({ meal_id: "", quantity: 1 });

  // Auto-clear flash message
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(t);
  }, [message]);

  // Fetch dropdown data
  useEffect(() => {
    const api = axiosWithAuth();
    Promise.all([
      api.get("/restaurant/locations"),
      api.get("/restaurant/meal-categories"),
      api.get("/restaurant/meals"),
    ])
      .then(([locRes, catRes, mealRes]) => {
        setLocations(locRes.data || []);
        // sort by id asc if backend doesn’t already
        setCategories([...catRes.data].sort((a, b) => a.id - b.id));
        setMeals([...mealRes.data].sort((a, b) => a.id - b.id));
      })
      .catch(() => setMessage("❌ Failed to load dropdown data"));
  }, []);

  // Meals filtered by selected category
  const filteredMeals = useMemo(() => {
    if (!selectedCategoryId) return meals;
    return meals.filter((m) => String(m.category_id) === String(selectedCategoryId));
  }, [meals, selectedCategoryId]);

  const addItem = () => {
    if (!newItem.meal_id || Number(newItem.quantity) <= 0) return;
    setOrder((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          meal_id: Number(newItem.meal_id),
          quantity: Number(newItem.quantity),
        },
      ],
    }));
    setNewItem({ meal_id: "", quantity: 1 });
  };

  const removeItem = (idx) => {
    setOrder((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const submitOrder = async (e) => {
    e.preventDefault();

    // Basic validations
    if (!order.location_id) {
      setMessage("❌ Please select a location.");
      return;
    }
    if (order.items.length === 0) {
      setMessage("❌ Please add at least one meal item.");
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
        meal_id: Number(i.meal_id),
        quantity: Number(i.quantity),
      })),
    };

    try {
      await axiosWithAuth().post("/restaurant/orders/", payload);
      setMessage("✅ Guest order created successfully!");
      setOrder({
        location_id: "",
        order_type: "room_service",
        room_number: "",
        guest_name: "",
        status: "open",
        items: [],
      });
      setSelectedCategoryId("");
    } catch (err) {
      setMessage(
        err?.response?.data?.detail || "❌ Failed to create order."
      );
    }
  };

  // Compute total for table preview
  const rows = order.items.map((it) => {
    const meal = meals.find((m) => Number(m.id) === Number(it.meal_id));
    const unit = meal?.price || 0;
    const line = Number(unit) * Number(it.quantity || 0);
    return {
      name: meal?.name || "--",
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

        {/* Guest / Room */}
        <input
          type="text"
          placeholder="Guest Name (optional)"
          value={order.guest_name}
          onChange={(e) => setOrder({ ...order, guest_name: e.target.value })}
        />
        <input
          type="text"
          placeholder="Room Number (required for Room Service)"
          value={order.room_number}
          onChange={(e) => setOrder({ ...order, room_number: e.target.value })}
        />

        {/* Category filter */}
        <select
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          title="Filter meals by category"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Add Item */}
        <div className="guestorder-item-form">
          <select
            value={newItem.meal_id}
            onChange={(e) =>
              setNewItem({ ...newItem, meal_id: e.target.value })
            }
          >
            <option value="">-- Select Meal --</option>
            {filteredMeals.map((meal) => (
              <option key={meal.id} value={meal.id}>
                {meal.name} ({currencyNGN(meal.price)})
              </option>
            ))}
          </select>

          <input
            type="number"
            min="1"
            value={newItem.quantity}
            onChange={(e) =>
              setNewItem({ ...newItem, quantity: e.target.value })
            }
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
                <th>Meal</th>
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
                    <button
                      type="button"
                      className="delete action-btn"
                      onClick={() => removeItem(i)}
                    >
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
