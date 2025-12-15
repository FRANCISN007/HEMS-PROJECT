import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListPurchase.css";

const ListPurchase = () => {
  const [purchases, setPurchases] = useState([]);
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState("");
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
  const [itemId, setItemId] = useState("");


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
        <p>You do not have permission to list purchase.</p>
      </div>
    );
  }

  // Load default range (current month)
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const start = firstDay.toISOString().split("T")[0];
    const end = today.toISOString().split("T")[0];

    // 🚀 Always fetch fresh data when component mounts (ensures current IP)
    fetchPurchases(start, end);
  }, []);

  // Load items & vendors
  useEffect(() => {
    (async () => {
      try {
        const axios = axiosWithAuth();
        const resItems = await axios.get("/store/items/simple");
        setItems(Array.isArray(resItems.data) ? resItems.data : []);

        const resVendors = await axios.get("/vendor/");
        const vendorData = Array.isArray(resVendors.data) ? resVendors.data : resVendors.data?.vendors || [];
        setVendors(vendorData);
      } catch (err) {
        console.error("❌ Error fetching items/vendors", err);
      }
    })();
  }, []);

  const fetchPurchases = async (
    start,
    end,
    vendor = vendorId,
    item = itemId,
    invoice = invoiceNumber
  ) => {
    setLoading(true);
    setError("");
    try {
      const axios = axiosWithAuth();
      const params = {};
      if (start) params.start_date = start;
      if (end) params.end_date = end;
      if (vendor) params.vendor_id = vendor;
      if (item) params.item_id = item;
      if (invoice) params.invoice_number = invoice;

      const res = await axios.get("/store/purchases", { params });
      const { purchases, total_entries, total_purchase } = res.data;
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
    } catch {
      setMessage("❌ Failed to delete purchase.");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleEditClick = (purchase) => {
    const foundItem = items.find((i) => i.name === purchase.item_name);
    const foundVendor = vendors.find((v) => v.business_name === purchase.vendor_name);

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
      formData.append("vendor_id", parseInt(editingPurchase.vendor_id));
      formData.append("purchase_date", new Date(editingPurchase.purchase_date).toISOString());
      if (attachmentFile) formData.append("attachment", attachmentFile);

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

        {/* Item filter */}
        <select
          value={itemId}
          onChange={(e) => setItemId(e.target.value ? parseInt(e.target.value) : "")}
          className="item-filter"
        >
          <option value="">Select Item</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        {/* Vendor filter */}
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value ? parseInt(e.target.value) : "")}
          className="vendor-filter"
        >
          <option value="">Select Vendor</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.business_name || vendor.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => fetchPurchases(startDate, endDate, vendorId, itemId, invoiceNumber)}
        >
          Search
        </button>
      </div>


      {/* Summary */}
      <div className="summary">
        <p><strong>Total Entries:</strong> {totalEntries}</p>
        <p><strong>Total Purchase:</strong> ₦{totalPurchase.toLocaleString()}</p>
      </div>

      {/* Edit Modal */}
      {editingPurchase && (
        <div className="edit-modal-overlay" onClick={() => setEditingPurchase(null)}>
          <form className="edit-form" onClick={(e) => e.stopPropagation()} onSubmit={handleEditSubmit}>
            <h3>Edit Purchase</h3>

            <label>Item:</label>
            <select
              name="item_id"
              value={editingPurchase.item_id || ""}
              onChange={(e) => {
                const item = items.find((i) => i.id === parseInt(e.target.value));
                setEditingPurchase((prev) => ({
                  ...prev,
                  item_id: item?.id || "",
                  item_name: item?.name || "",
                }));
              }}
            >
              <option value="">-- Select an item --</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>

            <label>Invoice #:</label>
            <input name="invoice_number" value={editingPurchase.invoice_number} onChange={handleEditChange} />

            <label>Quantity:</label>
            <input name="quantity" type="number" value={editingPurchase.quantity} onChange={handleEditChange} />

            <label>Unit Price:</label>
            <input name="unit_price" type="number" value={editingPurchase.unit_price} onChange={handleEditChange} />

            <label>Vendor:</label>
            <select
              name="vendor_id"
              value={editingPurchase.vendor_id || ""}
              onChange={(e) => {
                const vendor = vendors.find((v) => v.id === parseInt(e.target.value));
                setEditingPurchase((prev) => ({
                  ...prev,
                  vendor_id: vendor?.id || "",
                  vendor_name: vendor?.business_name || "",
                }));
              }}
            >
              <option value="">-- Select a vendor --</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.business_name || v.name}</option>
              ))}
            </select>

            <label>Purchase Date:</label>
            <input
              name="purchase_date"
              type="datetime-local"
              value={editingPurchase.purchase_date}
              onChange={handleEditChange}
            />

            <label>Attachment:</label>
            <input type="file" onChange={(e) => setAttachmentFile(e.target.files[0])} />

            <button type="submit">Update Purchase</button>
            <button type="button" className="cancel-btn" onClick={() => setEditingPurchase(null)}>Cancel</button>
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
              purchases.map((p) => (
                <tr key={p.id}>
                  <td>{p.invoice_number}</td>
                  <td>{p.item_name}</td>
                  <td>{p.quantity}</td>
                  <td>{p.unit_price}</td>
                  <td>{p.total_amount}</td>
                  <td>{p.vendor_name}</td>
                  <td>{new Date(p.purchase_date).toLocaleDateString()}</td>
                  <td>{p.created_by}</td>
                  <td>
                    {p.attachment_url ? (
                      <a
                        href={p.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Invoice
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td>
                    <button className="edit-btn" onClick={() => handleEditClick(p)}>Edit</button>
                    <button className="delete-btn" onClick={() => handleDelete(p.id)}>Delete</button>
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