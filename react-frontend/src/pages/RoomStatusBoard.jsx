import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import getBaseUrl from "./../api/config";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  CartesianGrid,
} from "recharts";

import "./RoomStatusBoard.css";

const API_BASE_URL = getBaseUrl();

const RoomStatusBoard = () => {
  const [rooms, setRooms] = useState([]);
  const navigate = useNavigate();

  const formatNaira = (amount) =>
    amount?.toLocaleString("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    });

  useEffect(() => {
    const fetchRooms = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const res = await axios.get(`${API_BASE_URL}/rooms/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = res.data;
        console.log("Fetched rooms response:", data);

        // ✅ Support both array and wrapped response
        if (Array.isArray(data)) {
          setRooms(data);
        } else if (Array.isArray(data?.rooms)) {
          setRooms(data.rooms);
        } else {
          console.warn("Unexpected rooms response shape:", data);
          setRooms([]);
        }
      } catch (err) {
        console.error("Error fetching rooms:", err);
        setRooms([]);
      }
    };

    fetchRooms();
  }, []);

  const handleRoomClick = (room) => {
    const blocked = ["maintenance", "checked-in", "reserved", "complimentary"];
    if (blocked.includes(room.status?.toLowerCase())) return;

    navigate(`/dashboard/bookings/create?room_number=${room.room_number}`);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "available":
        return "#cabebef8";
      case "reserved":
        return "#FFD700";
      case "checked-in":
        return "#4CAF50";
      case "checked-out":
        return "#90A4AE";
      case "maintenance":
        return "#e60606";
      case "complimentary":
        return "#6A5ACD";
      default:
        return "#BDBDBD";
    }
  };

  const statusCounts = Array.isArray(rooms)
    ? rooms.reduce((acc, room) => {
        const status = room.status?.toLowerCase?.() || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {})
    : {};

  const futureReservationCount = Array.isArray(rooms)
    ? rooms.reduce(
        (total, room) => total + (room.future_reservation_count || 0),
        0
      )
    : 0;

  const chartData = [
    { name: "Available", value: statusCounts["available"] || 0, color: "#cabebef8" },
    { name: "Checked-in", value: statusCounts["checked-in"] || 0, color: "#4CAF50" },
    { name: "Reserved", value: futureReservationCount, color: "#FFD700" },
    { name: "Maintenance", value: statusCounts["maintenance"] || 0, color: "#e60606" },
    { name: "Complimentary", value: statusCounts["complimentary"] || 0, color: "#6A5ACD" },
  ];

  return (
    <div style={{ maxHeight: "100vh", overflow: "hidden" }}>
      {/* 🏨 Rooms */}
      <div className="section-box" style={{ maxHeight: "35vh", overflowY: "auto" }}>
        <div className="room-grid">
          {rooms.map((room) => {
            const isClickable = ![
              "maintenance",
              "checked-in",
              "reserved",
              "complimentary",
            ].includes(room.status?.toLowerCase());

            return (
              <div
                key={room.id}
                className={`room-card ${isClickable ? "clickable" : "disabled"}`}
                style={{
                  backgroundColor: getStatusColor(room.status),
                  fontSize: "0.7rem",
                  padding: "4px",
                  position: "relative",
                }}
                onClick={() => handleRoomClick(room)}
              >
                {room.future_reservation_count > 0 && (
                  <div
                    className="reservation-badge"
                    title={`${room.future_reservation_count} reservation(s)`}
                  >
                    {room.future_reservation_count}
                  </div>
                )}
                <h3 style={{ margin: "2px 0" }}>{room.room_number}</h3>
                <p style={{ margin: "1px 0" }}>{room.room_type}</p>
                <p style={{ margin: "1px 0" }}>
                  {formatNaira(room.amount)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 📊 Summary */}
      <div className="room-summary-footer" style={{ fontSize: "0.8rem", padding: "6px" }}>
        <span>🔘 Available: {statusCounts["available"] || 0}</span>
        <span>🟢 Checked-in🧍‍♂️: {statusCounts["checked-in"] || 0}</span>
        <span>🟡 Reserved🕒: {rooms.filter((r) => r.future_reservation_count > 0).length}</span>
        <span>🔵 Complimentary: {statusCounts["complimentary"] || 0}</span>
        <span>🔴 Maintenance🛠️: {statusCounts["maintenance"] || 0}</span>
      </div>

      <hr className="room-divider" style={{ margin: "8px 0" }} />

      {/* 📈 Chart */}
      <div className="section-box chart-container" style={{ height: "31vh" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="value">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RoomStatusBoard;
