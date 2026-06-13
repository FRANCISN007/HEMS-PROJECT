import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./OrderToSales.css";

// -------------------------
// Config
// -------------------------
const HIGH_VALUE_LIMIT = 50000; // ₦50,000

// -------------------------
// Currency formatter
// -------------------------
const formatCurrency = (amount = 0) =>
  `₦${Number(amount).toLocaleString("en-NG")}`;

// -------------------------
// Order total calculator
// -------------------------
const calculateOrderTotal = (order) =>
  (order.items || []).reduce(
    (sum, item) => sum + Number(item.total_price || 0),
    0
  );

const OrderToSales = () => {
  const today = new Date().toISOString().split("T")[0];

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const [servedBy, setServedBy] = useState("");
  const [locationId, setLocationId] = useState("");
  const [locations, setLocations] = useState([]);

  // ✅ NEW SALES DATE STATE
  const [salesDate, setSalesDate] = useState(today);

  const [totals, setTotals] = useState({
    total_entries: 0,
    total_amount: 0,
  });

  // -------------------------
  // ROLE + USER INFO
  // -------------------------
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};

  let roles = [];

  if (Array.isArray(storedUser.roles)) {
    roles = storedUser.roles;
  } else if (typeof storedUser.role === "string") {
    roles = [storedUser.role];
  }

  roles = roles.map((r) => r.toLowerCase());

  const autoWaiterName =
    storedUser.full_name ||
    storedUser.name ||
    storedUser.username ||
    "";

  // -------------------------
  // ACCESS CONTROL
  // -------------------------
  if (!(roles.includes("admin") || roles.includes("restaurant"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to create restaurant sales.</p>
      </div>
    );
  }

  // -------------------------
  // FETCH LOCATIONS
  // -------------------------
  const fetchLocations = async () => {
    try {
      const res = await axiosWithAuth().get("/restaurant/locations");
      setLocations(res.data || []);
    } catch (err) {
      console.error("❌ Failed to fetch locations:", err);
    }
  };

  // -------------------------
  // FETCH OPEN ORDERS
  // -------------------------
  const fetchOrders = async (locId) => {
    if (!locId) return;

    setLoading(true);

    try {
      const res = await axiosWithAuth().get("/restaurant/open", {
        params: {
          location_id: locId,
        },
      });

      const data = res.data || {};

      setOrders(data.orders || []);

      setTotals({
        total_entries: data.total_entries || 0,
        total_amount: data.total_amount || 0,
      });
    } catch (err) {
      console.error("❌ Error fetching orders:", err);

      setOrders([]);

      setTotals({
        total_entries: 0,
        total_amount: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // CREATE SALE
  // -------------------------
  const handleCreateSale = async (order) => {
    if (!servedBy.trim()) {
      alert("Please enter served by name.");
      return;
    }

    if (!salesDate) {
      alert("Please select sales date.");
      return;
    }

    const orderTotal = calculateOrderTotal(order);

    const confirmed = window.confirm(
      `Convert Order #${order.id} to sale?\n\nTotal: ${formatCurrency(
        orderTotal
      )}\nSales Date: ${salesDate}`
    );

    if (!confirmed) return;

    try {
      await axiosWithAuth().post(
        `/restaurant/sales/from-order/${order.id}`,
        {
          served_by: servedBy.trim(),
          sales_date: salesDate
            ? new Date(salesDate).toISOString()
            : null,
        }
      );

      // Refresh list
      fetchOrders(locationId);

      alert("✅ Sale created successfully.");
    } catch (err) {
      console.error("❌ Failed to create sale:", err);

      alert(
        err?.response?.data?.detail ||
          "Failed to create sale."
      );
    }
  };

  // -------------------------
  // INIT
  // -------------------------
  useEffect(() => {
    fetchLocations();

    if (autoWaiterName) {
      setServedBy(autoWaiterName);
    }
  }, []);

  // -------------------------
  // RENDER
  // -------------------------
  return (
    <div className="order-to-sales">
      <h2>💰 Convert Orders to Sales</h2>

      {/* FILTERS */}
      <div className="filters">
        {/* Served By */}
        <div>
          <label>Served By</label>

          <input
            type="text"
            value={servedBy}
            onChange={(e) => setServedBy(e.target.value)}
            placeholder="Waiter / Staff name"
          />
        </div>

        {/* Sales Date */}
        <div>
          <label>Sales Date</label>

          <input
            type="date"
            value={salesDate}
            onChange={(e) => setSalesDate(e.target.value)}
          />
        </div>

        {/* Location */}
        <div>
          <label>Location</label>

          <select
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value);
              fetchOrders(e.target.value);
            }}
          >
            <option value="">
              -- Select Location --
            </option>

            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* CONTENT */}
      {!locationId ? (
        <p className="hint-text">
          Select a location to view open orders.
        </p>
      ) : loading ? (
        <p>Loading open orders...</p>
      ) : orders.length === 0 ? (
        <p className="no-orders">
          No open orders for this location.
        </p>
      ) : (
        <>
          {/* TOTALS */}
          <div className="totals">
            <span>
              Orders: {totals.total_entries}
            </span>

            <span>
              Total: {formatCurrency(totals.total_amount)}
            </span>
          </div>

          {/* ORDERS */}
          <ul className="orders-list">
            {orders.map((order) => {
              const orderTotal =
                calculateOrderTotal(order);

              const isHighValue =
                orderTotal >= HIGH_VALUE_LIMIT;

              return (
                <li
                  key={order.id}
                  className={`order-card ${
                    isHighValue ? "high-value" : ""
                  }`}
                >
                  {/* HEADER */}
                  <div className="order-header">
                    <strong>
                      Order #{order.id} –{" "}
                      {order.order_type?.toLowerCase()}
                    </strong>

                    {isHighValue && (
                      <span className="badge">
                        🔥 High Value
                      </span>
                    )}
                  </div>

                  {/* ITEMS */}
                  <div className="order-items">
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="order-item"
                      >
                        <span>
                          {item.item_name} ×{" "}
                          {item.quantity}
                        </span>

                        <span>
                          {formatCurrency(
                            item.total_price
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* FOOTER */}
                  <div className="order-footer">
                    <button
                      className="create-sale-btn"
                      disabled={
                        !servedBy.trim() || !salesDate
                      }
                      onClick={() =>
                        handleCreateSale(order)
                      }
                    >
                      ➕ Create Sale
                    </button>

                    <span className="order-total">
                      Total:{" "}
                      {formatCurrency(orderTotal)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};

export default OrderToSales;