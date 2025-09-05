import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./OrderToSales.css";

const OrderToSales = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [servedBy, setServedBy] = useState("");
  const [locationId, setLocationId] = useState(""); // ✅ state for location filter
  const [locations, setLocations] = useState([]);   // ✅ store available locations
  const [totals, setTotals] = useState({ total_entries: 0, total_amount: 0 });

  // Fetch available locations
  const fetchLocations = async () => {
    try {
      const res = await axiosWithAuth().get("/restaurant/locations");
      setLocations(res.data || []);
    } catch (err) {
      console.error("❌ Error fetching locations:", err);
    }
  };

  // Fetch open orders
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await axiosWithAuth().get("/restaurant/open", {
        params: locationId ? { location_id: locationId } : {},
      });

      const data = res.data;
      setOrders(data.orders || []);
      setTotals({
        total_entries: data.total_entries || 0,
        total_amount: data.total_amount || 0,
      });
    } catch (err) {
      console.error("❌ Error fetching orders:", err);
      setOrders([]);
      setTotals({ total_entries: 0, total_amount: 0 });
    }
    setLoading(false);
  };

  // Create sale from order
  const handleCreateSale = async (orderId) => {
    if (!servedBy.trim()) {
      alert("Please enter the name of the server before creating a sale.");
      return;
    }
    if (!locationId) {
      alert("Please select a location.");
      return;
    }

    try {
      await axiosWithAuth().post(
        `/restaurant/sales/from-order/${orderId}`,
        null,
        {
          params: { served_by: servedBy, location_id: locationId }, // ✅ send both
        }
      );

      fetchOrders();
    } catch (err) {
      console.error("❌ Error creating sale:", err);
      alert(err.response?.data?.detail || "Failed to create sale.");
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (locationId) {
      fetchOrders();
    }
  }, [locationId]);

  return (
    <div className="order-to-sales">
      <h2>💰 Create Sales from Open Orders</h2>

      <div className="filters">
        <div>
          <label>Served By:</label>
          <input
            type="text"
            value={servedBy}
            onChange={(e) => setServedBy(e.target.value)}
            placeholder="Enter server's name"
          />
        </div>

        <div>
          <label>Location:</label>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">-- Select Location --</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p>Loading open orders...</p>
      ) : orders.length === 0 ? (
        <p className="no-orders">No open orders available for sales.</p>
      ) : (
        <>
          <div className="totals">
            <span>Total Open Orders: {totals.total_entries}</span>
            <span>Total Amount: ₦{totals.total_amount.toFixed(2)}</span>
          </div>

          <ul className="orders-list">
            {orders.map((order) => (
              <li key={order.id} className="order-card">
                <div className="order-header">
                  <strong>Order #{order.id}</strong> — {order.guest_name} (
                  {order.order_type})
                </div>

                <div className="order-items">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="order-item">
                      <span>
                        {item.meal_name} × {item.quantity}
                      </span>
                      <span>₦{item.total_price?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="order-footer">
                  <button
                    className="create-sale-btn"
                    onClick={() => handleCreateSale(order.id)}
                  >
                    ➕ Create Sale
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default OrderToSales;
