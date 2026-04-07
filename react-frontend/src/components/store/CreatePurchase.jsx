import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./CreatePurchase.css";

const CreatePurchase = () => {
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [rows, setRows] = useState([
    { categoryId: "", itemId: "", itemName: "", quantity: "", unitPrice: "", total: 0, search: "", suggestions: [] },
  ]);
  const [vendorId, setVendorId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [message, setMessage] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = Array.isArray(storedUser.roles) ? storedUser.roles : [storedUser.role];
  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("store"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to create purchase.</p>
      </div>
    );
  }

  const axios = axiosWithAuth();

  useEffect(() => {
    fetchVendors();
    fetchCategories();
    setPurchaseDate(new Date().toISOString().split("T")[0]);
  }, []);

  const fetchVendors = async () => {
    try {
      const res = await axios.get("/vendor/");
      setVendors(Array.isArray(res.data) ? res.data : []);
    } catch {
      setVendors([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get("/store/categories");
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCategories([]);
    }
  };

  // 🔹 New: fetch items based on search term
  const fetchItems = async (searchText) => {
    try {
      const res = await axios.get("/store/items/simple-search", {
        params: { search: searchText, limit: 50 },
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  };

  const handleRowChange = async (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;

    // Update item search suggestions dynamically
    if (field === "search") {
      if (value.length > 0) {
        const results = await fetchItems(value);
        updated[index].suggestions = results;
      } else {
        updated[index].suggestions = [];
      }
      updated[index].itemId = "";
      updated[index].categoryId = "";
      updated[index].itemName = "";
    }

    // When user selects an item from suggestions
    // When user selects an item from suggestions
  if (field === "itemId") {
    const selectedItem = updated[index].suggestions.find(
      i => i.id === parseInt(value)
    );
    if (selectedItem) {
      updated[index].categoryId = selectedItem.category_id || "";
      updated[index].unitPrice = selectedItem.unit_price || 0;
      updated[index].itemName = selectedItem.name;

      // ✅ Update the search input to display the actual item name
      updated[index].search = selectedItem.name;
    }
    updated[index].suggestions = [];
  }


    const qty = parseFloat(updated[index].quantity) || 0;
    const price = parseFloat(updated[index].unitPrice) || 0;
    updated[index].total = qty * price;

    setRows(updated);
  };

  const addRow = () => {
    setRows([
      ...rows,
      { categoryId: "", itemId: "", itemName: "", quantity: "", unitPrice: "", total: 0, search: "", suggestions: [] },
    ]);
  };

  const removeRow = (index) => setRows(rows.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      for (const row of rows) {
        if (!row.itemId || !row.quantity || !row.unitPrice) continue;

        const formData = new FormData();
        formData.append("item_id", String(row.itemId));
        formData.append("item_name", row.itemName);
        formData.append("invoice_number", invoiceNumber);
        formData.append("quantity", String(row.quantity));
        formData.append("unit_price", String(row.unitPrice));
        formData.append("vendor_id", String(vendorId));
        formData.append("purchase_date", purchaseDate);
        if (attachment) formData.append("attachment", attachment);

        await axios.post("/store/purchases", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      setMessage("✅ Purchase saved successfully.");
      setRows([{ categoryId: "", itemId: "", itemName: "", quantity: "", unitPrice: "", total: 0, search: "", suggestions: [] }]);
      setVendorId("");
      setInvoiceNumber("");
      setPurchaseDate(new Date().toISOString().split("T")[0]);
      setAttachment(null);
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Failed to save purchase.");
    }
  };

  const invoiceTotal = rows.reduce((sum, row) => sum + (parseFloat(row.total) || 0), 0);

  return (
    <div className="create-purchase-container">
      <h2>Add New Purchase</h2>
      <form onSubmit={handleSubmit} className="purchase-form">
        {/* Top Form */}
        <div className="top-row">
          <div className="form-group">
            <label>Vendor</label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              required
            >
              <option value="">Select Vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.business_name || v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Purchase Date</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Invoice Number</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Attachment (full width below) */}
        <div className="attachment-row">
          <div className="form-group full-width">
            <label>Attach Invoice (optional)</label>
            <input
              type="file"
              onChange={(e) => setAttachment(e.target.files[0])}
            />
          </div>
        </div>


        {/* Item Table */}
        <div className="purchase-items-table">
          <div className="table-header">
            <span>Quantity</span>
            <span>Item</span>
            <span>Category</span>
            <span>Unit Price</span>
            <span>Total</span>
            <span>Action</span>
          </div>

          {rows.map((row, index) => (
            <div className="table-row" key={index}>
              <input
                type="number"
                value={row.quantity}
                onChange={e => handleRowChange(index, "quantity", e.target.value)}
                required
              />

              {/* 🔹 Searchable Item */}
              <div className="autocomplete">
                <input
                  type="text"
                  placeholder="Type to search item..."
                  value={row.search}
                  onChange={e => handleRowChange(index, "search", e.target.value)}
                />
                {row.suggestions.length > 0 && (
                  <ul className="suggestions-list">
                    {row.suggestions.map(item => (
                      <li key={item.id} onClick={() => handleRowChange(index, "itemId", item.id)}>
                        {item.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <select value={row.categoryId} onChange={e => handleRowChange(index, "categoryId", e.target.value)}>
                <option value="">Select Category</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>

              <input
                type="number"
                value={row.unitPrice}
                onChange={e => handleRowChange(index, "unitPrice", e.target.value)}
                required
              />

              <input type="number" className="total-cell" value={row.total} readOnly />

              <button type="button" className="remove-btn" onClick={() => removeRow(index)}>Remove</button>
            </div>
          ))}
        </div>

        <button type="button" className="add-row-btn" onClick={addRow}>+ Add Item</button>

        <div className="invoice-total">
          <strong>Total: </strong>
          {invoiceTotal.toLocaleString("en-NG", { style: "currency", currency: "NGN" })}
        </div>

        <button type="submit" className="submit-button">Add Purchase</button>

        {message && <p className="message">{message}</p>}
      </form>
    </div>
  );
};

export default CreatePurchase;
