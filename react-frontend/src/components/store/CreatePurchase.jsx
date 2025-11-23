import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./CreatePurchase.css";

const CreatePurchase = () => {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [rows, setRows] = useState([
    { categoryId: "", itemId: "", quantity: "", unitPrice: "", total: 0 },
  ]);
  const [vendorId, setVendorId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [message, setMessage] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];

  if (Array.isArray(storedUser.roles)) {
    roles = storedUser.roles;
  } else if (typeof storedUser.role === "string") {
    roles = [storedUser.role];
  }

  roles = roles.map((r) => r.toLowerCase());


  if (!(roles.includes("admin") || roles.includes("store"))) {
  return (
    <div className="unauthorized">
      <h2>🚫 Access Denied</h2>
      <p>You do not have permission to create purchase.</p>
    </div>
  );
}

  

  useEffect(() => {
    fetchVendors();
    fetchCategories();
    fetchItems();
  }, []);

// 👇 Add this below
useEffect(() => {
  const today = new Date().toISOString().split("T")[0];
  setPurchaseDate(today);
}, []);


  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer); // cleanup if message changes or component unmounts
    }
  }, [message]);

  const fetchVendors = async () => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get("/vendor/");
      const data = res.data;
      setVendors(Array.isArray(data) ? data : data.vendors || []);
    } catch {
      setVendors([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get("/store/categories");
      const data = res.data;
      setCategories(Array.isArray(data) ? data : data.categories || []);
    } catch {
      setCategories([]);
    }
  };

  const fetchItems = async () => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get("/store/items/simple");
      const data = res.data;
      setItems(Array.isArray(data) ? data : data.items || []);
    } catch {
      setItems([]);
    }
  };

  const handleRowChange = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;

    // Auto-fill category when item changes
    if (field === "itemId") {
      const selectedItem = items.find((i) => i.id === parseInt(value));
      if (selectedItem) {
        updated[index].categoryId = selectedItem.category_id
          ? selectedItem.category_id
          : categories.find(
              (cat) =>
                cat.name.toLowerCase() ===
                selectedItem.category_name?.toLowerCase()
            )?.id || "";
      }
    }

    const qty = parseFloat(updated[index].quantity) || 0;
    const price = parseFloat(updated[index].unitPrice) || 0;
    updated[index].total = qty * price;

    setRows(updated);
  };

  const addRow = () => {
    setRows([
      ...rows,
      { categoryId: "", itemId: "", quantity: "", unitPrice: "", total: 0 },
    ]);
  };

  const removeRow = (index) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const axios = axiosWithAuth();
      for (const row of rows) {
        const item = items.find((i) => i.id === parseInt(row.itemId));
        if (!item) continue;

        const formData = new FormData();
        formData.append("item_id", String(item.id));
        formData.append("item_name", item.name);
        formData.append("invoice_number", invoiceNumber);
        formData.append("quantity", String(row.quantity));
        formData.append("unit_price", String(row.unitPrice));
        formData.append("vendor_id", String(vendorId));
        formData.append(
          "purchase_date",
          new Date(purchaseDate).toISOString()
        );
        if (attachment) {
          formData.append("attachment", attachment);
        }

        await axios.post("/store/purchases", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      setMessage("✅ Purchase saved successfully.");
      setRows([
        { categoryId: "", itemId: "", quantity: "", unitPrice: "", total: 0 },
      ]);
      setVendorId("");
      setPurchaseDate("");
      setInvoiceNumber("");
      setAttachment(null);
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Failed to save purchase.");
    }
  };

  // Calculate invoice total
  const invoiceTotal = rows.reduce(
    (sum, row) => sum + (parseFloat(row.total) || 0),
    0
  );


  return (
    <div className="create-purchase-container">
      <h2>Add New Purchase</h2>
      <form onSubmit={handleSubmit} className="purchase-form">
        
        {/* Compact Top Form */}
        <div className="form-grid">
          <div className="form-group">
            <label>Vendor</label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              required
            >
              <option value="">Select Vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.business_name || vendor.name}
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

          <div className="form-group">
            <label>Attach Invoice (optional)</label>
            <input
              type="file"
              onChange={(e) => setAttachment(e.target.files[0])}
            />
          </div>
        </div>

        {/* Table-style item entry */}
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
                onChange={(e) =>
                  handleRowChange(index, "quantity", e.target.value)
                }
                required
              />

              <select
                value={row.itemId}
                onChange={(e) =>
                  handleRowChange(index, "itemId", e.target.value)
                }
              >
                <option value="">Select</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <select
                value={row.categoryId}
                onChange={(e) =>
                  handleRowChange(index, "categoryId", e.target.value)
                }
              >
                <option value="">Select</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={row.unitPrice}
                onChange={(e) =>
                  handleRowChange(index, "unitPrice", e.target.value)
                }
                required
              />

              <input type="number" value={row.total} readOnly />

              <button
                type="button"
                className="remove-btn"
                onClick={() => removeRow(index)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {/* Add Row Button */}
        <button type="button" onClick={addRow} className="add-row-btn">
          + Add Item
        </button>

        {/* Invoice Total */}
        <div className="invoice-total">
          <strong>Total: </strong> 
          {invoiceTotal.toLocaleString("en-NG", {
            style: "currency",
            currency: "NGN",
          })}
        </div>


        {/* Submit Button */}
        <button type="submit" className="submit-button">
          Add Purchase
        </button>

        {message && <p className="message">{message}</p>}
      </form>
    </div>
  );
};

export default CreatePurchase;