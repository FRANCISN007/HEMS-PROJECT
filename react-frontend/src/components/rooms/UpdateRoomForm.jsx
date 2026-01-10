import React, { useState } from "react";
import './UpdateRoomForm.css';

import getBaseUrl from "../../api/config";
const API_BASE_URL = getBaseUrl();


const UpdateRoomForm = ({ room, onClose, onRoomUpdated }) => {
  const [formData, setFormData] = useState({
    room_number: room.room_number,
    room_type: room.room_type,
    amount: room.amount,
    status: room.status,
    faults: room.faults || [],
  });

  const [showFaultInput, setShowFaultInput] = useState(room.status === "maintenance");
  const [newFault, setNewFault] = useState("");
  const token = localStorage.getItem("token");

  

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "status" && value === "maintenance") {
        setShowFaultInput(true);
      } else if (name === "status") {
        setShowFaultInput(false);
        updated.faults = [];
      }
      return updated;
    });
  };

  const handleAddFault = () => {
    if (newFault.trim()) {
      setFormData((prev) => ({
        ...prev,
        faults: [...prev.faults, { description: newFault.trim(), resolved: false }],
      }));
      setNewFault("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const updatedRoom = {
      ...formData,
      faults: formData.faults?.map((fault) => ({
        ...fault,
        room_number: formData.room_number,
      })) || [],
    };

    try {
      const res = await fetch(`${API_BASE_URL}/rooms/${room.room_number}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedRoom),
      });

      if (res.ok) {
        onRoomUpdated();
        onClose();
      } else {
        const errorText = await res.text();
        alert("Failed to update room: " + errorText);
      }
    } catch (err) {
      console.error(err);
      alert("Error updating room.");
    }
  };

  return (
    <div className="update-room-modal2">
      <div className="modal-overlay2" onClick={onClose}>
        <div className="modal-content2" onClick={(e) => e.stopPropagation()}>
          <button className="close-btn2" onClick={onClose}>×</button>

          <form className="update-room-form2" onSubmit={handleSubmit}>
            <h3>Update Room - {room.room_number}</h3>

            <label>Room Number:</label>
            <input name="room_number" value={formData.room_number} disabled />

            <label>Type:</label>
            <input name="room_type" value={formData.room_type} onChange={handleChange} required />

            <label>Amount (₦):</label>
            <input
              name="amount"
              type="number"
              value={formData.amount}
              onChange={handleChange}
              required
            />

            <label>Status:</label>
            <select name="status" value={formData.status} onChange={handleChange} required>
              <option value="available">Available</option>
              <option value="maintenance">Maintenance</option>
            </select>

            {showFaultInput && (
              <div className="fault-section">
                <h4>Add Room Faults</h4>
                <div style={{ display: "flex", gap: "0.5em" }}>
                  <input
                    type="text"
                    placeholder="Enter fault description"
                    value={newFault}
                    onChange={(e) => setNewFault(e.target.value)}
                  />
                  <button type="button" onClick={handleAddFault}>Add Fault</button>
                </div>
              </div>
            )}

            <div className="button-wrapper">
              <button type="submit" className="action-btn">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UpdateRoomForm;
