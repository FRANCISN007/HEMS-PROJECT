import React from "react";
import "./DeleteRoomModal.css";

import getBaseUrl from "../../api/config";
const API_BASE_URL = getBaseUrl();


const DeleteRoomModal = ({ room, onClose, onRoomDeleted }) => {
  const handleConfirmDelete = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/rooms/${room.room_number}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        alert("Room deleted.");
        onRoomDeleted();
        onClose();
      } else {
        alert(`Failed to delete room: ${data.detail}`);
      }
    } catch (err) {
      console.error("Error deleting room:", err);
      alert("Server error.");
    }
  };

  return (
    <div className="delete-room-modal">
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-btn" onClick={onClose}>✖</button>
          <h3>Confirm Delete</h3>
          <p>Are you sure you want to delete room <strong>{room.room_number}</strong>?</p>
          <div className="modal-actions">
            <button className="action-btn delete" onClick={handleConfirmDelete}>Yes, Delete</button>
            <button className="action-btn cancel" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteRoomModal;
