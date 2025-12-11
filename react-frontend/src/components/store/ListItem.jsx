import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListItem.css";

const ListItem = () => {
  const [items, setItems] = useState([]);
  const [simpleItems, setSimpleItems] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const [editingItem, setEditingItem] = useState(null);
  const [updateName, setUpdateName] = useState("");
  const [updateUnit, setUpdateUnit] = useState("");
  const [updateCategoryId, setUpdateCategoryId] = useState("");
  const [updateUnitPrice, setUpdateUnitPrice] = useState("");
  const [updateItemType, setUpdateItemType] = useState("");

  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newItemType, setNewItemType] = useState("");

  const [selectedSimpleItemId, setSelectedSimpleItemId] = useState("");

  const unitOptions = ["Carton", "Pack", "Crate", "Piece"];
  const itemTypeOptions = ["All", "bar", "kitchen", "housekeeping", "maintenance", "general"];

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = Array.isArray(storedUser.roles) ? storedUser.roles : storedUser.role ? [storedUser.role] : [];
  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("store"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to manage items.</p>
      </div>
    );
  }

  useEffect(() => {
    fetchItems();
    fetchCategories();
    fetchSimpleItems();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchItems = async () => {
    try {
      const res = await axiosWithAuth().get("/store/items");
      setItems(res.data);
    } catch (err) {
      setMessage("❌ Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  const fetchSimpleItems = async () => {
    try {
      const res = await axiosWithAuth().get("/store/items/simple");
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

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      await axiosWithAuth().delete(`/store/items/${id}`);
      setItems(items.filter((i) => i.id !== id));
      setMessage("✅ Item deleted successfully.");
      fetchSimpleItems();
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Failed to delete item.");
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setUpdateName(item.name);
    setUpdateUnit(item.unit || "");
    setUpdateCategoryId(item.category?.id || "");
    setUpdateUnitPrice(item.unit_price || "");
    setUpdateItemType(item.item_type || "All");
    setSelectedSimpleItemId(item.id);
  };

  const handleSimpleItemChange = (value) => {
    setSelectedSimpleItemId(value);
    const selected = simpleItems.find((it) => String(it.id) === String(value));
    if (selected) {
      setUpdateName(selected.name || "");
      setUpdateUnit(selected.unit || "");
      setUpdateUnitPrice(typeof selected.unit_price === "number" ? String(selected.unit_price) : (selected.unit_price || ""));
      setUpdateItemType(selected.item_type || "All");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const price = parseFloat(updateUnitPrice);
    if (isNaN(price)) return setMessage("❌ Unit price must be a number.");
    if (!updateName.trim() || !updateUnit.trim()) return setMessage("❌ Name and Unit are required.");
    const parsedCategoryId = parseInt(updateCategoryId);
    if (!parsedCategoryId || isNaN(parsedCategoryId)) return setMessage("❌ Please select a valid category.");
    try {
      const payload = {
        name: updateName.trim(),
        unit: updateUnit.trim(),
        category_id: parsedCategoryId,
        unit_price: price,
        item_type: updateItemType,
      };
      await axiosWithAuth().put(`/store/items/${editingItem.id}`, payload);
      setMessage("✅ Item updated successfully.");
      setEditingItem(null);
      fetchItems();
      fetchSimpleItems();
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Failed to update item.");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const price = parseFloat(newUnitPrice);
    const parsedCategoryId = parseInt(newCategoryId);
    if (!newName.trim() || !newUnit.trim() || isNaN(price) || isNaN(parsedCategoryId)) {
      return setMessage("❌ All fields are required and must be valid.");
    }
    try {
      const payload = {
        name: newName.trim(),
        unit: newUnit.trim(),
        category_id: parsedCategoryId,
        unit_price: price,
        item_type: newItemType || "All",
      };
      await axiosWithAuth().post("/store/items", payload);
      setMessage("✅ Item created successfully.");
      setNewName("");
      setNewUnit("");
      setNewUnitPrice("");
      setNewCategoryId("");
      setNewItemType("");
      fetchItems();
      fetchSimpleItems();
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Failed to create item.");
    }
  };

  return (
    <div className="list-item-container">
      <h2>📋 Item List</h2>
      {message && <p className="list-item-message">{message}</p>}

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
          <input type="number" step="0.01" value={newUnitPrice} onChange={(e) => setNewUnitPrice(e.target.value)} placeholder="e.g. 1000" required />
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
          <select value={newItemType} onChange={(e) => setNewItemType(e.target.value)} className="item-type-dropdown">
            {itemTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>

        <button type="submit" className="save-btn">➕ Add Item</button>
      </form>

      <hr />

      {loading ? (
        <p>Loading items...</p>
      ) : items.length === 0 ? (
        <p>No items found.</p>
      ) : (
        <table className="item-table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th>Category</th>
              <th>Unit Price</th>
              <th>Unit</th>
              <th>Item Type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                <td>{item.id}</td>
                <td>{item.name}</td>
                <td>{item.category?.name}</td>
                <td>{item.unit_price}</td>
                <td>{item.unit}</td>
                <td>{item.item_type || "All"}</td>
                <td>
                  <button className="edit-btn" onClick={() => openEditModal(item)}>✏️ Edit</button>
                  <button className="delete-btn" onClick={() => handleDelete(item.id)}>🗑 Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingItem && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>✏️ Update Item</h3>

            <label>
              Select Item (catalog):
              <select value={selectedSimpleItemId} onChange={(e) => handleSimpleItemChange(e.target.value)}>
                <option value="">-- Select Item --</option>
                {simpleItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.unit}) {it.unit_price ? `- ₦${it.unit_price}` : ""} - {it.item_type || "All"}
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
                Unit Price:
                <input type="number" step="0.01" value={updateUnitPrice} onChange={(e) => setUpdateUnitPrice(e.target.value)} required />
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
                <select value={updateItemType} onChange={(e) => setUpdateItemType(e.target.value)} className="item-type-dropdown">
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
