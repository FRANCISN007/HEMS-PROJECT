import React, { useState, useEffect } from "react";
import axios from "axios";
import "./CreateBank.css";

import getBaseUrl from "../../api/config";
const API_BASE_URL = getBaseUrl();


const CreateBank = () => {
  const [bankName, setBankName] = useState("");
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const token = localStorage.getItem("token");

  // Fetch banks
  const fetchBanks = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/bank/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBanks(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  // Create Bank
  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/bank/`,
        { name: bankName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(`✅ Bank "${res.data.name}" created!`);
      setBankName("");
      fetchBanks();
    } catch (err) {
      setError(err.response?.data?.detail || "❌ Failed to create bank.");
    } finally {
      setLoading(false);
    }
  };

  // Delete Bank
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this bank?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/bank/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage("✅ Bank deleted successfully!");
      fetchBanks();
    } catch (err) {
      setError(err.response?.data?.detail || "❌ Failed to delete bank.");
    }
  };

  // Open edit modal
  const handleEdit = (bank) => {
    setEditId(bank.id);
    setEditName(bank.name);
  };

  // Update Bank
  const handleUpdate = async () => {
    if (!editName.trim()) return;
    try {
      await axios.put(
        `${API_BASE_URL}/bank/${editId}`,
        { name: editName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage("✅ Bank updated successfully!");
      setEditId(null);
      setEditName("");
      fetchBanks();
    } catch (err) {
      setError(err.response?.data?.detail || "❌ Failed to update bank.");
    }
  };

  return (
    <div className="create-bank-container">
      <h2 className="create-bank-title">🏦 Bank Management</h2>

      {/* Add Bank */}
      <form className="create-bank-form" onSubmit={handleCreate}>
        <div className="form-group">
          <label htmlFor="bankName">Bank Name</label>
          <input
            type="text"
            id="bankName"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Enter bank name"
            required
          />
        </div>
        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? "Creating..." : "Add Bank"}
        </button>
      </form>

      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}

      {/* Bank List */}
      <h3 className="bank-list-title">List of Banks</h3>
      <table className="bank-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Bank Name</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {banks.map((bank) => (
            <tr key={bank.id}>
              <td>{bank.id}</td>
              <td>
                {editId === bank.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                ) : (
                  bank.name
                )}
              </td>
              <td>
                {editId === bank.id ? (
                  <>
                    <button className="edit-btn" onClick={handleUpdate}>
                      Save
                    </button>
                    <button
                      className="cancel-btn"
                      onClick={() => setEditId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="edit-btn"
                      onClick={() => handleEdit(bank)}
                    >
                      Edit
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(bank.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CreateBank;
