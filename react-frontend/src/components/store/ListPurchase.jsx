import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListPurchase.css";

const ListPurchase = () => {
  const [purchases, setPurchases] = useState([]);
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalPurchase, setTotalPurchase] = useState(0);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [message, setMessage] = useState("");


  // At the top of your component
useEffect(() => {
  // Get first day of current month
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const start = firstDayOfMonth.toISOString().split("T")[0]; // YYYY-MM-DD
  const end = today.toISOString().split("T")[0];

  setStartDate(start);
  setEndDate(end);

  // Fetch purchases for current month immediately
  fetchPurchases(start, end);
}, []);


  // Fetch items & vendors once
  useEffect(() => {
    (async () => {
      try {
        const resItems = await axiosWithAuth().get("/store/items/simple");
        setItems(Array.isArray(resItems.data) ? resItems.data : []);

        const resVendors = await axiosWithAuth().get("/vendor/");
        setVendors(Array.isArray(resVendors.data) ? resVendors.data : []);
      } catch (err) {
        console.error("❌ Error fetching items/vendors", err);
      }
    })();
  }, []);

  const fetchPurchases = async (start, end) => {
    // Default to state if params not given
    const sDate = typeof start === "string" ? start : startDate;
    const eDate = typeof end === "string" ? end : endDate;

    setLoading(true);
    setError("");
    try {
      const axios = axiosWithAuth();
      const params = {};
      if (sDate) params.start_date = sDate;
      if (eDate) params.end_date = eDate;
      if (invoiceNumber) params.invoice_number = invoiceNumber;

      const response = await axios.get("/store/purchases", { params });
      const { purchases, total_entries, total_purchase } = response.data;
      setPurchases(purchases || []);
      setTotalEntries(total_entries || 0);
      setTotalPurchase(total_purchase || 0);
    } catch (err) {
      setError("Failed to fetch purchases");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this purchase?")) return;
    try {
      await axiosWithAuth().delete(`/store/purchases/${id}`);
      setMessage("✅ Purchase deleted successfully.");
      setTimeout(() => setMessage(""), 3000);
      fetchPurchases();
    } catch (err) {
      setMessage("❌ Failed to delete purchase.");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleEditClick = (purchase) => {
    const foundItem = items.find((item) => item.name === purchase.item_name);
    const foundVendor = vendors.find((vendor) => vendor.business_name === purchase.vendor_name);

    setEditingPurchase({
      ...purchase,
      item_id: foundItem ? foundItem.id : "",
      vendor_id: foundVendor ? foundVendor.id : "",
      purchase_date: purchase.purchase_date
        ? new Date(purchase.purchase_date).toISOString().slice(0, 16)
        : "",
    });
    setAttachmentFile(null);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditingPurchase((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingPurchase) return;

    try {
      const axios = axiosWithAuth();
      const formData = new FormData();

      formData.append("item_id", parseInt(editingPurchase.item_id));
      formData.append("item_name", editingPurchase.item_name || "");
      formData.append("invoice_number", editingPurchase.invoice_number);
      formData.append("quantity", parseFloat(editingPurchase.quantity));
      formData.append("unit_price", parseFloat(editingPurchase.unit_price));
      formData.append("vendor_id", editingPurchase.vendor_id ? parseInt(editingPurchase.vendor_id) : "");
      formData.append("purchase_date", new Date(editingPurchase.purchase_date).toISOString());

      if (attachmentFile) {
        formData.append("attachment", attachmentFile);
      }

      await axios.put(`/store/purchases/${editingPurchase.id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMessage("✅ Purchase updated successfully.");
      setTimeout(() => setMessage(""), 3000);
      setEditingPurchase(null);
      fetchPurchases();
    } catch (err) {
      setMessage("❌ Failed to update purchase.");
      setTimeout(() => setMessage(""), 3000);
      console.error(err.response?.data || err.message);
    }
  };

  return (
    <div className="list-purchase-container">
      <h2>List Purchases</h2>
      {message && <p className="message">{message}</p>}

      {/* Filters */}
      <div className="filters">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <input
          type="text"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          placeholder="Invoice number"
        />
        <button onClick={fetchPurchases}>Search</button>
      </div>

      {/* Summary */}
      <div className="summary">
        <p><strong>Total Entries:</strong> {totalEntries}</p>
        <p><strong>Total Purchase:</strong> ₦{totalPurchase.toLocaleString()}</p>
      </div>

      {/* Edit Form Modal */}
      {editingPurchase && (
        <div className="edit-modal-overlay" onClick={() => setEditingPurchase(null)}>
          <form className="edit-form" onClick={(e) => e.stopPropagation()} onSubmit={handleEditSubmit}>
            <h3>Edit Purchase</h3>

            {/* Item Dropdown */}
              <label>Item:</label>
              <select
                name="item_id"
                value={editingPurchase.item_id || ""}
                onChange={(e) => {
                  const selectedItem = items.find(item => item.id === parseInt(e.target.value));
                  setEditingPurchase(prev => ({
                    ...prev,
                    item_id: selectedItem ? selectedItem.id : "",
                    item_name: selectedItem ? selectedItem.name : ""
                  }));
                }}
              >
                <option value="">-- Select an item --</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>

              {/* Invoice Number */}
              <label>Invoice #:</label>
              <input
                name="invoice_number"
                value={editingPurchase.invoice_number}
                onChange={handleEditChange}
              />

              {/* Quantity */}
              <label>Quantity:</label>
              <input
                name="quantity"
                type="number"
                value={editingPurchase.quantity}
                onChange={handleEditChange}
              />

              {/* Unit Price */}
              <label>Unit Price:</label>
              <input
                name="unit_price"
                type="number"
                value={editingPurchase.unit_price}
                onChange={handleEditChange}
              />

              {/* Vendor Dropdown */}
              <label>Vendor:</label>
              <select
                name="vendor_id"
                value={editingPurchase.vendor_id || ""}
                onChange={(e) => {
                  const selectedVendor = vendors.find(v => v.id === parseInt(e.target.value));
                  setEditingPurchase(prev => ({
                    ...prev,
                    vendor_id: selectedVendor ? selectedVendor.id : "",
                    vendor_name: selectedVendor ? selectedVendor.business_name : ""
                  }));
                }}
              >
                <option value="">-- Select a vendor --</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.business_name}</option>
                ))}
              </select>

              {/* Purchase Date */}
              <label>Purchase Date:</label>
              <input
                name="purchase_date"
                type="datetime-local"
                value={editingPurchase.purchase_date}
                onChange={handleEditChange}
              />

              {/* Attachment */}
              <label>Attachment:</label>
              <input type="file" onChange={(e) => setAttachmentFile(e.target.files[0])} />

            <button type="submit">Update Purchase</button>
            <button type="button" className="cancel-btn" onClick={() => setEditingPurchase(null)}>
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Purchases Table */}
      {loading ? (
        <p>Loading purchases...</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : (
        <table className="purchase-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Item</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
              <th>Vendor</th>
              <th>Purchase Date</th>
              <th>Created By</th>
              <th>Attachment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr><td colSpan="10">No purchases found.</td></tr>
            ) : (
              purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td>{purchase.invoice_number}</td>
                  <td>{purchase.item_name}</td>
                  <td>{purchase.quantity}</td>
                  <td>{purchase.unit_price}</td>
                  <td>{purchase.total_amount}</td>
                  <td>{purchase.vendor_name}</td>
                  <td>{new Date(purchase.purchase_date).toLocaleDateString()}</td>
                  <td>{purchase.created_by}</td>
                  <td>
                    {purchase.attachment_url ? (
                      <a href={purchase.attachment_url} target="_blank" rel="noopener noreferrer">View Invoice</a>
                    ) : "-"}
                  </td>
                  <td>
                    <button className="edit-btn" onClick={() => handleEditClick(purchase)}>Edit</button>
                    <button className="delete-btn" onClick={() => handleDelete(purchase.id)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ListPurchase;
