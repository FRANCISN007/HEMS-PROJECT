import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListItem.css";

const ListItem = () => {
  const [items, setItems] = useState([]);
  const [simpleItems, setSimpleItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // =====================
  // Editing states
  // =====================
  const [editingItem, setEditingItem] = useState(null);
  const [updateName, setUpdateName] = useState("");
  const [updateUnit, setUpdateUnit] = useState("");
  const [updateUnitPrice, setUpdateUnitPrice] = useState("");
  const [updateSellingPrice, setUpdateSellingPrice] = useState("");
  const [updateCategoryId, setUpdateCategoryId] = useState("");
  const [updateItemType, setUpdateItemType] = useState("");
  const [selectedSimpleItemId, setSelectedSimpleItemId] = useState("");

  // =====================
  // Creation states
  // =====================
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [newSellingPrice, setNewSellingPrice] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newItemType, setNewItemType] = useState("");

  // =====================
  // Search state
  // =====================
  const [searchText, setSearchText] = useState("");

  const unitOptions = ["Carton", "Pack", "Crate", "Piece"];
  const itemTypeOptions = ["All", "bar", "kitchen", "housekeeping", "maintenance", "general"];

  // =====================
  // User roles check
  // =====================
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
        <p>You do not have permission to manage items.</p>
      </div>
    );
  }

  // =====================
  // Fetch data
  // =====================
  useEffect(() => {
    fetchItems();
    fetchSimpleItems();
    fetchCategories();
  }, []);

  // Auto-clear messages
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const safeMessage = (err, fallback = "❌ Operation failed") => {
    if (!err?.response?.data?.detail) return fallback;
    return typeof err.response.data.detail === "string"
      ? err.response.data.detail
      : JSON.stringify(err.response.data.detail);
  };

  // =====================
  // Fetch Items with Search
  // =====================
  const fetchItems = async (search = "") => {
    setLoading(true);
    try {
      const res = await axiosWithAuth().get("/store/items", { params: { search } });
      setItems(res.data);
    } catch (err) {
      setMessage("❌ Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  const fetchSimpleItems = async (search = "") => {
    try {
      const res = await axiosWithAuth().get("/store/items/simple-search", { params: { search } });
      setSimpleItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("❌ Failed to load simple items", err);
      setSimpleItems([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axiosWithAuth().get("/store/categories");
      setCategories(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch categories", err);
    }
  };

  // =====================
  // Handle Search Input
  // =====================
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchText(value);
    fetchItems(value);
    fetchSimpleItems(value);
  };

  // =====================
  // Delete Item
  // =====================
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      await axiosWithAuth().delete(`/store/items/${id}`);
      setItems(items.filter((i) => i.id !== id));
      setMessage("✅ Item deleted successfully.");
      fetchSimpleItems();
    } catch (err) {
      setMessage(safeMessage(err, "❌ Failed to delete item."));
    }
  };

  // =====================
  // Open Edit Modal
  // =====================
  const openEditModal = (item) => {
    setEditingItem(item);
    setUpdateName(item.name);
    setUpdateUnit(item.unit || "");
    setUpdateUnitPrice(item.unit_price || "");
    setUpdateSellingPrice(item.selling_price || "");
    setUpdateCategoryId(item.category?.id || "");
    setUpdateItemType(item.item_type || "All");
    setSelectedSimpleItemId(item.id);
  };

  const handleSimpleItemChange = (value) => {
    setSelectedSimpleItemId(value);
    const selected = simpleItems.find((it) => String(it.id) === String(value));
    if (selected) {
      setUpdateName(selected.name || "");
      setUpdateUnit(selected.unit || "");
      setUpdateUnitPrice(selected.unit_price || "");
      setUpdateSellingPrice(selected.selling_price || "");
      setUpdateItemType(selected.item_type || "All");
    }
  };

  // =====================
  // Update Item
  // =====================
  const handleUpdate = async (e) => {
    e.preventDefault();
    const unitPrice = parseFloat(updateUnitPrice);
    const sellingPrice = parseFloat(updateSellingPrice);

    if (isNaN(unitPrice) || isNaN(sellingPrice))
      return setMessage("❌ Unit price and Selling price must be numbers.");
    if (!updateName.trim() || !updateUnit.trim())
      return setMessage("❌ Name and Unit are required.");
    const parsedCategoryId = parseInt(updateCategoryId);
    if (!parsedCategoryId || isNaN(parsedCategoryId))
      return setMessage("❌ Please select a valid category.");

    try {
      await axiosWithAuth().put(`/store/items/${editingItem.id}`, {
        name: updateName.trim(),
        unit: updateUnit.trim(),
        unit_price: unitPrice,
        selling_price: sellingPrice,
        category_id: parsedCategoryId,
        item_type: updateItemType,
      });
      setMessage("✅ Item updated successfully.");
      setEditingItem(null);
      fetchItems(searchText);
      fetchSimpleItems(searchText);
    } catch (err) {
      setMessage(safeMessage(err, "❌ Failed to update item."));
    }
  };

  // =====================
  // Create Item
  // =====================
  const handleCreate = async (e) => {
    e.preventDefault();
    const unitPrice = parseFloat(newUnitPrice);
    const sellingPrice = parseFloat(newSellingPrice);
    const parsedCategoryId = parseInt(newCategoryId);

    if (!newName.trim() || !newUnit.trim() || isNaN(unitPrice) || isNaN(sellingPrice) || isNaN(parsedCategoryId)) {
      return setMessage("❌ All fields are required and must be valid.");
    }

    try {
      await axiosWithAuth().post("/store/items", {
        name: newName.trim(),
        unit: newUnit.trim(),
        unit_price: unitPrice,
        selling_price: sellingPrice,
        category_id: parsedCategoryId,
        item_type: newItemType || "All",
      });
      setMessage("✅ Item created successfully.");
      setNewName("");
      setNewUnit("");
      setNewUnitPrice("");
      setNewSellingPrice("");
      setNewCategoryId("");
      setNewItemType("");
      fetchItems(searchText);
      fetchSimpleItems(searchText);
    } catch (err) {
      setMessage(safeMessage(err, "❌ Failed to create item."));
    }
  };

  // =====================
  // Render
  // =====================
  return (
    <div className="list-item-container">
      <h2>📋 Item List</h2>
      {message && <p className="list-item-message">{message}</p>}

      {/* Search */}
      <input
        type="text"
        placeholder="🔍 Search items..."
        value={searchText}
        onChange={handleSearchChange}
        className="search-input"
      />

      {/* Create Item Form */}
      <h3>➕ Create New Item</h3>
      <form onSubmit={handleCreate} className="create-item-form">
        <label>
          Name:
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Coke, Fanta" required />
        </label>

        <label>
          Unit:
          <select value={newUnit} onChange={(e) => setNewUnit(e.target.value)} required>
            <option value="">Select Unit</option>
            {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>

        <label>
          Unit Price:
          <input type="number" step="0.01" value={newUnitPrice} onChange={(e) => setNewUnitPrice(e.target.value)} placeholder="e.g. 800" required />
        </label>

        <label>
          Selling Price:
          <input type="number" step="0.01" value={newSellingPrice} onChange={(e) => setNewSellingPrice(e.target.value)} placeholder="e.g. 1000" required />
        </label>

        <label>
          Category:
          <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)} required>
            <option value="">Select Category</option>
            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
        </label>

        <label>
          Item Type:
          <select value={newItemType} onChange={(e) => setNewItemType(e.target.value)}>
            {itemTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>

        <button type="submit" className="save-btn">➕ Add Item</button>
      </form>

      <hr />

      {/* Item Table with Vertical Scroll */}
      {loading ? (
        <p>Loading items...</p>
      ) : items.length === 0 ? (
        <p>No items found.</p>
      ) : (
        <div className="scrollable-table-container">
          <table className="item-table">
            <thead>
              <tr>
                <th>Id</th>
                <th>Name</th>
                <th>Unit</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Category</th>
                <th>Item Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? "even-row" : "odd-row"}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.unit}</td>
                  <td>{item.unit_price}</td>
                  <td>{item.selling_price}</td>
                  <td>{item.category?.name}</td>
                  <td>{item.item_type || "All"}</td>
                  <td>
                    <button className="edit-btn" onClick={() => openEditModal(item)}>✏️ Edit</button>
                    <button className="delete-btn" onClick={() => handleDelete(item.id)}>🗑 Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>✏️ Update Item</h3>

            <label>
              Search & Select Item:
              <input
                type="text"
                placeholder="🔍 Search item in catalog..."
                onChange={(e) => fetchSimpleItems(e.target.value)}
                className="search-input"
              />
              <select value={selectedSimpleItemId} onChange={(e) => handleSimpleItemChange(e.target.value)}>
                <option value="">-- Select Item --</option>
                {simpleItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.unit}) - ₦{it.unit_price} / ₦{it.selling_price} - {it.item_type || "All"}
                  </option>
                ))}
              </select>
            </label>

            <form onSubmit={handleUpdate}>
              <label>
                Name:
                <input type="text" value={updateName} onChange={(e) => setUpdateName(e.target.value)} required />
              </label>

              <label>
                Unit:
                <select value={updateUnit} onChange={(e) => setUpdateUnit(e.target.value)} required>
                  <option value="">Select Unit</option>
                  {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>

              <label>
                Unit Cost Price:
                <input type="number" step="0.01" value={updateUnitPrice} onChange={(e) => setUpdateUnitPrice(e.target.value)} required />
              </label>

              <label>
                Selling Price:
                <input type="number" step="0.01" value={updateSellingPrice} onChange={(e) => setUpdateSellingPrice(e.target.value)} required />
              </label>

              <label>
                Category:
                <select value={updateCategoryId} onChange={(e) => setUpdateCategoryId(e.target.value)} required>
                  <option value="">Select Category</option>
                  {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </label>

              <label>
                Item Type:
                <select value={updateItemType} onChange={(e) => setUpdateItemType(e.target.value)}>
                  {itemTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>

              <div className="modal-buttons">
                <button type="submit" className="save-btn">💾 Save</button>
                <button type="button" className="cancel-btn" onClick={() => setEditingItem(null)}>❌ Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListItem;
