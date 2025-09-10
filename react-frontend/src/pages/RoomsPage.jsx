// src/pages/RoomsPage.jsx

import React, { useState, useEffect } from "react";
import axiosWithAuth from "../utils/axiosWithAuth";
import "./RoomsPage.css";

import UpdateRoomForm from "../components/rooms/UpdateRoomForm";
import AddRoomForm from "../components/rooms/AddRoomForm";
import RoomFaultsView from "../components/rooms/RoomFaultsView";
import AvailableRooms from "../components/rooms/AvailableRooms";
import DeleteRoomModal from "../components/rooms/DeleteRoomModal";

const RoomsPage = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [modalView, setModalView] = useState(null);
  const [showAvailableModal, setShowAvailableModal] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const axios = axiosWithAuth();
      const response = await axios.get("/rooms/");

      // normalize response in case backend wraps in { rooms: [] }
      const sortedRooms = (Array.isArray(response.data) ? response.data : response.data.rooms || [])
        .sort((a, b) =>
          a.room_number.localeCompare(b.room_number, undefined, { numeric: true })
        );

      setRooms(sortedRooms);
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
      setError("Failed to load rooms.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (room) => {
    setSelectedRoom(room);
    setModalView("edit");
  };

  const handleDelete = (room) => {
    setSelectedRoom(room);
    setModalView("delete");
  };

  const handleViewFaults = (room) => {
    setSelectedRoom(room);
    setModalView("faults");
  };

  const handleCloseModal = () => {
    setSelectedRoom(null);
    setModalView(null);
  };

  return (
    <div className="rooms-container">
      <div className="rooms-header">
        <h2>🏨 Room Management</h2>
        <div className="room-header-buttons">
          <button
            className="available-room-btn"
            onClick={() => setShowAvailableModal(true)}
          >
            Available Rooms
          </button>
          <button
            className="add-room-btn"
            onClick={() => setModalView("add")}
          >
            + Add Room
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading rooms...</p>
      ) : error ? (
        <p style={{ color: "red" }}>{error}</p>
      ) : (
        <table className="rooms-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Room Number</th>
              <th>Type</th>
              <th>Status</th>
              <th>Rate</th>
              <th>Maintenance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rooms.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: "center" }}>
                  No rooms found.
                </td>
              </tr>
            ) : (
              rooms.map((room) => (
                <tr key={room.id}>
                  <td>{room.id}</td>
                  <td>{room.room_number}</td>
                  <td>{room.room_type}</td>
                  <td>{room.status || "—"}</td>
                  <td>₦{room.amount}</td>
                  <td>{room.status === "maintenance" ? "🛠 Yes" : "✅ No"}</td>
                  <td>
                    <button
                      className="action-btn"
                      onClick={() => handleEdit(room)}
                    >
                      Update
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => handleDelete(room)}
                    >
                      Delete
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => handleViewFaults(room)}
                    >
                      View Faults
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {modalView && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={handleCloseModal}>
              ✖
            </button>

            {modalView === "edit" && selectedRoom && (
              <UpdateRoomForm
                room={selectedRoom}
                onClose={handleCloseModal}
                onRoomUpdated={fetchRooms}
              />
            )}

            {modalView === "faults" && selectedRoom && (
              <RoomFaultsView
                room={selectedRoom}
                onClose={handleCloseModal}
                onRefresh={fetchRooms}
              />
            )}

            {modalView === "add" && (
              <AddRoomForm onClose={handleCloseModal} onRoomAdded={fetchRooms} />
            )}

            {modalView === "delete" && selectedRoom && (
              <DeleteRoomModal
                room={selectedRoom}
                onClose={handleCloseModal}
                onRoomDeleted={fetchRooms}
              />
            )}
          </div>
        </div>
      )}

      {showAvailableModal && (
        <AvailableRooms onClose={() => setShowAvailableModal(false)} />
      )}
    </div>
  );
};

export default RoomsPage;
