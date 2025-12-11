import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./StoreToBarControl.css";

const StoreToBarControl = () => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [bars, setBars] = useState([]);
  const [barId, setBarId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const user = JSON.parse(localStorage.getItem("user")) || {};
  const roles = Array.isArray(user.roles) ? user.roles : [user.role];

  if (!(roles.includes("admin") || roles.includes("bar"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to view store control</p>
      </div>
    );
  }

  // Fetch list of bars
  useEffect(() => {
    const fetchBars = async () => {
      try {
        const res = await axiosWithAuth().get("/bar/bars/simple");
        setBars(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("❌ Failed to fetch bars:", err);
        setBars([]);
      }
    };
    fetchBars();
  }, []);

  // Default date = today
  useEffect(() => {
    const today = new Date();
    const formatDate = (d) => d.toISOString().split("T")[0];
    setStartDate(formatDate(today));
    setEndDate(formatDate(today));
  }, []);

  // Fetch issues when filters change
  useEffect(() => {
    if (startDate && endDate) {
      fetchIssues();
    }
  }, [barId, startDate, endDate]);

  const fetchIssues = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await axiosWithAuth().get("/bar/store-issue-control", {
        params: {
          bar_id: barId || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
      });
      setIssues(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("❌ Failed to fetch store issue control:", err);
      setMessage(
        err.response?.data?.detail ||
          "❌ Failed to load store issue control data."
      );
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetToToday = () => {
    const today = new Date();
    const formatDate = (d) => d.toISOString().split("T")[0];
    setStartDate(formatDate(today));
    setEndDate(formatDate(today));
    setBarId("");
  };

  if (loading) {
    return <p className="bar-message">⏳ Loading store issue control...</p>;
  }

  return (
    <div className="bar-container">
      <div className="bar-header">
        <h2>🏪 Store Issues Control</h2>
      </div>

      {/* Filters */}
      <div className="filter-controls">
        <select value={barId} onChange={(e) => setBarId(e.target.value)}>
          <option value="">-- Select Bar --</option>
          {bars.map((bar) => (
            <option key={bar.id} value={bar.id}>
              {bar.name}
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

        <button type="button" className="reset-btn" onClick={handleResetToToday}>
          🔄 Reset to Today
        </button>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="bar-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Unit</th>
              <th>Bar</th>
              <th>Issue Date</th>
              <th>Quantity</th>
              
            </tr>
          </thead>
          <tbody>
            {issues.length > 0 ? (
              issues.map((item, index) => {
                const bar = bars.find((b) => Number(b.id) === Number(item.bar_id));
                return (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? "even-row" : "odd-row"}
                  >
                    <td>{item.item_name || "-"}</td>
                    <td>{item.unit || "-"}</td>
                    <td>{bar ? bar.name : item.bar_id || "-"}</td>
                    <td>
                      {item.issue_date
                        ? new Date(item.issue_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{item.quantity ?? "-"}</td>
                    
                    
                  </tr>
                  );
                })
              ) : (
              <tr>
                <td colSpan="7" className="no-data">
                  No data found.
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

export default StoreToBarControl;
