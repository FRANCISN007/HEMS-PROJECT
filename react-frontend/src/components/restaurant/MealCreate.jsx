import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./MealCreate.css";

const MealCreate = ({ onClose }) => {
  const [meals, setMeals] = useState([]);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newMeal, setNewMeal] = useState({
    name: "",
    description: "",
    price: "",
    location_id: "",
    category_id: "",
  });
  const [editId, setEditId] = useState(null);
  const [editMeal, setEditMeal] = useState({
    name: "",
    description: "",
    price: "",
    location_id: "",
    category_id: "",
  });
  const [message, setMessage] = useState("");

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];

  if (Array.isArray(storedUser.roles)) {
    roles = storedUser.roles;
  } else if (typeof storedUser.role === "string") {
    roles = [storedUser.role];
  }

  roles = roles.map((r) => r.toLowerCase());


  if (!(roles.includes("admin") || roles.includes("restaurant"))) {
  return (
    <div className="unauthorized">
      <h2>🚫 Access Denied</h2>
      <p>You do not have permission to create meal.</p>
    </div>
  );
}

  useEffect(() => {
    fetchMeals();
    fetchLocations();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchMeals = async () => {
    try {
      const res = await axiosWithAuth().get("/restaurant/meals");
      setMeals(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch meals:", err);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await axiosWithAuth().get("/restaurant/locations");
      setLocations(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch locations:", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axiosWithAuth().get("/restaurant/meal-categories");
      setCategories(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch categories:", err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axiosWithAuth().post("/restaurant/meals", newMeal);
      setNewMeal({ name: "", description: "", price: "", location_id: "", category_id: "" });
      setMessage("✅ Meal created successfully!");
      fetchMeals();
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Failed to create meal.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this meal?")) return;
    try {
      await axiosWithAuth().delete(`/restaurant/meals/${id}`);
      setMeals(meals.filter((meal) => meal.id !== id));
    } catch (err) {
      alert("❌ Failed to delete meal.");
    }
  };

  const handleUpdate = async (id) => {
    try {
      await axiosWithAuth().put(`/restaurant/meals/${id}`, editMeal);
      setEditId(null);
      setEditMeal({ name: "", description: "", price: "", location_id: "", category_id: "" });
      fetchMeals();
    } catch (err) {
      alert("❌ Failed to update meal.");
    }
  };

  return (
    <div className="meal-container">
      <div className="meal-header">
        <h2>🍽️ Meals</h2>
        {onClose && <button className="close-btn" onClick={onClose}>×</button>}
      </div>

      {/* Create Form */}
      <form className="meal-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Meal Name"
          value={newMeal.name}
          onChange={(e) => setNewMeal({ ...newMeal, name: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Description"
          value={newMeal.description}
          onChange={(e) => setNewMeal({ ...newMeal, description: e.target.value })}
        />
        <input
          type="number"
          placeholder="Price"
          value={newMeal.price}
          onChange={(e) => setNewMeal({ ...newMeal, price: e.target.value })}
          required
        />
        <select
          value={newMeal.location_id}
          onChange={(e) => setNewMeal({ ...newMeal, location_id: e.target.value })}
          required
        >
          <option value="">Select Location</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
        <select
          value={newMeal.category_id}
          onChange={(e) => setNewMeal({ ...newMeal, category_id: e.target.value })}
          required
        >
          <option value="">Select Category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <button type="submit">➕ Add Meal</button>
      </form>

      {/* Table List */}
      <table className="meal-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Meal Name</th>
            <th>Description</th>
            <th>Price</th>
            <th>Location</th>
            <th>Category</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {meals.map((meal, index) => (
            <tr key={meal.id} className={index % 2 === 0 ? "even-row" : "odd-row"}>
              <td>{meal.id}</td>
              <td>
                {editId === meal.id ? (
                  <input
                    value={editMeal.name}
                    onChange={(e) => setEditMeal({ ...editMeal, name: e.target.value })}
                  />
                ) : (
                  meal.name
                )}
              </td>
              <td>
                {editId === meal.id ? (
                  <input
                    value={editMeal.description}
                    onChange={(e) => setEditMeal({ ...editMeal, description: e.target.value })}
                  />
                ) : (
                  meal.description || "—"
                )}
              </td>
              <td>
                {editId === meal.id ? (
                <input
                    type="number"
                    value={editMeal.price}
                    onChange={(e) => setEditMeal({ ...editMeal, price: e.target.value })}
                />
                ) : (
                new Intl.NumberFormat("en-NG", {
                    style: "currency",
                    currency: "NGN",
                    minimumFractionDigits: 0,
                }).format(meal.price)
                )}

              </td>
              <td>
                {editId === meal.id ? (
                  <select
                    value={editMeal.location_id}
                    onChange={(e) => setEditMeal({ ...editMeal, location_id: e.target.value })}
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                ) : (
                  locations.find((loc) => loc.id === meal.location_id)?.name || "—"
                )}
              </td>
              <td>
                {editId === meal.id ? (
                  <select
                    value={editMeal.category_id}
                    onChange={(e) => setEditMeal({ ...editMeal, category_id: e.target.value })}
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                ) : (
                  categories.find((cat) => cat.id === meal.category_id)?.name || "—"
                )}
              </td>
              <td>
                {editId === meal.id ? (
                  <>
                    <button className="action-btn save" onClick={() => handleUpdate(meal.id)}>💾 Save</button>
                    <button className="action-btn cancel" onClick={() => setEditId(null)}>❌ Cancel</button>
                  </>
                ) : (
                  <>
                    <button
                      className="action-btn update"
                      onClick={() => {
                        setEditId(meal.id);
                        setEditMeal({
                          name: meal.name,
                          description: meal.description || "",
                          price: meal.price,
                          location_id: meal.location_id,
                          category_id: meal.category_id,
                        });
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button className="action-btn delete" onClick={() => handleDelete(meal.id)}>🗑️ Delete</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {message && <p className="meal-message">{message}</p>}
    </div>
  );
};

export default MealCreate;
