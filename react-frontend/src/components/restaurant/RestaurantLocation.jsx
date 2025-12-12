import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./RestaurantLocation.css";

const RestaurantLocation = ({ onClose }) => {
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState({ name: "", active: true });
  const [editId, setEditId] = useState(null);
  const [editLocation, setEditLocation] = useState({ name: "", active: true });
  const [message, setMessage] = useState("");

  // User role check
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];
  if (Array.isArray(storedUser.roles)) roles = storedUser.roles;
  else if (typeof storedUser.role === "string") roles = [storedUser.role];
  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("restaurant"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to create restaurant location.</p>
      </div>
    );
  }

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Fetch locations from backend
  const fetchLocations = async () => {
    try {
      const res = await axiosWithAuth().get("/restaurant/locations");
      setLocations(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("❌ Failed to fetch locations:", err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axiosWithAuth().post("/restaurant/locations", newLocation);
      setNewLocation({ name: "", active: true });
      setMessage("✅ Location created successfully!");
      fetchLocations();
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Failed to create location.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this location?")) return;
    try {
      await axiosWithAuth().delete(`/restaurant/locations/${id}`);
      setLocations(locations.filter((loc) => loc.id !== id));
    } catch (err) {
      alert("❌ Failed to delete location.");
    }
  };

  const handleUpdate = async (id) => {
    try {
      await axiosWithAuth().put(`/restaurant/locations/${id}`, editLocation);
      setEditId(null);
      setEditLocation({ name: "", active: true });
      fetchLocations();
    } catch (err) {
      alert("❌ Failed to update location.");
    }
  };

  return (
    <div className="location-container">
      <div className="location-header">
        <h2>📍 Restaurant Locations</h2>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      {/* Create Form */}
      <form className="location-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Location Name"
          value={newLocation.name}
          onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
          required
        />
        <label>
          Active:
          <input
            type="checkbox"
            checked={newLocation.active}
            onChange={(e) => setNewLocation({ ...newLocation, active: e.target.checked })}
          />
        </label>
        <button type="submit">➕ Add Location</button>
      </form>

      {/* Table List */}
      <table className="location-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Location Name</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(locations) &&
            locations.map((loc, index) => (
              <tr key={loc.id} className={index % 2 === 0 ? "even-row" : "odd-row"}>
                <td>{loc.id}</td>
                <td>
                  {editId === loc.id ? (
                    <input
                      value={editLocation.name}
                      onChange={(e) => setEditLocation({ ...editLocation, name: e.target.value })}
                    />
                  ) : (
                    loc.name
                  )}
                </td>
                <td>
                  {editId === loc.id ? (
                    <input
                      type="checkbox"
                      checked={editLocation.active}
                      onChange={(e) => setEditLocation({ ...editLocation, active: e.target.checked })}
                    />
                  ) : loc.active ? (
                    "✅ Active"
                  ) : (
                    "❌ Inactive"
                  )}
                </td>
                <td>
                  {editId === loc.id ? (
                    <>
                      <button className="action-btn save" onClick={() => handleUpdate(loc.id)}>
                        💾 Save
                      </button>
                      <button className="action-btn cancel" onClick={() => setEditId(null)}>
                        ❌ Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="action-btn update"
                        onClick={() => {
                          setEditId(loc.id);
                          setEditLocation({ name: loc.name, active: loc.active });
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button className="action-btn delete" onClick={() => handleDelete(loc.id)}>
                        🗑️ Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {message && <p className="location-message">{message}</p>}
    </div>
  );
};

export default RestaurantLocation;
