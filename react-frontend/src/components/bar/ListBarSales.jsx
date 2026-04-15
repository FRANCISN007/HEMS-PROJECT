import React, { useEffect, useState, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListBarSales.css";

import "../restaurant/Receipt.css";

const ListBarSales = () => {
  const [sales, setSales] = useState([]);
  const [bars, setBars] = useState([]);
  const [editingSale, setEditingSale] = useState(null);
  const [message, setMessage] = useState("");
  const [barId, setBarId] = useState("");

  const user = JSON.parse(localStorage.getItem("user")) || {};
  const roles = user.roles || [];
  
  // Get business name from the structure your login already returns
  const businessName = user.business?.name || "HEMS Hotel";

  if (!(roles.includes("admin") || roles.includes("bar"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to list bar sales.</p>
      </div>
    );
  }

  const [printSale, setPrintSale] = useState(null);
  const [printTime, setPrintTime] = useState(null);
  const printRef = useRef();

  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  /* ===================== FETCH ===================== */
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

  const fetchItems = async (searchText) => {
    try {
      const res = await axiosWithAuth().get("/bar/items/simple-search", {
        params: { search: searchText, limit: 50 },
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    fetchSales();
    fetchBars();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  /* ===================== ACTIONS ===================== */
  const handlePrint = (sale) => {
    setPrintSale(sale);
    setPrintTime(new Date());
  };

  const closePrintModal = () => {
    setPrintSale(null);
    setPrintTime(null);
  };

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
      id: sale.id,
      bar_id: sale.bar_id,
      sale_date: sale.sale_date?.slice(0, 16),
      items: sale.sale_items?.map((i) => ({
        item_id: i.item_id,
        item_name: i.item_name,
        quantity: i.quantity,
        selling_price: i.selling_price,
        search: i.item_name,
        suggestions: [],
      })) || [],
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingSale) return;

    if (!editingSale.bar_id) {
      alert("Please select a bar");
      return;
    }
    if (!editingSale.sale_date) {
      alert("Please select sale date");
      return;
    }

    for (let i = 0; i < editingSale.items.length; i++) {
      const item = editingSale.items[i];
      if (!item.item_id || item.quantity <= 0 || item.selling_price <= 0) {
        alert(`⚠️ Invalid item at row ${i + 1}`);
        return;
      }
    }

    try {
      await axiosWithAuth().put(`/bar/sales/${editingSale.id}`, {
        bar_id: Number(editingSale.bar_id),
        sale_date: new Date(editingSale.sale_date).toISOString(),
        items: editingSale.items.map((i) => ({
          item_id: Number(i.item_id),
          quantity: Number(i.quantity),
          selling_price: Number(i.selling_price),
        })),
      });

      setMessage("✅ Sale updated successfully!");
      setEditingSale(null);
      fetchSales();
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Failed to update sale.");
    }
  };

  const handleItemSearchChange = async (index, value) => {
    if (!editingSale) return;
    const updated = [...editingSale.items];
    updated[index].search = value;

    if (value.length > 0) {
      const results = await fetchItems(value);
      updated[index].suggestions = results;
    } else {
      updated[index].suggestions = [];
      updated[index].item_id = "";
      updated[index].selling_price = 0;
    }

    setEditingSale({ ...editingSale, items: updated });
  };

  const handleSelectItem = (index, item) => {
    if (!editingSale) return;
    const updated = [...editingSale.items];
    updated[index].item_id = item.item_id;
    updated[index].item_name = item.item_name;
    updated[index].selling_price = item.selling_price || 0;
    updated[index].search = item.item_name;
    updated[index].suggestions = [];
    setEditingSale({ ...editingSale, items: updated });
  };

  const handleQuantityChange = (index, value) => {
    if (!editingSale) return;
    const updated = [...editingSale.items];
    updated[index].quantity = Number(value);
    setEditingSale({ ...editingSale, items: updated });
  };

  const handlePriceChange = (index, value) => {
    if (!editingSale) return;
    const updated = [...editingSale.items];
    updated[index].selling_price = Number(value);
    setEditingSale({ ...editingSale, items: updated });
  };

  const addItemRow = () => {
    if (!editingSale) return;
    const updated = [
      ...editingSale.items,
      { item_id: "", item_name: "", quantity: 1, selling_price: 0, search: "", suggestions: [] },
    ];
    setEditingSale({ ...editingSale, items: updated });
  };

  const removeItemRow = (index) => {
    if (!editingSale) return;
    const updated = editingSale.items.filter((_, i) => i !== index);
    setEditingSale({ ...editingSale, items: updated });
  };

  return (
    <div className="list-bar-sales-container1">
      <h2 className="page-heading">📋 Bar Sales List</h2>
      {message && <div className="message">{message}</div>}

      {/* TOP BAR */}
      <div className="top-bar">
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
      </div>

      {/* SALES TABLE */}
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
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>{sale.id}</td>
                <td>{new Date(sale.sale_date).toLocaleDateString()}</td>
                <td>{sale.bar_name}</td>
                <td>
                  {sale.sale_items?.map((it, i) => (
                    <div key={i}>
                      {it.item_name} – {it.quantity} × ₦{it.selling_price}
                    </div>
                  )) || "--"}
                </td>
                <td>₦{sale.total_amount?.toLocaleString() || 0}</td>
                <td>{sale.created_by}</td>
                <td>
                  <button onClick={() => handleEdit(sale)}>✏ Edit</button>
                  <button onClick={() => handlePrint(sale)}>🖨 Print</button>
                  <button onClick={() => handleDelete(sale.id)}>🗑 Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===================== EDIT MODAL ===================== */}
      {editingSale && (
        <div className="modal-overlay2">
          <div className="modal2">
            <h3 className="modal-title">✏ Edit Sale</h3>

            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label>Bar</label>
                <select
                  value={editingSale.bar_id}
                  onChange={(e) => setEditingSale({ ...editingSale, bar_id: Number(e.target.value) })}
                >
                  <option value="">Select Bar</option>
                  {bars.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Sale Date</label>
                <input
                  type="datetime-local"
                  value={editingSale.sale_date}
                  onChange={(e) => setEditingSale({ ...editingSale, sale_date: e.target.value })}
                />
              </div>

              {editingSale.items.map((item, idx) => (
                <div key={idx} className="sale-item-card">
                  <div className="sale-item-header">
                    <h4>Item {idx + 1}</h4>
                    <button type="button" className="btn-remove-item" onClick={() => removeItemRow(idx)}>
                      ❌
                    </button>
                  </div>

                  <div className="form-row">
                    <label>Item</label>
                    <div className="autocomplete">
                      <input
                        type="text"
                        placeholder="Type to search..."
                        value={item.search}
                        onChange={(e) => handleItemSearchChange(idx, e.target.value)}
                      />
                      {item.suggestions.length > 0 && (
                        <ul className="suggestions-list">
                          {item.suggestions.map((it) => (
                            <li key={it.item_id} onClick={() => handleSelectItem(idx, it)}>
                              {it.item_name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <label>Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(idx, e.target.value)}
                    />
                  </div>

                  <div className="form-row">
                    <label>Selling Price (₦)</label>
                    <input
                      type="number"
                      min="0"
                      value={item.selling_price}
                      onChange={(e) => handlePriceChange(idx, e.target.value)}
                    />
                  </div>
                </div>
              ))}

              <button type="button" className="btn-add-item" onClick={addItemRow}>
                ➕ Add Item
              </button>

              <div className="total-box">
                Total: ₦
                {editingSale.items.reduce((sum, i) => sum + i.quantity * i.selling_price, 0).toLocaleString()}
              </div>

              <div className="modal-actions2">
                <button className="btn-save" type="submit">
                  Save
                </button>
                <button className="btn-cancel" type="button" onClick={() => setEditingSale(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== PRINT MODAL ===================== */}
      {printSale && (
        <div className="modal-overlay2" onClick={closePrintModal}>
          <div className="modal2" onClick={(e) => e.stopPropagation()}>
            <div ref={printRef} className="receipt-container">
              <div className="receipt-header">
                <h2>{businessName.toUpperCase()}</h2>
                <h3>Bar Sale Receipt</h3>
                <p style={{ fontSize: "12px", textAlign: "center" }}>
                  {printTime?.toLocaleString()}
                </p>
                <hr />
              </div>

              <div className="receipt-info">
                <p><strong>Sale #:</strong> {printSale.id}</p>
                <p><strong>Bar:</strong> {printSale.bar_name}</p>
                <p><strong>Staff:</strong> {printSale.created_by}</p>
              </div>

              <hr />

              <div className="receipt-items">
                {printSale.sale_items?.length > 0 ? (
                  printSale.sale_items.map((item, idx) => (
                    <div key={idx} className="receipt-item">
                      <span>{item.quantity} × {item.item_name}</span>
                      <span className="amount">
                        ₦{(item.quantity * item.selling_price).toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <p>No items</p>
                )}
              </div>

              <hr />

              <div className="receipt-totals">
                <p style={{ fontWeight: "bold", fontSize: "16px", display: "flex" }}>
                  <span>Total Amount</span>
                  <span>₦{printSale.total_amount?.toLocaleString() || 0}</span>
                </p>
              </div>

              <hr />

              <div className="receipt-footer">
                <p>Thank you for your patronage!</p>
                <p>Powered by HEMS</p>
              </div>
            </div>

            <div className="modal-actions2">
              <button
                onClick={() => {
                  const printContent = printRef.current;
                  const WinPrint = window.open("", "", "width=340,height=600");
                  WinPrint.document.write(printContent.outerHTML);
                  WinPrint.document.close();
                  WinPrint.focus();
                  WinPrint.print();
                  WinPrint.close();
                }}
              >
                🖨 Print Now
              </button>
              <button onClick={closePrintModal}>❌ Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListBarSales;