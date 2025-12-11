import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./CreateKitchen.css";

const CreateKitchen = ({ onClose }) => {
  const [kitchens, setKitchens] = useState([]);
  const [newKitchen, setNewKitchen] = useState({ name: "" });
  const [editId, setEditId] = useState(null);
  const [editKitchen, setEditKitchen] = useState({ name: "" });
  const [message, setMessage] = useState("");

  // ✅ Get user roles
  const user = JSON.parse(localStorage.getItem("user")) || {};
  const roles = user.roles || [];

  // Only admin + store should manage kitchens
  if (!(roles.includes("admin") || roles.includes("store"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to manage kitchens.</p>
      </div>
    );
  }

  useEffect(() => {
    fetchKitchens();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchKitchens = async () => {
    try {
        const res = await axiosWithAuth().get("/kitchen/");
        setKitchens(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
        console.error("❌ Failed to fetch kitchens:", err);
        setKitchens([]);
    }
    };


  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axiosWithAuth().post("/kitchen/", newKitchen);
      setNewKitchen({ name: "" });
      setMessage("✅ Kitchen created successfully!");
      fetchKitchens();
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Failed to create kitchen.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this kitchen?")) return;

    try {
      await axiosWithAuth().delete(`/kitchen/${id}`);
      setKitchens(kitchens.filter((k) => k.id !== id));
      setMessage("🗑️ Kitchen deleted!");
    } catch (err) {
      setMessage(err.response?.data?.detail || "❌ Cannot delete kitchen.");
    }
  };

  const handleUpdate = async (id) => {
    try {
      await axiosWithAuth().put(`/kitchen/${id}`, editKitchen);
      setEditId(null);
      setEditKitchen({ name: "" });
      fetchKitchens();
      setMessage("💾 Kitchen updated!");
    } catch (err) {
      setMessage("❌ Failed to update kitchen.");
    }
  };

  return (
    <div className="kitchen-container">
      <div className="kitchen-header">
        <h2>🍽️ Kitchen Management</h2>
        {onClose && <button className="close-btn" onClick={onClose}>×</button>}
      </div>

      <form className="kitchen-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Kitchen Name"
          value={newKitchen.name}
          onChange={(e) => setNewKitchen({ name: e.target.value })}
          required
        />
        <button type="submit">➕ Add Kitchen</button>
      </form>

      <table className="kitchen-table">
        <thead>
          <tr>
            <th>Id</th>
            <th>Kitchen Name</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {kitchens.map((k, index) => (
            <tr key={k.id} className={index % 2 === 0 ? "even-row" : "odd-row"}>
              <td>{k.id}</td>
              <td>
                {editId === k.id ? (
                  <input
                    value={editKitchen.name}
                    onChange={(e) =>
                      setEditKitchen({ ...editKitchen, name: e.target.value })
                    }
                  />
                ) : (
                  k.name
                )}
              </td>

              <td>
                {editId === k.id ? (
                  <>
                    <button className="action-btn save" onClick={() => handleUpdate(k.id)}>💾 Save</button>
                    <button className="action-btn cancel" onClick={() => setEditId(null)}>❌ Cancel</button>
                  </>
                ) : (
                  <>
                    <button
                      className="action-btn update"
                      onClick={() => {
                        setEditId(k.id);
                        setEditKitchen({ name: k.name });
                      }}
                    >
                      ✏️ Edit
                    </button>

                    <button
                      className="action-btn delete"
                      onClick={() => handleDelete(k.id)}
                    >
                      🗑️ Delete
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {message && <p className="kitchen-message">{message}</p>}
    </div>
  );
};

export default CreateKitchen;
