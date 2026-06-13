import React, { useEffect, useState, useRef } from "react";
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

  const axios = axiosWithAuth();

  // =========================
  // 🔥 SEARCH OPTIMIZATION
  // =========================
  const searchTimer = useRef(null);
  const searchCache = useRef({});

  const storedUser =
    JSON.parse(localStorage.getItem("user")) || {};

  let roles = Array.isArray(storedUser.roles)
    ? storedUser.roles
    : typeof storedUser.role === "string"
    ? [storedUser.role]
    : [];

  roles = roles.map((r) => r.toLowerCase());

  if (
    !(
      roles.includes("admin") ||
      roles.includes("restaurant")
    )
  ) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>
          You do not have permission to create guest
          order.
        </p>
      </div>
    );
  }

  // =========================
  // 🔥 ORDER STATE
  // =========================
  const [order, setOrder] = useState({
    location_id: "",
    kitchen_id: "",
    order_type: "room_service",
    room_number: "",
    guest_name: "",
    status: "open",

    // ✅ NEW SALES DATE
    sales_date:
      new Date().toISOString().split("T")[0],

    items: [],
  });

  // =========================
  // 🔥 NEW ITEM STATE
  // =========================
  const [newItem, setNewItem] = useState({
    store_item_id: "",
    quantity: 1,
    price_per_unit: "",
    search: "",
    suggestions: [],
    selectedItem: null,
  });

  // =========================
  // AUTO CLEAR MESSAGE
  // =========================
  useEffect(() => {
    if (!message) return;

    const t = setTimeout(() => {
      setMessage("");
    }, 3000);

    return () => clearTimeout(t);
  }, [message]);

  // =========================
  // LOAD DROPDOWNS
  // =========================
  useEffect(() => {
    Promise.all([
      axios.get("/restaurant/locations"),
      axios.get("/kitchen/simple"),
    ])
      .then(([locRes, kitRes]) => {
        setLocations(locRes.data || []);
        setKitchens(kitRes.data || []);
      })
      .catch(() =>
        setMessage("❌ Failed to load dropdown data")
      );
  }, []);

  // =========================
  // SEARCH ITEMS
  // =========================
  const fetchItems = async (searchText) => {
    if (!searchText) return [];

    if (searchCache.current[searchText]) {
      return searchCache.current[searchText];
    }

    try {
      const res = await axios.get(
        "/restaurant/items/store-selling",
        {
          params: {
            search: searchText,
          },
        }
      );

      const data = Array.isArray(res.data)
        ? res.data
        : [];

      searchCache.current[searchText] = data;

      return data;
    } catch {
      return [];
    }
  };

  // =========================
  // HANDLE ITEM CHANGE
  // =========================
  const handleNewItemChange = (field, value) => {
    const updated = {
      ...newItem,
      [field]: value,
    };

    // -------------------------
    // SEARCH
    // -------------------------
    if (field === "search") {
      updated.store_item_id = "";
      updated.price_per_unit = "";
      updated.selectedItem = null;

      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }

      if (!value || value.length < 2) {
        updated.suggestions = [];
        setNewItem(updated);
        return;
      }

      searchTimer.current = setTimeout(async () => {
        const results = await fetchItems(value);

        setNewItem((prev) => ({
          ...prev,
          suggestions: results,
        }));
      }, 300);
    }

    // -------------------------
    // SELECT ITEM
    // -------------------------
    if (field === "store_item_id") {
      const selected = updated.suggestions.find(
        (i) => i.id === Number(value)
      );

      if (selected) {
        updated.store_item_id = selected.id;
        updated.price_per_unit =
          selected.selling_price || 0;

        updated.search = selected.name;

        updated.selectedItem = selected;
      }

      updated.suggestions = [];
    }

    setNewItem(updated);
  };

  // =========================
  // ADD ITEM
  // =========================
  const addItem = () => {
    if (
      !newItem.store_item_id ||
      Number(newItem.quantity) <= 0
    ) {
      return;
    }

    setOrder((prev) => ({
      ...prev,

      items: [
        ...prev.items,

        {
          store_item_id: Number(
            newItem.store_item_id
          ),

          quantity: Number(newItem.quantity),

          price_per_unit: Number(
            newItem.price_per_unit
          ),

          selectedItem: newItem.selectedItem,
        },
      ],
    }));

    setNewItem({
      store_item_id: "",
      quantity: 1,
      price_per_unit: "",
      search: "",
      suggestions: [],
      selectedItem: null,
    });
  };

  // =========================
  // REMOVE ITEM
  // =========================
  const removeItem = (idx) => {
    setOrder((prev) => ({
      ...prev,

      items: prev.items.filter(
        (_, i) => i !== idx
      ),
    }));
  };

  // =========================
  // SUBMIT ORDER
  // =========================
  const submitOrder = async (e) => {
    e.preventDefault();

    if (!order.location_id) {
      return setMessage(
        "❌ Please select a location."
      );
    }

    if (!order.kitchen_id) {
      return setMessage(
        "❌ Please select a kitchen."
      );
    }

    if (
      order.order_type === "room_service" &&
      !order.room_number
    ) {
      return setMessage(
        "❌ Room Service requires a room number."
      );
    }

    if (!order.sales_date) {
      return setMessage(
        "❌ Please select order date."
      );
    }

    if (order.items.length === 0) {
      return setMessage(
        "❌ Please add at least one item."
      );
    }

    // =========================
    // 🔥 PAYLOAD
    // =========================
    const payload = {
      ...order,

      location_id: Number(order.location_id),

      kitchen_id: Number(order.kitchen_id),

      // ✅ IMPORTANT
      sales_date: order.sales_date,

      items: order.items.map((i) => ({
        store_item_id: Number(
          i.store_item_id
        ),

        quantity: Number(i.quantity),

        price_per_unit:
          Number(i.price_per_unit) || 0,
      })),
    };

    try {
      await axios.post(
        "/restaurant/meal-orders",
        payload
      );

      setMessage(
        "✅ Guest order created successfully!"
      );

      // =========================
      // RESET
      // =========================
      setOrder({
        location_id: "",
        kitchen_id: "",
        order_type: "room_service",
        room_number: "",
        guest_name: "",
        status: "open",

        // ✅ RESET DATE
        sales_date:
          new Date()
            .toISOString()
            .split("T")[0],

        items: [],
      });

      setNewItem({
        store_item_id: "",
        quantity: 1,
        price_per_unit: "",
        search: "",
        suggestions: [],
        selectedItem: null,
      });
    } catch (err) {
      setMessage(
        err?.response?.data?.detail ||
          "❌ Failed to create order."
      );
    }
  };

  // =========================
  // TABLE ROWS
  // =========================
  const rows = order.items.map((it) => {
    const storeItem = it.selectedItem || {};

    const unit =
      Number(it.price_per_unit) ||
      Number(storeItem.selling_price) ||
      0;

    return {
      name: storeItem.name || "--",

      type:
        storeItem.item_type?.toUpperCase() || "",

      quantity: it.quantity,

      unitPrice: unit,

      lineTotal: unit * it.quantity,
    };
  });

  const grandTotal = rows.reduce(
    (sum, r) => sum + r.lineTotal,
    0
  );

  // =========================
  // UI
  // =========================
  return (
    <div className="guestorder-container">
      <h2>🧾 Create Guest Order</h2>

      {message && (
        <p className="guestorder-message">
          {message}
        </p>
      )}

      <form
        className="guestorder-form"
        onSubmit={submitOrder}
      >
        {/* LOCATION */}
        <select
          value={order.location_id}
          onChange={(e) =>
            setOrder({
              ...order,
              location_id: e.target.value,
            })
          }
        >
          <option value="">
            -- Select Location --
          </option>

          {locations.map((loc) => (
            <option
              key={loc.id}
              value={loc.id}
            >
              {loc.name}
            </option>
          ))}
        </select>

        {/* KITCHEN */}
        <select
          value={order.kitchen_id}
          onChange={(e) =>
            setOrder({
              ...order,
              kitchen_id: e.target.value,
            })
          }
        >
          <option value="">
            -- Select Kitchen --
          </option>

          {kitchens.map((k) => (
            <option
              key={k.id}
              value={k.id}
            >
              {k.name}
            </option>
          ))}
        </select>

        {/* ORDER TYPE */}
        <select
          value={order.order_type}
          onChange={(e) =>
            setOrder({
              ...order,
              order_type: e.target.value,
            })
          }
        >
          <option value="room_service">
            Room Service
          </option>

          <option value="dine_in">
            Dine In
          </option>

          <option value="takeaway">
            Takeaway
          </option>
        </select>

        {/* ✅ ORDER DATE */}
        <input
          type="date"
          value={order.sales_date}
          onChange={(e) =>
            setOrder({
              ...order,
              sales_date: e.target.value,
            })
          }
        />

        {/* GUEST NAME */}
        <input
          placeholder="Guest Name (optional)"
          value={order.guest_name}
          onChange={(e) =>
            setOrder({
              ...order,
              guest_name: e.target.value,
            })
          }
        />

        {/* ROOM NUMBER */}
        <input
          placeholder="Room Number (required for room service)"
          value={order.room_number}
          onChange={(e) =>
            setOrder({
              ...order,
              room_number: e.target.value,
            })
          }
        />

        {/* =========================
            SEARCH ITEM
        ========================= */}
        <div className="guestorder-item-form">
          <input
            placeholder="Type to search item..."
            value={newItem.search}
            onChange={(e) =>
              handleNewItemChange(
                "search",
                e.target.value
              )
            }
          />

          {/* SUGGESTIONS */}
          {newItem.suggestions.length > 0 && (
            <ul className="suggestions-list">
              {newItem.suggestions.map(
                (item) => (
                  <li
                    key={item.id}
                    onClick={() =>
                      handleNewItemChange(
                        "store_item_id",
                        item.id
                      )
                    }
                  >
                    {item.name} (
                    {currencyNGN(
                      item.selling_price
                    )}
                    )
                  </li>
                )
              )}
            </ul>
          )}

          {/* QUANTITY */}
          <input
            type="number"
            value={newItem.quantity}
            onChange={(e) =>
              handleNewItemChange(
                "quantity",
                e.target.value
              )
            }
          />

          {/* PRICE */}
          <input
            type="number"
            value={newItem.price_per_unit}
            onChange={(e) =>
              handleNewItemChange(
                "price_per_unit",
                e.target.value
              )
            }
          />

          {/* ADD ITEM */}
          <button
            type="button"
            onClick={addItem}
          >
            ➕ Add Item
          </button>
        </div>

        {/* =========================
            ITEMS TABLE
        ========================= */}
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

                  <td>
                    {currencyNGN(r.unitPrice)}
                  </td>

                  <td>
                    {currencyNGN(r.lineTotal)}
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        removeItem(i)
                      }
                    >
                      ❌
                    </button>
                  </td>
                </tr>
              ))}

              <tr>
                <td
                  colSpan="3"
                  style={{
                    textAlign: "right",
                    fontWeight: 600,
                  }}
                >
                  Total
                </td>

                <td
                  style={{
                    fontWeight: 700,
                  }}
                >
                  {currencyNGN(grandTotal)}
                </td>

                <td />
              </tr>
            </tbody>
          </table>
        )}

        {/* SUBMIT */}
        <button type="submit">
          ✅ Create Order
        </button>
      </form>
    </div>
  );
};

export default GuestOrderCreate;