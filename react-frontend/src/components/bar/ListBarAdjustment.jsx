import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListBarAdjustment.css";

const ListBarAdjustment = () => {
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [bars, setBars] = useState([]);
  const [items, setItems] = useState([]);
  const [barId, setBarId] = useState("");
  const [itemId, setItemId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ⏬ fetch bars for dropdown
  useEffect(() => {
    const fetchBars = async () => {
      try {
        const res = await axiosWithAuth().get("/bar/bars/simple");
        setBars(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("❌ Failed to fetch bars:", err);
      }
    };
    fetchBars();
  }, []);

  // ⏬ fetch items for dropdown
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await axiosWithAuth().get("/store/items/simple");
        setItems(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("❌ Failed to fetch items:", err);
      }
    };
    fetchItems();
  }, []);

  // ⏬ fetch adjustments
  useEffect(() => {
    fetchAdjustments();
  }, []);

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const res = await axiosWithAuth().get("/bar/adjustments", {
        params: {
          bar_id: barId || undefined,
          item_id: itemId || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
      });
      setAdjustments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("❌ Failed to fetch adjustments:", err);
      setMessage("❌ Failed to load adjustments.");
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (e) => {
    e.preventDefault();
    fetchAdjustments();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this adjustment?")) {
      return;
    }

    try {
      await axiosWithAuth().delete(`/bar/adjustments/${id}`);
      setMessage("✅ Adjustment deleted successfully!");
      setAdjustments(adjustments.filter((adj) => adj.id !== id));
    } catch (err) {
      console.error("❌ Delete failed:", err);
      setMessage(err.response?.data?.detail || "❌ Failed to delete adjustment.");
    } finally {
      setTimeout(() => setMessage(""), 3000);
    }
  };

  if (loading) {
    return <p className="bar-message">⏳ Loading adjustments...</p>;
  }

  return (
    <div className="adjustment-container">
      <div className="adjustment-header">
        <h2>🔧 Bar Stock Adjustments</h2>
      </div>

      {/* Filters */}
      <form className="filter-controls" onSubmit={handleFilter}>
        <select value={barId} onChange={(e) => setBarId(e.target.value)}>
          <option value="">-- Select Bar --</option>
          {bars.map((bar) => (
            <option key={bar.id} value={bar.id}>
              {bar.name}
            </option>
          ))}
        </select>

        <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">-- Select Item --</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.unit})
            </option>
          ))}
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

        <button type="submit">🔍 Filter</button>
      </form>

      {/* Table */}
      <div className="table-wrapper">
        <table className="adjustment-table">
          <thead>
            <tr>
              <th>Bar</th>
              <th>Item</th>
              <th>Quantity Adjusted</th>
              <th>Reason</th>
              <th>Adjusted By</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.length > 0 ? (
              adjustments.map((adj, index) => {
                const bar = bars.find((b) => b.id === adj.bar_id);
                const item = items.find((i) => i.id === adj.item_id);
                return (
                  <tr
                    key={adj.id}
                    className={index % 2 === 0 ? "even-row" : "odd-row"}
                  >
                    <td>{bar ? bar.name : adj.bar_id}</td>
                    <td>{item ? item.name : adj.item_id}</td>
                    <td>{adj.quantity_adjusted}</td>
                    <td>{adj.reason}</td>
                    <td>{adj.adjusted_by}</td>
                    <td>{new Date(adj.adjusted_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(adj.id)}
                      >
                        🗑 Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="no-data">
                  No adjustments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {message && <p className="bar-message">{message}</p>}
    </div>
  );
};

export default ListBarAdjustment;
