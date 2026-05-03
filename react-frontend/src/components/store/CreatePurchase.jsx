import React, { useEffect, useState, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./CreatePurchase.css";

const CreatePurchase = () => {
  const axios = axiosWithAuth();

  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [rows, setRows] = useState([
    {
      categoryId: "",
      itemId: "",
      itemName: "",
      quantity: "",
      unitPrice: "",
      total: 0,
      search: "",
      suggestions: [],
    },
  ]);

  const [vendorId, setVendorId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [message, setMessage] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");



  const searchTimers = useRef({});
  const searchCache = useRef({});

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = Array.isArray(storedUser.roles)
    ? storedUser.roles
    : [storedUser.role];

  roles = roles.map((r) => r?.toLowerCase());

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

  const fetchItems = async (searchText) => {
    if (searchCache.current[searchText]) {
      return searchCache.current[searchText];
    }

    try {
      const res = await axios.get("/store/items/simple-search", {
        params: { search: searchText, limit: 20 },
      });

      const data = Array.isArray(res.data) ? res.data : [];
      searchCache.current[searchText] = data;

      return data;
    } catch {
      return [];
    }
  };

  const updateRowTotal = (row) => {
    const qty = parseFloat(row.quantity) || 0;
    const price = parseFloat(row.unitPrice) || 0;
    row.total = qty * price;
  };

  const fetchTimeout = useRef(null);

  const handleSearch = (index, value) => {
    const updated = [...rows];

    updated[index].search = value;
    updated[index].itemId = "";
    updated[index].itemName = "";
    updated[index].categoryId = "";

    setRows(updated);

    if (fetchTimeout.current) {
      clearTimeout(fetchTimeout.current);
    }

    if (value.length < 2) {
      updated[index].suggestions = [];
      setRows([...updated]);
      return;
    }

    fetchTimeout.current = setTimeout(async () => {
      try {
        const res = await axios.get("/store/items/simple-search", {
          params: { search: value, limit: 20 },
        });

        const results = Array.isArray(res.data) ? res.data : [];

        setRows((prev) => {
          const next = [...prev];
          next[index].suggestions = results;
          return next;
        });
      } catch {
        // silent fail
      }
    }, 300);
  };


  const handleRowChange = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;

    updateRowTotal(updated[index]);
    setRows(updated);
  };

  const handleItemSelect = (index, item) => {
    const updated = [...rows];

    updated[index].itemId = item.id;
    updated[index].itemName = item.name;
    updated[index].categoryId = item.category_id || "";
    updated[index].unitPrice = item.unit_price || 0;
    updated[index].search = item.name;
    updated[index].suggestions = [];

    updateRowTotal(updated[index]);

    setRows(updated);
  };

  const addRow = () => {
    setRows([
      ...rows,
      {
        categoryId: "",
        itemId: "",
        itemName: "",
        quantity: "",
        unitPrice: "",
        total: 0,
        search: "",
        suggestions: [],
      },
    ]);
  };

  const removeRow = (index) => {
    setRows(rows.filter((_, i) => i !== index));
  };

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

        if (attachment) {
          formData.append("attachment", attachment);
        }

        await axios.post("/store/purchases", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      setMessage("✅ Purchase saved successfully.");

      setRows([
        {
          categoryId: "",
          itemId: "",
          itemName: "",
          quantity: "",
          unitPrice: "",
          total: 0,
          search: "",
          suggestions: [],
        },
      ]);

      setVendorId("");
      setInvoiceNumber("");
      setAttachment(null);
      setPurchaseDate(new Date().toISOString().split("T")[0]);

    } catch (err) {
      setMessage(
        err.response?.data?.detail || "❌ Failed to save purchase."
      );
    }
  };

  const invoiceTotal = rows.reduce(
    (sum, row) => sum + (parseFloat(row.total) || 0),
    0
  );

  return (
    <div className="create-purchase-container">
      <h2>Add New Purchase</h2>

      <form onSubmit={handleSubmit} className="purchase-form">

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

        <div className="attachment-row">
          <div className="form-group full-width">
            <label>Attach Invoice (optional)</label>
            <input
              type="file"
              onChange={(e) => setAttachment(e.target.files[0])}
            />
          </div>
        </div>

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

              <div className="autocomplete">
                <input
                  type="text"
                  placeholder="Type item name..."
                  value={row.search}
                  onChange={(e) =>
                    handleSearch(index, e.target.value)
                  }
                />

                {row.suggestions.length > 0 && (
                  <ul className="suggestions-list">
                    {row.suggestions.map((item) => (
                      <li
                        key={item.id}
                        onClick={() =>
                          handleItemSelect(index, item)
                        }
                      >
                        {item.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <select value={row.categoryId} disabled>
                <option value="">Select Category</option>
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

              <input
                type="number"
                className="total-cell"
                value={row.total}
                readOnly
              />

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

        <button
          type="button"
          className="add-row-btn"
          onClick={addRow}
        >
          + Add Item
        </button>

        <div className="invoice-total">
          <strong>Total: </strong>
          {invoiceTotal.toLocaleString("en-NG", {
            style: "currency",
            currency: "NGN",
          })}
        </div>

        <button type="submit" className="submit-button">
          Add Purchase
        </button>

        {message && <p className="message">{message}</p>}
      </form>
    </div>
  );
};

export default CreatePurchase;


