import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./KitchenBalanceStock.css";

const KitchenBalanceStock = () => {
  const [balances, setBalances] = useState([]);
  const [kitchens, setKitchens] = useState([]);

  const [selectedKitchen, setSelectedKitchen] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const axios = axiosWithAuth();

  /* ================= AUTH ================= */
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = Array.isArray(storedUser.roles)
    ? storedUser.roles
    : storedUser.role
    ? [storedUser.role]
    : [];

  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("store"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to view kitchen stock.</p>
      </div>
    );
  }

  /* ================= FETCH ================= */
  useEffect(() => {
    fetchKitchens();
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => {
      fetchStockBalances();
    }, 300);

    return () => clearTimeout(delay);
  }, [selectedKitchen, startDate, endDate, search, selectedItemId]);

  const fetchKitchens = async () => {
    try {
      const res = await axios.get("/kitchen/simple");
      setKitchens(res.data || []);
    } catch (error) {
      console.error(error);
      setKitchens([]);
    }
  };

  const fetchStockBalances = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/store/kitchen-balance-stock", {
        params: {
          kitchen_id: selectedKitchen || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          item_id: selectedItemId || undefined,
          search: search || undefined,
        },
      });
      setBalances(res.data || []);
    } catch (error) {
      console.error(error);
      setMessage("❌ Failed to load kitchen stock balances");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  /* ================= TOTALS ================= */
  const totalStockAmount = balances.reduce(
    (sum, row) => sum + (row.balance_total_amount || 0),
    0
  );

  const totalStockBalance = balances.reduce(
    (sum, row) => sum + (row.balance || 0),
    0
  );

  /* ================= UI ================= */
  return (
    <div className="stock-balance-container2">
      <div className="stock-balance-header">
        <h2>👨‍🍳 Kitchen Stock Balance Report</h2>

        <div className="filter-frame2">
          {/* Kitchen */}
          <div className="filter-group2 kitchen-filter">
            <label>Kitchen</label>
            <select
              value={selectedKitchen}
              onChange={(e) => setSelectedKitchen(e.target.value)}
            >
              <option value="">All Kitchens</option>
              {kitchens.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="filter-group2">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="filter-group2">
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Search */}
          <div className="filter-group2 search-filter">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search item..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedItemId("");
              }}
            />
          </div>

          {/* Item */}
          <div className="filter-group2 item-filter">
            <label>Item</label>
            <select
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                setSearch("");
              }}
            >
              <option value="">All Items</option>
              {balances.map((item) => (
                <option key={item.item_id} value={item.item_id}>
                  {item.item_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="total-stock2">
          <div>Total Value: <strong>₦{totalStockAmount.toLocaleString()}</strong></div>
          <div>Total Balance: <strong>{totalStockBalance.toLocaleString()}</strong></div>
        </div>
      </div>

      {message && <div className="message">{message}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="table-scroll-container">
          <table>
            <thead>
              <tr>
                <th>Kitchen</th>
                <th>Item</th>
                <th>Unit</th>
                <th>Category</th>
                <th>Type</th>
                <th>Issued</th>
                <th>Used</th>
                <th>Adjusted</th>
                <th>Balance</th>
                <th>Unit Price</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((row, index) => (
                <tr
                  key={`${row.kitchen_id}-${row.item_id}`}
                  className={index % 2 === 0 ? "even-row" : "odd-row"}
                >
                  <td>{row.kitchen_name}</td>
                  <td>{row.item_name}</td>
                  <td>{row.unit}</td>
                  <td>{row.category_name}</td>
                  <td>{row.item_type}</td>
                  <td>{row.total_issued}</td>
                  <td>{row.total_used}</td>
                  <td>{row.total_adjusted}</td>
                  <td><strong>{row.balance}</strong></td>
                  <td>
                    {row.last_unit_price
                      ? `₦${row.last_unit_price.toLocaleString()}`
                      : "-"}
                  </td>
                  <td>
                    {row.balance_total_amount
                      ? `₦${row.balance_total_amount.toLocaleString()}`
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default KitchenBalanceStock;