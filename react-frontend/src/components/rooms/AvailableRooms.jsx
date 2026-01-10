// src/components/rooms/AvailableRooms.jsx
import React, { useEffect, useState } from "react";
import "./AvailableRooms.css";


import getBaseUrl from "../../api/config";
const API_BASE_URL = getBaseUrl();



const AvailableRooms = ({ onClose }) => {
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState("");
  const [totalAvailable, setTotalAvailable] = useState(0);

  useEffect(() => {
    fetchAvailableRooms();
  }, []);

  const fetchAvailableRooms = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/rooms/available`);
      const data = await res.json();
      setAvailableRooms(data.available_rooms || []);
      setTotalAvailable(data.total_available_rooms || 0);
      setInfo(`${data.message} (${data.total_available_rooms})`);
    } catch (err) {
      console.error("Error fetching available rooms:", err);
      setInfo("Failed to fetch available rooms.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="available-modal-overlay">
      <div className="available-modal-content">
        <button className="close-btn" onClick={onClose}>✖</button>
        <h3>🟢 Available Rooms</h3>
        <p style={{ textAlign: "center", marginBottom: "6px" }}>
          {info && `Available rooms fetched successfully: ${totalAvailable}`}
        </p>

        {loading ? (
          <p style={{ textAlign: "center" }}>Loading...</p>
        ) : (
          <div className="available-rooms-scroll">
            <table className="available-rooms-table">
              <thead>
                <tr>
                  <th>Room Number</th>
                  <th>Type</th>
                  <th>Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {availableRooms.map((room, index) => (
                  <tr key={index}>
                    <td>{room.room_number}</td>
                    <td>{room.room_type}</td>
                    <td>₦{room.amount}</td>
                    <td>{room.status === "maintenance" ? "🛠 Maintenance" : "✅ Available"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvailableRooms;
