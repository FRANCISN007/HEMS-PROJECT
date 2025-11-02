import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListItem.css";

const ListItem = () => {
  const [items, setItems] = useState([]);
  const [simpleItems, setSimpleItems] = useState([]); // <-- new
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [updateName, setUpdateName] = useState("");
  const [updateUnit, setUpdateUnit] = useState("");
  const [updateCategoryId, setUpdateCategoryId] = useState("");
  const [updateUnitPrice, setUpdateUnitPrice] = useState("");
  const [categories, setCategories] = useState([]);

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const unitOptions = ["Carton", "Pack", "Crate", "Piece"];


  const [selectedSimpleItemId, setSelectedSimpleItemId] = useState(""); // <-- new

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
      <p>You do not have permission to manage items.</p>
    </div>
  );
}

  useEffect(() => {
    fetchItems();
    fetchCategories();
    fetchSimpleItems(); // <-- fetch simple items on mount
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer); // cleanup if message changes or component unmounts
    }
  }, [message]);

  const fetchItems = async () => {
    try {
      const axios = axiosWithAuth();
      const response = await axios.get("/store/items");
      setItems(response.data);
    } catch (error) {
      setMessage("❌ Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  const fetchSimpleItems = async () => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get("/store/items/simple");
      // response is expected as an array of simple items
      setSimpleItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("❌ Failed to load simple items", err);
      setSimpleItems([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const axios = axiosWithAuth();
      const response = await axios.get("/store/categories");
      setCategories(response.data);
    } catch (error) {
      console.error("Failed to fetch categories");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    try {
      const axios = axiosWithAuth();
      await axios.delete(`/store/items/${id}`);
      setItems(items.filter((item) => item.id !== id));
      setMessage("✅ Item deleted successfully.");
      // refresh simple items too
      fetchSimpleItems();
    } catch (error) {
      setMessage(error.response?.data?.detail || "❌ Failed to delete item.");
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setUpdateName(item.name);
    setUpdateUnit(item.unit || "");
    setUpdateCategoryId(item.category?.id || "");
    setUpdateUnitPrice(item.unit_price || "");
    setSelectedSimpleItemId(item.id); // select the item in simple items
  };

  // When the user selects a different simple item, populate name/unit/unit_price
  const handleSimpleItemChange = (value) => {
    setSelectedSimpleItemId(value);
    const selected = simpleItems.find((it) => String(it.id) === String(value));
    if (selected) {
      // populate the existing fields (user can still edit them)
      setUpdateName(selected.name || "");
      setUpdateUnit(selected.unit || "");
      // some simple endpoints return 0 when no price — set to empty string if null/undefined
      setUpdateUnitPrice(
        typeof selected.unit_price === "number" ? String(selected.unit_price) : (selected.unit_price || "")
      );
      // Note: simple endpoint doesn't include category, so we don't change updateCategoryId
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const price = parseFloat(updateUnitPrice);
    if (isNaN(price)) {
      setMessage("❌ Unit price must be a number.");
      return;
    }

    if (!updateName.trim() || !updateUnit.trim()) {
      setMessage("❌ Name and Unit are required.");
      return;
    }

    const parsedCategoryId = parseInt(updateCategoryId);
    if (!parsedCategoryId || isNaN(parsedCategoryId)) {
      setMessage("❌ Please select a valid category.");
      return;
    }

    try {
      const axios = axiosWithAuth();
      const payload = {
        name: updateName.trim(),
        unit: updateUnit.trim(),
        category_id: parsedCategoryId,
        unit_price: price,
      };

      await axios.put(`/store/items/${editingItem.id}`, payload);
      setMessage("✅ Item updated successfully.");
      setEditingItem(null);
      fetchItems();
      fetchSimpleItems();
    } catch (error) {
      console.error("Update Error:", error.response?.data || error.message);
      setMessage(error.response?.data?.detail || "❌ Failed to update item.");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const price = parseFloat(newUnitPrice);
    const parsedCategoryId = parseInt(newCategoryId);

    if (!newName.trim() || !newUnit.trim() || isNaN(price) || isNaN(parsedCategoryId)) {
      setMessage("❌ All fields are required and must be valid.");
      return;
    }

    try {
      const axios = axiosWithAuth();
      const payload = {
        name: newName.trim(),
        unit: newUnit.trim(),
        category_id: parsedCategoryId,
        unit_price: price,
      };

      await axios.post("/store/items", payload);
      setMessage("✅ Item created successfully.");
      setNewName("");
      setNewUnit("");
      setNewUnitPrice("");
      setNewCategoryId("");
      fetchItems();
      fetchSimpleItems();
    } catch (error) {
      console.error("Create Error:", error.response?.data || error.message);
      setMessage(error.response?.data?.detail || "❌ Failed to create item.");
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
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Coke, Fanta"
            required
          />
        </label>
        <label>
          Unit:
          <select
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            required
          >
            <option value="">Select Unit</option>
            {unitOptions.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </label>

        <label>
          Unit Price:
          <input
            type="number"
            step="0.01"
            value={newUnitPrice}
            onChange={(e) => setNewUnitPrice(e.target.value)}
            placeholder="e.g. 1000"
            required
          />
        </label>
        <label>
          Category:
          <select
            value={newCategoryId}
            onChange={(e) => setNewCategoryId(e.target.value)}
            required
          >
            <option value="">Select Category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
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
                <td>
                  <button className="edit-btn" onClick={() => openEditModal(item)}>
                    ✏️ Edit
                  </button>
                  <button className="delete-btn" onClick={() => handleDelete(item.id)}>
                    🗑 Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>✏️ Update Item</h3>

            {/* NEW: show select populated from /store/items/simple */}
            <label>
              Select Item (catalog):
              <select
                value={selectedSimpleItemId}
                onChange={(e) => handleSimpleItemChange(e.target.value)}
              >
                <option value="">-- Select Item --</option>
                {simpleItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.unit}) {it.unit_price ? `- ₦${it.unit_price}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <form onSubmit={handleUpdate}>
              <label>
                Name:
                <input
                  type="text"
                  value={updateName}
                  onChange={(e) => setUpdateName(e.target.value)}
                  required
                />
              </label>
              <label>
                Unit:
                <select
                  value={updateUnit}
                  onChange={(e) => setUpdateUnit(e.target.value)}
                  required
                >
                  <option value="">Select Unit</option>
                  {unitOptions.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </label>

              <label>
                Unit Price:
                <input
                  type="number"
                  step="0.01"
                  value={updateUnitPrice}
                  onChange={(e) => setUpdateUnitPrice(e.target.value)}
                  required
                />
              </label>
              <label>
                Category:
                <select
                  value={updateCategoryId}
                  onChange={(e) => setUpdateCategoryId(e.target.value)}
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="modal-buttons">
                <button type="submit" className="save-btn">💾 Save</button>
                <button type="button" className="cancel-btn" onClick={() => setEditingItem(null)}>
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

export default ListItem;
