import React, { useEffect, useState } from "react";
import "./UserManagement.css";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const roleOptions = ["user", "admin", "dashboard", "bar", "restaurant", "store", "event"];

const UserManagement = ({ token }) => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [popupMsg, setPopupMsg] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [editRoles, setEditRoles] = useState([]);
  const [editPassword, setEditPassword] = useState("");
  const [selectedAction, setSelectedAction] = useState("list");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRoles, setNewRoles] = useState(["user"]);
  const [adminPassword, setAdminPassword] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userToDelete, setUserToDelete] = useState(null);


const [resetUser, setResetUser] = useState(null);
const [resetPassword, setResetPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");



  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setError("You must be logged in");
      return;
    }
    
    fetchUsers();
    fetchUserRole();  // 👈 add this
  }, [token]);

  const fetchUserRole = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to fetch user role");
      // ✅ now array, but we can just take first or store full
      setUserRole(data.roles?.includes("admin") ? "admin" : "user");
      localStorage.setItem("roles", JSON.stringify(data.roles));
    } catch (err) {
      console.error("Error fetching role:", err);
      setError("Unable to determine user role");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to fetch users");
      setUsers(data);
    } catch (err) {
      setError(err.message || "Network error");
    }
  };

  const showPopup = (msg) => {
    setPopupMsg(msg);
    setTimeout(() => setPopupMsg(""), 3000);
  };

  const handleEditClick = (user) => {
    setEditingUser(user);
    setEditRoles(user.roles || []); // ✅ array
    setEditPassword("");
    setSelectedAction("update");
    setError("");
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEditPassword("");
    setEditRoles([]);
    setSelectedAction("list");
  };

  const confirmDeleteUser = (username) => {
    setUserToDelete(username);
  };

  const handleConfirmDelete = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userToDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Delete failed");

      showPopup(data.message || `User ${userToDelete} deleted successfully`);
      fetchUsers();
      setUserToDelete(null);
    } catch (err) {
      showPopup(err.message || "Delete failed");
    }
  };

  const submitUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/users/${editingUser.username}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: editingUser.username,
          roles: editRoles, // ✅ only roles now
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Update failed");
      }
      showPopup(`User ${editingUser.username} updated`);
      cancelEdit();
      fetchUsers();
    } catch (err) {
      showPopup(err.message || "Update failed");
    }
  };

  const submitResetPassword = async () => {
    if (resetPassword !== confirmPassword) {
      showPopup("Passwords do not match");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/users/${resetUser.username}/reset_password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Reset failed");
      showPopup(data.message || "Password reset successful");
      setResetUser(null);
      setResetPassword("");
      setConfirmPassword("");
    } catch (err) {
      showPopup(err.message || "Reset failed");
    }
  };



  const handleCancelDelete = () => {
    setUserToDelete(null);
  };

  const submitAddUser = async (e) => {
    e.preventDefault();
    if (userRole !== "admin") {
      showPopup("Insufficient permissions");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/users/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          roles: newRoles, // ✅ array
          admin_password: adminPassword,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to create user");
      }
      showPopup(`User "${newUsername}" created`);
      setNewUsername("");
      setNewPassword("");
      setNewRoles(["user"]);
      setAdminPassword("");
      setSelectedAction("list");
      fetchUsers();
    } catch (err) {
      showPopup(err.message || "Create failed");
    }
  };

  const toggleRole = (role, setState, state) => {
    if (state.includes(role)) {
      setState(state.filter((r) => r !== role));
    } else {
      setState([...state, role]);
    }
  };

  return (
    <div className="user-container small-frame">
      <div className="user-header">
        <h2 className="user-heading">User Management</h2>
        <div className="header-right">
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setEditingUser(null);
            }}
          >
            <option value="list">List Users</option>
            {userRole === "admin" && <option value="add">Add User</option>}
            <option value="update" disabled={!editingUser}>
              Edit User
            </option>
          </select>
          {selectedAction === "list" && (
            <button
              className="close-main-button"
              onClick={() => navigate("/dashboard/rooms/status")}
            >
              ❌
            </button>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {popupMsg && <div className="popup-inside">{popupMsg}</div>}

      {/* 👥 List users */}
      {selectedAction === "list" && (
        <div className="user-table compact">
          <div className="table-header">
            <div>ID</div>
            <div>Username</div>
            <div>Roles</div>
            <div>Action</div>
          </div>
          {users.map((user) => (
            <div className="table-row" key={user.id}>
              <div>{user.id}</div>
              <div>{user.username}</div>
              <div>{(user.roles || []).join(", ")}</div>
              <div className="action-buttons">
              <button className="btn edit" onClick={() => handleEditClick(user)}>✏️ Edit Role</button>
              <button className="btn delete" onClick={() => confirmDeleteUser(user.username)}
                disabled={user.username === localStorage.getItem("username")}>
                🗑️ Delete
              </button>
              <button className="btn reset" onClick={() => setResetUser(user)}>🔑 Reset Password</button>
            </div>

            </div>
          ))}
        </div>
      )}

      {/* 🗑️ Confirm delete */}
      {userToDelete && (
        <div className="delete-user-modal">
          <div className="modal-overlay" onClick={handleCancelDelete}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close-btn" onClick={handleCancelDelete}>
                ✖
              </button>
              <h3>Confirm Delete</h3>
              <p>
                Are you sure you want to delete user{" "}
                <strong>{userToDelete}</strong>?
              </p>
              <div className="modal-actions">
                <button
                  className="action-btn delete"
                  onClick={handleConfirmDelete}
                >
                  🗑️ Yes, Delete
                </button>
                <button
                  className="action-btn cancel"
                  onClick={handleCancelDelete}
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ➕ Add user */}
      {selectedAction === "add" && userRole === "admin" && (
        <form onSubmit={submitAddUser} className="edit-form compact-form">
          <div className="edit-header">
            <h4>Add New User</h4>
          </div>
          <label>Username:
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
            />
          </label>
          <label>Password:
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>

          <div className="roles-checkboxes">
            {roleOptions.map((role) => (
              <label key={role}>
                <input
                  type="checkbox"
                  checked={newRoles.includes(role)}
                  onChange={() => toggleRole(role, setNewRoles, newRoles)}
                />
                {role}
              </label>
            ))}
          </div>

          <label>Admin Password:
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
            />
          </label>
          <div className="form-buttons">
            <button type="submit">Create</button>
            <button type="button" onClick={() => setSelectedAction("list")}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {resetUser && (
      <div className="reset-password-modal">
        <div className="modal-overlay" onClick={() => setResetUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setResetUser(null)}>✖</button>
            <h3>Reset Password for {resetUser.username}</h3>
            <label>New Password:
              <input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
            </label>
            <label>Confirm Password:
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button className="action-btn save" onClick={submitResetPassword}>✅ Reset</button>
              <button className="action-btn cancel" onClick={() => setResetUser(null)}>❌ Cancel</button>
            </div>
          </div>
        </div>
      </div>
    )}


      {/* ✏️ Update user */}
      {selectedAction === "update" && editingUser && (
        <form onSubmit={submitUpdate} className="edit-form compact-form">
          <div className="edit-header">
            <h4>Edit Roles: {editingUser.username}</h4>
          </div>

          <div className="roles-checkboxes">
            {roleOptions.map((role) => (
              <label key={role}>
                <input
                  type="checkbox"
                  checked={editRoles.includes(role)}
                  onChange={() => toggleRole(role, setEditRoles, editRoles)}
                />
                {role}
              </label>
            ))}
          </div>

          <div className="form-buttons">
            <button type="submit">💾 Save</button>
            <button type="button" onClick={cancelEdit}>
              ❌ Cancel
            </button>
          </div>
        </form>
      )}

    </div>
  );
};

export default UserManagement;
