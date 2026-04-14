import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import "./UserManagement.css";
import getBaseUrl from "../../api/config";

const API_BASE_URL = getBaseUrl();

const baseRoleOptions = ["user", "admin", "dashboard", "bar", "restaurant", "store", "event"];
const superAdminRole = "super_admin";

const UserManagement = () => {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [popupMsg, setPopupMsg] = useState("");
  const [selectedAction, setSelectedAction] = useState("list");

  // User states
  const [editingUser, setEditingUser] = useState(null);
  const [editRoles, setEditRoles] = useState([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRoles, setNewRoles] = useState(["user"]);
  const [adminPassword, setAdminPassword] = useState("");
  const [newBusinessId, setNewBusinessId] = useState("");

  const [userToDelete, setUserToDelete] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Business (Hotel/Tenant) states - Multi-tenant support
  const [businesses, setBusinesses] = useState([]);
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [newBusiness, setNewBusiness] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    owner_username: "",
  });
  const [businessToDelete, setBusinessToDelete] = useState(null);

  // License states
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [newLicense, setNewLicense] = useState({
    license_password: "",
    key: "",
    duration_days: 365,
    business_id: "",
  });

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentRoles = (Array.isArray(storedUser.roles) ? storedUser.roles : [])
    .map(r => r.toLowerCase());
  const isSuperAdmin = currentRoles.includes("super_admin");
  const isAdmin = currentRoles.includes("admin") || isSuperAdmin;

  const availableRoles = isSuperAdmin 
    ? [...baseRoleOptions, superAdminRole] 
    : baseRoleOptions;

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const url = isSuperAdmin
        ? `${API_BASE_URL}/users/`
        : `${API_BASE_URL}/users/?business_only=true`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();

      // ✅ Sort users by business_id ascending (Business 1, 2, 3...)
      // Users with no business_id (global/super_admin) appear first
      const sortedUsers = [...data].sort((a, b) => {
        const businessA = a.business_id || 0;
        const businessB = b.business_id || 0;
        return businessA - businessB;
      });

      setUsers(sortedUsers);
    } catch (err) {
      setError("Could not load users");
    }
  }, [token, isSuperAdmin]);

  const fetchBusinesses = useCallback(async () => {
    if (!token || !isSuperAdmin) return;
    try {
      const res = await fetch(`${API_BASE_URL}/business/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load businesses");
      const data = await res.json();
      
      // ✅ Sort businesses alphabetically by NAME (A to Z)
      const sortedBusinesses = (data.businesses || []).sort((a, b) => 
        (a.name || "").localeCompare(b.name || "")
      );
      setBusinesses(sortedBusinesses);
    } catch (err) {
      setError("Could not load businesses");
    }
  }, [token, isSuperAdmin]);

  const fetchLicenseStatus = useCallback(async () => {
    if (!token || !isSuperAdmin) return;
    try {
      const res = await fetch(`${API_BASE_URL}/license/check`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load license status");
      const data = await res.json();
      setLicenseStatus(data);
    } catch (err) {
      setError("Could not load license status");
    }
  }, [token, isSuperAdmin]);

  useEffect(() => {
    if (!token) {
      setError("You must be logged in");
      return;
    }
    fetchUsers();
    if (isSuperAdmin) {
      fetchBusinesses();
      fetchLicenseStatus();
    }
  }, [token, fetchUsers, fetchBusinesses, fetchLicenseStatus, isSuperAdmin]);

  const showPopup = (msg) => {
    setPopupMsg(msg);
    setTimeout(() => setPopupMsg(""), 3000);
  };

  // User functions (identical pattern to Shopman)
  const handleEditClick = (user) => {
    setEditingUser(user);
    setEditRoles(user.roles?.map(r => r.toLowerCase()) || []);
    setSelectedAction("update");
    setError("");
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEditRoles([]);
    setSelectedAction("list");
  };

  const confirmDeleteUser = (username) => {
    if (username === storedUser.username) {
      showPopup("You cannot delete your own account here");
      return;
    }
    setUserToDelete(username);
  };

  const handleConfirmDelete = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userToDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      showPopup(`User ${userToDelete} deleted`);
      fetchUsers();
      setUserToDelete(null);
    } catch (err) {
      showPopup("Failed to delete user");
    }
  };

  const submitUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(
        `${API_BASE_URL}/users/${editingUser.username}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ roles: editRoles }),
        }
      );
      if (!res.ok) throw new Error("Update failed");
      showPopup(`User ${editingUser.username} updated`);
      cancelEdit();
      fetchUsers();
    } catch (err) {
      showPopup("Failed to update user");
    }
  };

  const submitResetPassword = async () => {
    if (resetPassword !== confirmPassword) {
      showPopup("Passwords do not match");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/users/${resetUser.username}/reset_password`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ new_password: resetPassword }),
        }
      );
      if (!res.ok) throw new Error("Reset failed");
      showPopup("Password reset successful");
      setResetUser(null);
      setResetPassword("");
      setConfirmPassword("");
    } catch (err) {
      showPopup("Failed to reset password");
    }
  };

  const submitAddUser = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      showPopup("Insufficient permissions");
      return;
    }

    if (!newUsername.trim() || !newPassword) {
      showPopup("Username and password are required");
      return;
    }

    let businessIdPayload = null;
    const businessIdStr = newBusinessId.trim();

    if (!isSuperAdmin) {
      if (!businessIdStr) {
        showPopup("Business ID is required");
        return;
      }
      const parsed = parseInt(businessIdStr, 10);
      if (isNaN(parsed) || parsed <= 0) {
        showPopup("Invalid Business ID");
        return;
      }
      businessIdPayload = parsed;
    } else if (businessIdStr) {
      const parsed = parseInt(businessIdStr, 10);
      if (!isNaN(parsed) && parsed > 0) {
        businessIdPayload = parsed;
      } else {
        showPopup("Invalid Business ID format");
        return;
      }
    }

    if (!isSuperAdmin && !adminPassword) {
      showPopup("Admin password confirmation is required");
      return;
    }

    try {
      const payload = {
        username: newUsername.trim().toLowerCase(),
        password: newPassword,
        roles: newRoles,
      };

      if (!isSuperAdmin) payload.admin_password = adminPassword;
      if (businessIdPayload !== null) payload.business_id = businessIdPayload;

      const res = await fetch(`${API_BASE_URL}/users/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "User creation failed");
      }

      showPopup(`User "${newUsername}" created successfully`);
      setSelectedAction("list");
      setNewUsername("");
      setNewPassword("");
      setNewRoles(["user"]);
      setAdminPassword("");
      setNewBusinessId("");
      fetchUsers();
    } catch (err) {
      showPopup("Failed to create user");
    }
  };

  const toggleRole = (role, setState, state) => {
    if (state.includes(role)) {
      setState(state.filter(r => r !== role));
    } else {
      setState([...state, role]);
    }
  };

  // ───────────────────────────────────────────────
  // BUSINESS (HOTEL/TENANT) MANAGEMENT (super admin only)
  // ───────────────────────────────────────────────

  const handleCreateBusiness = async (e) => {
    e.preventDefault();
    if (!newBusiness.name.trim() || !newBusiness.owner_username.trim()) {
      showPopup("Name and Owner Username are required");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/business/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newBusiness),
      });

      if (!res.ok) throw new Error("Create failed");
      showPopup("Business created successfully");
      setSelectedAction("list");
      setNewBusiness({
        name: "",
        address: "",
        phone: "",
        email: "",
        owner_username: "",
      });
      fetchBusinesses();
    } catch (err) {
      showPopup("Failed to create business");
    }
  };

  const handleUpdateBusiness = async (e) => {
    e.preventDefault();
    if (!editingBusiness) return;

    try {
      const res = await fetch(`${API_BASE_URL}/business/${editingBusiness.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingBusiness),
      });

      if (!res.ok) throw new Error("Update failed");
      showPopup("Business updated");
      setEditingBusiness(null);
      setSelectedAction("list");
      fetchBusinesses();
    } catch (err) {
      showPopup("Failed to update business");
    }
  };

  const handleDeleteBusiness = async () => {
    if (!businessToDelete) return;

    try {
      const res = await fetch(`${API_BASE_URL}/business/${businessToDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Delete failed");
      showPopup("Business deleted");
      setBusinessToDelete(null);
      fetchBusinesses();
    } catch (err) {
      showPopup("Failed to delete business");
    }
  };

  // ───────────────────────────────────────────────
  // LICENSE MANAGEMENT (super admin only)
  // ───────────────────────────────────────────────

  const handleGenerateLicense = async (e) => {
    e.preventDefault();

    if (!newLicense.license_password || !newLicense.key || !newLicense.business_id) {
      showPopup("License password, key and business ID are required");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("license_password", newLicense.license_password);
      formData.append("key", newLicense.key);
      formData.append("duration_days", newLicense.duration_days);
      formData.append("business_id", newLicense.business_id);

      const res = await fetch(`${API_BASE_URL}/license/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to generate license");
      }

      showPopup("License generated successfully");
      setSelectedAction("license-management");
      setNewLicense({
        license_password: "",
        key: "",
        duration_days: 365,
        business_id: "",
      });
      fetchLicenseStatus();
    } catch (err) {
      showPopup(err.message || "Failed to generate license");
    }
  };

  const refreshAll = () => {
    fetchUsers();
    if (isSuperAdmin) {
      fetchBusinesses();
      fetchLicenseStatus();
    }
    showPopup("Data refreshed successfully");
  };

  return (
    <div className={`user-container small-frame ${isSuperAdmin ? "super-admin-mode" : ""}`}>
      {!isAdmin ? (
        <div className="unauthorized">
          <h2>🚫 Access Denied</h2>
          <p>You do not have permission to manage users.</p>
        </div>
      ) : (
        <>
          <div className="user-header">
            <h2 className={`user-heading ${isSuperAdmin ? "super-admin" : ""}`}>
              {isSuperAdmin ? "Super Admin Tools" : "Hotel User Management"}
            </h2>

            <div className="header-right">
              <select
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setEditingUser(null);
                  setEditingBusiness(null);
                }}
              >
                <option value="list">List Users</option>
                <option value="add">Add User</option>

                {isSuperAdmin && (
                  <>
                    <option value="list-businesses">Business Management</option>
                    <option value="create-business">Create Business</option>
                    <option value="license-management">License Management</option>
                  </>
                )}
              </select>

              {isSuperAdmin && (
                <button 
                  className="btn refresh"
                  onClick={refreshAll}
                  title="Refresh all data"
                >
                  🔄 Refresh
                </button>
              )}

              {selectedAction === "list" && (
                <button
                  className="close-main-button"
                  onClick={() => navigate("/dashboard/rooms/status", { replace: true })}
                >
                  ❌
                </button>
              )}
            </div>
          </div>

          {error && <div className="error">{error}</div>}
          {popupMsg && <div className="popup-inside success">{popupMsg}</div>}

          {/* LIST USERS - NOW SORTED BY BUSINESS ID ASCENDING */}
          {selectedAction === "list" && (
            <div className={`user-table compact ${isSuperAdmin ? "super-admin-table" : ""}`}>
              <div className={`table-header ${isSuperAdmin ? "with-business" : ""}`}>
                <div>ID</div>
                <div>Username</div>
                <div>Roles</div>
                {isSuperAdmin && <div>Business</div>}
                <div>Actions</div>
              </div>

              {users.map((user) => {
                const isSuper = user.roles?.some(r => r.toLowerCase() === superAdminRole);
                return (
                  <div className={`table-row ${isSuperAdmin ? "with-business" : ""}`} key={user.id}>
                    <div>{user.id}</div>
                    <div>{user.username}</div>
                    <div>{(user.roles || []).join(", ")}</div>
                    {isSuperAdmin && (
                      <div>
                        {user.business_id ? `Business #${user.business_id}` : "— Global —"}
                      </div>
                    )}
                    <div className="action-buttons">
                      <button
                        className="btn edit"
                        onClick={() => handleEditClick(user)}
                        disabled={!isSuperAdmin && isSuper}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn delete"
                        onClick={() => confirmDeleteUser(user.username)}
                        disabled={user.username === storedUser.username || (!isSuperAdmin && isSuper)}
                      >
                        🗑️ Delete
                      </button>
                      <button
                        className="btn reset"
                        onClick={() => setResetUser(user)}
                        disabled={!isSuperAdmin && isSuper}
                      >
                        🔑 Reset PW
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ADD USER FORM */}
          {selectedAction === "add" && (
            <form onSubmit={submitAddUser} className={`edit-form compact-form ${isSuperAdmin ? "super-admin-form" : ""}`}>
              <div className="edit-header">
                <h4>Add New User {isSuperAdmin ? "(Any Level)" : "(Business Level)"}</h4>
              </div>

              <label>
                Username:
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value.trim())}
                  required
                />
              </label>

              <label>
                Password:
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
              </label>

              <label>
                Business ID:
                <input
                  type="number"
                  value={newBusinessId}
                  onChange={e => setNewBusinessId(e.target.value)}
                  placeholder={
                    isSuperAdmin
                      ? "Optional - leave blank for global/system user"
                      : "Required - enter business ID"
                  }
                  min="1"
                  step="1"
                  required={!isSuperAdmin}
                />
              </label>

              <div className="roles-checkboxes">
                {availableRoles.map(role => (
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

              {!isSuperAdmin && (
                <label>
                  Your Admin Password (required):
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    required
                    placeholder="Confirm your own password"
                  />
                </label>
              )}

              <div className="form-buttons">
                <button type="submit">Create User</button>
                <button type="button" onClick={() => setSelectedAction("list")}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* RESET PASSWORD MODAL */}
          {resetUser && (
            <div className="reset-password-modal">
              <div className="modal-overlay" onClick={() => setResetUser(null)}>
                <div
                  className="modal-content"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button className="close-btn" onClick={() => setResetUser(null)}>✖</button>

                  <h3>Reset Password for {resetUser.username}</h3>

                  <label>New Password:</label>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={e => setResetPassword(e.target.value)}
                  />

                  <label>Confirm Password:</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />

                  <div className="modal-actions">
                    <button className="action-btn save" onClick={submitResetPassword}>
                      ✅ Reset Password
                    </button>

                    <button
                      className="action-btn cancel"
                      onClick={() => setResetUser(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EDIT ROLES FORM */}
          {selectedAction === "update" && editingUser && (
            <form onSubmit={submitUpdate} className="edit-form compact-form">
              <div className="edit-header">
                <h4>Edit Roles: {editingUser.username}</h4>
              </div>

              <div className="roles-checkboxes">
                {availableRoles.map(role => (
                  <label key={role}>
                    <input
                      type="checkbox"
                      checked={editRoles.includes(role)}
                      onChange={() => toggleRole(role, setEditRoles, editRoles)}
                      disabled={
                        !isSuperAdmin &&
                        role === superAdminRole &&
                        editingUser.roles?.some(r => r.toLowerCase() === superAdminRole)
                      }
                    />
                    {role}
                  </label>
                ))}
              </div>

              <div className="form-buttons">
                <button type="submit">Save Changes</button>
                <button type="button" onClick={cancelEdit}>Cancel</button>
              </div>
            </form>
          )}

          {/* BUSINESS MANAGEMENT - SORTED BY NAME (A-Z) */}
          {isSuperAdmin && selectedAction === "list-businesses" && (
            <div className="business-section">
              <div className="section-header">
                <h3>Business Management</h3>
                <button
                  className="btn create"
                  onClick={() => setSelectedAction("create-business")}
                >
                  + Create New Business
                </button>
              </div>

              <div className={`user-table compact super-admin-table with-business`}>
                <div className="table-header with-business">
                  <div>ID</div>
                  <div>Expiring Date</div>
                  <div>Name</div>
                  <div>Owner</div>
                  <div>Email</div>
                  <div>License</div>
                  <div>Actions</div>
                </div>

                {businesses.length === 0 ? (
                  <p className="no-data">No businesses found.</p>
                ) : (
                  businesses.map(biz => (
                    <div className="table-row with-business" key={biz.id}>
                      <div>{biz.id}</div>
                      <div>
                        {biz.expiration_date 
                          ? new Date(biz.expiration_date).toLocaleDateString() 
                          : "—"}
                      </div>
                      <div>{biz.name}</div>
                      <div>{biz.owner_username || "—"}</div>
                      <div>{biz.email || "—"}</div>
                      <div>
                        {biz.license_active ? (
                          <span className="status-active">Yes</span>
                        ) : (
                          <span className="status-expired">No</span>
                        )}
                      </div>
                      <div className="action-buttons">
                        <button
                          className="btn edit"
                          onClick={() => {
                            setEditingBusiness(biz);
                            setSelectedAction("edit-business");
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="btn delete"
                          onClick={() => setBusinessToDelete(biz.id)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* CREATE BUSINESS FORM */}
          {isSuperAdmin && selectedAction === "create-business" && (
            <form onSubmit={handleCreateBusiness} className="edit-form compact-form super-admin-form">
              <div className="edit-header">
                <h4>Create New Business</h4>
              </div>

              <label>
                Business Name:
                <input
                  type="text"
                  value={newBusiness.name}
                  onChange={e => setNewBusiness({ ...newBusiness, name: e.target.value })}
                  required
                />
              </label>

              <label>
                Owner Username:
                <input
                  type="text"
                  value={newBusiness.owner_username}
                  onChange={e => setNewBusiness({ ...newBusiness, owner_username: e.target.value })}
                  required
                />
              </label>

              <label>
                Address:
                <input
                  type="text"
                  value={newBusiness.address}
                  onChange={e => setNewBusiness({ ...newBusiness, address: e.target.value })}
                />
              </label>

              <label>
                Phone:
                <input
                  type="text"
                  value={newBusiness.phone}
                  onChange={e => setNewBusiness({ ...newBusiness, phone: e.target.value })}
                />
              </label>

              <label>
                Email:
                <input
                  type="email"
                  value={newBusiness.email}
                  onChange={e => setNewBusiness({ ...newBusiness, email: e.target.value })}
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

          {/* EDIT BUSINESS FORM */}
          {isSuperAdmin && selectedAction === "edit-business" && editingBusiness && (
            <form
              onSubmit={handleUpdateBusiness}
              className="edit-form compact-form super-admin-form"
            >
              <div className="edit-header">
                <h4>Edit Business (ID: {editingBusiness.id})</h4>
              </div>

              <label>
                Business Name:
                <input
                  type="text"
                  value={editingBusiness.name || ""}
                  onChange={(e) =>
                    setEditingBusiness({
                      ...editingBusiness,
                      name: e.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                Address:
                <input
                  type="text"
                  value={editingBusiness.address || ""}
                  onChange={(e) =>
                    setEditingBusiness({
                      ...editingBusiness,
                      address: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Phone:
                <input
                  type="text"
                  value={editingBusiness.phone || ""}
                  onChange={(e) =>
                    setEditingBusiness({
                      ...editingBusiness,
                      phone: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Email:
                <input
                  type="email"
                  value={editingBusiness.email || ""}
                  onChange={(e) =>
                    setEditingBusiness({
                      ...editingBusiness,
                      email: e.target.value,
                    })
                  }
                />
              </label>

              <div className="form-buttons">
                <button type="submit">Save Changes</button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingBusiness(null);
                    setSelectedAction("list-businesses");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* LICENSE MANAGEMENT - SUPER ADMIN ONLY */}
          {isSuperAdmin && selectedAction === "license-management" && (
            <div className="license-section">
              <div className="section-header">
                <h3>License Management</h3>
                <button
                  className="btn create"
                  onClick={() => setSelectedAction("generate-license")}
                >
                  + Generate New License
                </button>
              </div>

              {licenseStatus && (
                <div className="license-status-card">
                  <h4>Current License Status</h4>
                  <p><strong>Valid:</strong> {licenseStatus.valid ? "Yes" : "No"}</p>
                  {licenseStatus.expires_on && (
                    <p><strong>Expires on:</strong> {new Date(licenseStatus.expires_on).toLocaleDateString()}</p>
                  )}
                  <p>{licenseStatus.message}</p>
                </div>
              )}
            </div>
          )}

          {/* GENERATE LICENSE FORM */}
          {isSuperAdmin && selectedAction === "generate-license" && (
            <form onSubmit={handleGenerateLicense} className="edit-form compact-form super-admin-form">
              <div className="edit-header">
                <h4>Generate New License Key</h4>
              </div>

              <label>
                License Admin Password:
                <input
                  type="password"
                  value={newLicense.license_password}
                  onChange={e => setNewLicense({ ...newLicense, license_password: e.target.value })}
                  required
                />
              </label>

              <label>
                License Key:
                <input
                  type="text"
                  value={newLicense.key}
                  onChange={e => setNewLicense({ ...newLicense, key: e.target.value })}
                  required
                />
              </label>

              <label>
                Duration (days):
                <input
                  type="number"
                  value={newLicense.duration_days}
                  onChange={e => setNewLicense({ ...newLicense, duration_days: parseInt(e.target.value) || 365 })}
                  min="1"
                  required
                />
              </label>

              <label>
                Business ID:
                <input
                  type="number"
                  value={newLicense.business_id}
                  onChange={e => setNewLicense({ ...newLicense, business_id: e.target.value })}
                  required
                />
              </label>

              <div className="form-buttons">
                <button type="submit">Generate License</button>
                <button type="button" onClick={() => setSelectedAction("license-management")}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* DELETE BUSINESS CONFIRM */}
          {businessToDelete !== null && (
            <div className="delete-user-modal">
              <div className="modal-overlay" onClick={() => setBusinessToDelete(null)}>
                <div
                  className="modal-content"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button className="close-btn" onClick={() => setBusinessToDelete(null)}>✖</button>

                  <h3>Confirm Delete Business</h3>
                  <p>Are you sure you want to delete this business?</p>
                  <p>This action cannot be undone.</p>

                  <div className="modal-actions">
                    <button className="action-btn delete" onClick={handleDeleteBusiness}>
                      🗑️ Yes, Delete
                    </button>

                    <button
                      className="action-btn cancel"
                      onClick={() => setBusinessToDelete(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DELETE USER CONFIRM */}
          {userToDelete && (
            <div className="delete-user-modal">
              <div className="modal-overlay" onClick={() => setUserToDelete(null)}>
                <div
                  className="modal-content"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button className="close-btn" onClick={() => setUserToDelete(null)}>
                    ✖
                  </button>

                  <h3>Confirm Delete User</h3>
                  <p>Are you sure you want to delete <b>{userToDelete}</b>?</p>
                  <p>This action cannot be undone.</p>

                  <div className="modal-actions">
                    <button
                      className="action-btn delete"
                      onClick={handleConfirmDelete}
                    >
                      🗑️ Yes, Delete
                    </button>

                    <button
                      className="action-btn cancel"
                      onClick={() => setUserToDelete(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UserManagement;