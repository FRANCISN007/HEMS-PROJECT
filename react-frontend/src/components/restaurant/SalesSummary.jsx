import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./SalesSummary.css";

const SalesSummary = () => {
  // ✅ Today’s default dates
  const getToday = () => new Date().toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());
  const [locationId, setLocationId] = useState("");
  const [locations, setLocations] = useState([]);

  const [itemSummary, setItemSummary] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(false);

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
        <p>You do not have permission to view sales summary.</p>
      </div>
    );
  }

  // ✅ Number formatting
  const formatAmount = (value) => {
    const num = Number(value) || 0;
    return new Intl.NumberFormat("en-NG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // ✅ Fetch locations
  const fetchLocations = async () => {
    try {
      const res = await axiosWithAuth().get("/restaurant/locations");
      setLocations(res.data || []);
    } catch (err) {
      console.error("❌ Error fetching locations:", err);
      setLocations([]);
    }
  };

  // ✅ Fetch sales summary
  const fetchSummary = async () => {
    setLoading(true);
    try {
      const params = {};
      if (locationId) params.location_id = locationId;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await axiosWithAuth().get("/restaurant/sales/items-summary", { params });

      // ✅ Use correct keys from backend
      setItemSummary(res.data.items || []);
      setGrandTotal(Number(res.data.summary?.grand_total) || 0);
    } catch (err) {
      console.error("❌ Error fetching summary:", err);
      setItemSummary([]);
      setGrandTotal(0);
    }
    setLoading(false);
  };

  // ✅ Load on mount
  useEffect(() => {
    fetchLocations();
    fetchSummary();
  }, []);

  // ✅ Refetch when filters change
  useEffect(() => {
    fetchSummary();
  }, [locationId, startDate, endDate]);

  return (
    <div className="sales-summary-page">
      <h2>📊 Restaurant Items Sales Summary</h2>

      {/* Filters */}
      <div className="filter-bar">
        <label>Location:</label>
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
        >
          <option value="">All Locations</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>

        <label>From:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        <label>To:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <p>Loading summary...</p>
      ) : itemSummary.length === 0 ? (
        <p>No sales records found for this period.</p>
      ) : (
        <div className="summary-table-container">
          <table className="summary-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price (₦)</th>
                <th>Amount (₦)</th>
              </tr>
            </thead>
            <tbody>
              {itemSummary.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.item}</td>
                  <td>{item.qty}</td>
                  <td>{formatAmount(item.price)}</td>
                  <td>{formatAmount(item.amount)}</td>
                </tr>
              ))}
              <tr className="grand-total-row">
                <td colSpan="3">
                  <strong>Total</strong>
                </td>
                <td>
                  <strong>₦{formatAmount(grandTotal)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SalesSummary;
