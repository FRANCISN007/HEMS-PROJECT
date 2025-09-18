import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListBarSales.css";

const ListBarSales = () => {
  const [sales, setSales] = useState([]);
  const [bars, setBars] = useState([]);
  const [items, setItems] = useState([]);
  const [editingSale, setEditingSale] = useState(null);
  const [message, setMessage] = useState("");
  const [barId, setBarId] = useState("");

  // ✅ Default both start and end date to today
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);


  // 🔽 Fetch sales with filters
  const fetchSales = async () => {
    try {
      const params = {};
      if (barId) params.bar_id = barId;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await axiosWithAuth().get("/bar/sales", { params });
      setSales(res.data.sales || []);
    } catch (err) {
      console.error("❌ Failed to fetch sales:", err);
    }
  };

  // 🔽 Fetch bars
  const fetchBars = async () => {
    try {
      const res = await axiosWithAuth().get("/bar/bars/simple");
      setBars(res.data || []);
    } catch (err) {
      console.error("❌ Failed to fetch bars:", err);
    }
  };

  // 🔽 Fetch items
  const fetchItems = async () => {
    try {
      const res = await axiosWithAuth().get("/store/items/simple");
      setItems(res.data || []);
    } catch (err) {
      console.error("❌ Failed to fetch items:", err);
    }
  };

  useEffect(() => {
    fetchSales();
    fetchBars();
    fetchItems();
  }, []);

  // 🕒 Auto clear messages after 3s
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // 🔄 Handle delete
  const handleDelete = async (saleId) => {
    if (!window.confirm("Are you sure you want to delete this sale?")) return;
    try {
      await axiosWithAuth().delete(`/bar/sales/${saleId}`);
      setMessage("✅ Sale deleted successfully!");
      fetchSales();
    } catch (err) {
      console.error("❌ Delete failed:", err);
      setMessage(err.response?.data?.detail || "❌ Failed to delete sale.");
    }
  };

  // ✏️ Handle edit
  const handleEdit = (sale) => {
    setEditingSale({
      ...sale,
      items: sale.sale_items.map((i) => ({
        item_id: i.item_id,
        quantity: i.quantity,
        selling_price: i.selling_price,
      })),
    });
  };

  // 💾 Submit edit
  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axiosWithAuth().put(`/bar/sales/${editingSale.id}`, {
        bar_id: editingSale.bar_id,
        items: editingSale.items.map((i) => ({
          item_id: parseInt(i.item_id),
          quantity: parseInt(i.quantity),
          selling_price: parseFloat(i.selling_price),
        })),
      });
      setMessage("✅ Sale updated successfully!");
      setEditingSale(null);
      fetchSales();
    } catch (err) {
      console.error("❌ Update failed:", err);
      setMessage(err.response?.data?.detail || "❌ Failed to update sale.");
    }
  };

  const updateItemField = (index, field, value) => {
    const updated = [...editingSale.items];
    updated[index][field] =
      field === "quantity"
        ? parseInt(value || 0)
        : parseFloat(value || 0);
    setEditingSale({ ...editingSale, items: updated });
  };

  // 🔢 Totals
  const totalEntries = sales.length;
  const totalAmount = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

  return (
    <div className="list-bar-sales-container1">
      <h2 className="page-heading">📋 Bar Sales List</h2>

      {message && <div className="message">{message}</div>}

      {/* 🔎 Filters + Totals in one top-bar */}
      <div className="top-bar">
      {/* 🔎 Filters in one compact line */}
      <div className="filters">
        <label>Bar:</label>
        <select value={barId} onChange={(e) => setBarId(e.target.value)}>
          <option value="">-- All Bars --</option>
          {bars.map((bar) => (
            <option key={bar.id} value={bar.id}>
              {bar.name}
            </option>
          ))}
        </select>

        <label>Start Date:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        <label>End Date:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />

        <button onClick={fetchSales}>🔍 Apply</button>
      </div>

      {/* ✅ Compact summary */}
      <div className="totals compact-summary">
        <span>Entries: <strong>{totalEntries}</strong></span>
        <span>Amount: <strong>₦{totalAmount.toLocaleString()}</strong></span>
      </div>
    </div>

      {/* Wrapped content in a professional container */}
      <div className="data-container1">
        <table className="sales-table1">
          <thead>
            <tr>
              <th>Sale ID</th>   {/* 👈 Added */}
              <th>Date</th>
              <th>Bar</th>
              <th>Items</th>
              <th>Total Amount</th>
              <th>Created By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale, idx) => (
              <tr key={sale.id} className={idx % 2 === 0 ? "even" : "odd"}>
                <td>{sale.id}</td>   {/* 👈 Added */}
                <td>{new Date(sale.sale_date).toLocaleDateString()}</td>
                <td>{sale.bar_name}</td>
                
                <td>
                  {sale.sale_items.map((i, iidx) => (
                    <div key={iidx}>
                      {i.item_name} - {i.quantity} @ ₦{i.selling_price}
                    </div>
                
                  ))}
                </td>
                <td>₦{sale.total_amount.toLocaleString()}</td>
                <td>{sale.created_by}</td>
                <td>
                  <button onClick={() => handleEdit(sale)}>✏ Edit</button>
                  <button onClick={() => handleDelete(sale.id)}>🗑 Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingSale && (
        <div className="modal-overlay2">
          <div className="modal2">
            <h3 className="modal-title">✏️ Edit Sale</h3>

            <form onSubmit={handleUpdate} className="edit-sale-form">
              <div className="form-group">
                <label>Bar</label>
                <select value={editingSale.bar_id} disabled>
                  {bars.map((bar) => (
                    <option key={bar.id} value={bar.id}>
                      {bar.name}
                    </option>
                  ))}
                </select>
              </div>

              {editingSale.items.map((item, idx) => (
                <div key={idx} className="sale-item-card">
                  <h4>Item {idx + 1}</h4>

                  <div className="form-row">
                    <label>Item</label>
                    <select
                      value={item.item_id}
                      onChange={(e) =>
                        updateItemField(idx, "item_id", e.target.value)
                      }
                    >
                      <option value="">-- Select Item --</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} ({it.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <label>Quantity</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItemField(idx, "quantity", e.target.value)
                      }
                    />
                  </div>

                  <div className="form-row">
                    <label>Selling Price (₦)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.selling_price}
                      onChange={(e) =>
                        updateItemField(idx, "selling_price", e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}

              <div className="total-box">
                <strong>Total: ₦
                  {editingSale.items
                    .reduce(
                      (sum, i) =>
                        sum + (i.quantity || 0) * (i.selling_price || 0),
                      0
                    )
                    .toLocaleString()}
                </strong>
              </div>

              <div className="modal-actions2">
                <button type="submit" className="btn-save">💾 Save</button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setEditingSale(null)}
                >
                  ❌ Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ListBarSales;
