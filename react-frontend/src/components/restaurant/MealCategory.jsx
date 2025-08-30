import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./MealCategory.css";

const MealCategory = ({ onClose }) => {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: "" });
  const [editId, setEditId] = useState(null);
  const [editCategory, setEditCategory] = useState({ name: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchCategories = async () => {
    try {
      const res = await axiosWithAuth().get("/restaurant/meal-categories");
      setCategories(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch meal categories:", err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axiosWithAuth().post("/restaurant/meal-categories", newCategory);
      setNewCategory({ name: "" });
      setMessage("✅ Meal category created successfully!");
      fetchCategories();
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Failed to create meal category.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    try {
      await axiosWithAuth().delete(`/restaurant/meal-categories/${id}`);
      setCategories(categories.filter((cat) => cat.id !== id));
    } catch (err) {
      alert("❌ Failed to delete category.");
    }
  };

  const handleUpdate = async (id) => {
    try {
      await axiosWithAuth().put(`/restaurant/meal-categories/${id}`, editCategory);
      setEditId(null);
      setEditCategory({ name: "" });
      fetchCategories();
    } catch (err) {
      alert("❌ Failed to update category.");
    }
  };

  return (
    <div className="category-container">
      <div className="category-header">
        <h2>🍽️ Meal Categories</h2>
        {onClose && <button className="close-btn" onClick={onClose}>×</button>}
      </div>

      {/* Create Form */}
      <form className="category-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Category Name"
          value={newCategory.name}
          onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
          required
        />
        <button type="submit">➕ Add Category</button>
      </form>

      {/* Table List */}
      <table className="category-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Category Name</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat, index) => (
            <tr key={cat.id} className={index % 2 === 0 ? "even-row" : "odd-row"}>
              <td>{cat.id}</td>
              <td>
                {editId === cat.id ? (
                  <input
                    value={editCategory.name}
                    onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })}
                  />
                ) : (
                  cat.name
                )}
              </td>
              <td>
                {editId === cat.id ? (
                  <>
                    <button className="action-btn save" onClick={() => handleUpdate(cat.id)}>💾 Save</button>
                    <button className="action-btn cancel" onClick={() => setEditId(null)}>❌ Cancel</button>
                  </>
                ) : (
                  <>
                    <button
                      className="action-btn update"
                      onClick={() => {
                        setEditId(cat.id);
                        setEditCategory({ name: cat.name });
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button className="action-btn delete" onClick={() => handleDelete(cat.id)}>🗑️ Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {message && <p className="category-message">{message}</p>}
    </div>
  );
};

export default MealCategory;
