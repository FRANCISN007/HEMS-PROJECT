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

  // User roles
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const roles = user.roles || [];

  if (!(roles.includes("admin") || roles.includes("bar"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to list bar sales.</p>
      </div>
    );
  }

  // Default date = today
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const fetchSales = async () => {
    try {
      const params = {};
      if (barId) params.bar_id = barId;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await axiosWithAuth().get("/bar/sales", { params });
      setSales(res.data.sales || []);
    } catch (err) {
      console.error("Failed to fetch sales:", err);
    }
  };

  const fetchBars = async () => {
    try {
      const res = await axiosWithAuth().get("/bar/bars/simple");
      setBars(res.data || []);
    } catch (err) {
      console.error("Failed to fetch bars:", err);
    }
  };

  const fetchItems = async () => {
    try {
      const res = await axiosWithAuth().get("/store/items/simple");
      setItems(res.data || []);
    } catch (err) {
      console.error("Failed to fetch items:", err);
    }
  };

  useEffect(() => {
    fetchSales();
    fetchBars();
    fetchItems();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleDelete = async (saleId) => {
    if (!window.confirm("Are you sure you want to delete this sale?")) return;
    try {
      await axiosWithAuth().delete(`/bar/sales/${saleId}`);
      setMessage("✅ Sale deleted successfully!");
      fetchSales();
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Failed to delete sale.");
    }
  };

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

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axiosWithAuth().put(`/bar/sales/${editingSale.id}`, {
        bar_id: editingSale.bar_id,
        items: editingSale.items,
      });
      setMessage("✅ Sale updated successfully!");
      setEditingSale(null);
      fetchSales();
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Failed to update sale.");
    }
  };

  const updateItemField = (index, field, value) => {
    const updated = [...editingSale.items];
    updated[index][field] = value;
    setEditingSale({ ...editingSale, items: updated });
  };

  const totalEntries = sales.length;
  const totalAmount = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

  return (
    <div className="list-bar-sales-container1">
      <h2 className="page-heading">📋 Bar Sales List</h2>

      {message && <div className="message">{message}</div>}

      {/* TOP BAR */}
      <div className="top-bar">
        {/* Filters */}
        <div className="filters">
          <label>Bar:</label>
          <select value={barId} onChange={(e) => setBarId(e.target.value)}>
            <option value="">All Bars</option>
            {bars.map((bar) => (
              <option key={bar.id} value={bar.id}>
                {bar.name}
              </option>
            ))}
          </select>

          <label>Start Date:</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />

          <label>End Date:</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

          <button onClick={fetchSales}>🔍 Apply</button>
        </div>

        {/* Summary */}
        <div className="compact-summary">
          <span>Entries: <strong>{totalEntries}</strong></span>
          <span>Amount: <strong>₦{totalAmount.toLocaleString()}</strong></span>
        </div>
      </div>

      {/* TABLE */}
      <div className="data-container1">
        <table className="sales-table1">
          <thead>
            <tr>
              <th>Sale ID</th>
              <th>Date</th>
              <th>Bar</th>
              <th>Items</th>
              <th>Total</th>
              <th>Created By</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {sales.map((sale, idx) => (
              <tr key={sale.id}>
                <td>{sale.id}</td>
                <td>{new Date(sale.sale_date).toLocaleDateString()}</td>
                <td>{sale.bar_name}</td>

                <td>
                  {sale.sale_items.map((it, i) => (
                    <div key={i}>
                      {it.item_name} – {it.quantity} × ₦{it.selling_price}
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


      {/* EDIT MODAL */}
      {editingSale && (
        <div className="modal-overlay2">
          <div className="modal2">
            <h3 className="modal-title">✏ Edit Sale</h3>

            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label>Bar</label>
                <select value={editingSale.bar_id} disabled>
                  {bars.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
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
                      onChange={(e) => updateItemField(idx, "item_id", e.target.value)}
                    >
                      <option value="">Select Item</option>
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
                      onChange={(e) => updateItemField(idx, "quantity", e.target.value)}
                    />
                  </div>

                  <div className="form-row">
                    <label>Selling Price (₦)</label>
                    <input
                      type="number"
                      value={item.selling_price}
                      onChange={(e) => updateItemField(idx, "selling_price", e.target.value)}
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="btn-add-item"
                onClick={() =>
                  setEditingSale({
                    ...editingSale,
                    items: [...editingSale.items, { item_id: "", quantity: 0, selling_price: 0 }],
                  })
                }
              >
                ➕ Add Item
              </button>

              <div className="total-box">
                Total: ₦
                {editingSale.items
                  .reduce((sum, i) => sum + i.quantity * i.selling_price, 0)
                  .toLocaleString()}
              </div>

              <div className="modal-actions2">
                <button className="btn-save" type="submit">Save</button>
                <button className="btn-cancel" type="button" onClick={() => setEditingSale(null)}>
                  Cancel
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
