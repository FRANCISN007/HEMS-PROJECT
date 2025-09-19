// src/components/payments/PaymentOutstandingList.jsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PaymentOutstandingList.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || `http://${window.location.hostname}:8000`;

const PaymentOutstandingList = () => {
  const [outstandingData, setOutstandingData] = useState([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];

  if (Array.isArray(storedUser.roles)) {
    roles = storedUser.roles;
  } else if (typeof storedUser.role === "string") {
    roles = [storedUser.role];
  }

  roles = roles.map((r) => r.toLowerCase());


  if (!(roles.includes("admin") || roles.includes("dashboard"))) {
  return (
    <div className="unauthorized">
      <h2>🚫 Access Denied</h2>
      <p>You do not have permission to ctreate booking payment.</p>
    </div>
  );
}

  useEffect(() => {
    const fetchOutstanding = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/payments/outstanding`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        const data = await res.json();

        setOutstandingData(data.outstanding_bookings || []);
        setTotalOutstanding(data.total_outstanding || 0);
        setTotalBalance(data.total_outstanding_balance || 0);
      } catch (error) {
        console.error("Failed to fetch outstanding payments", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOutstanding();
  }, []);

  const handleMakePayment = (booking) => {
    navigate(`/dashboard/payments/create/${booking.booking_id}`, {
      state: { booking }, // 👈 this fixes the issue
    });
  };

  return (
    <div className="outstanding-wrapper">
      <h2 className="no-margin">💰 Bookings Schedule for Payments</h2>

      <div className="summary-box">
        <span>Total Outstanding: <strong> {totalOutstanding} </strong> </span>
        <span>Total Outstanding Balance:<strong> ₦{totalBalance.toLocaleString()} </strong> </span>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : outstandingData.length === 0 ? (
        <p>No outstanding payments found.</p>
      ) : (
        <table className="outstanding-table">
          <thead>
            <tr>
              <th>ID</th>  
              <th>Guest Name</th>
              <th>Room No</th>
              <th>Booking Date</th>
              <th>Total Due (₦)</th>
              <th>Total Paid (₦)</th>
              <th>Discount (₦)</th>
              <th>Amount Due (₦)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {outstandingData.map((booking) => (
              <tr key={booking.booking_id}>
                <td>{booking.booking_id}</td>
                <td>{booking.guest_name}</td>
                <td>{booking.room_number}</td>
                <td>{new Date(booking.booking_date).toLocaleDateString()}</td>
                <td>{booking.total_due.toLocaleString()}</td>
                <td>{booking.total_paid.toLocaleString()}</td>
                <td>{booking.discount_allowed.toLocaleString()}</td>
                <td><strong>₦{booking.amount_due.toLocaleString()}</strong></td>
                <td>
                  <button
                    className="pay-button"
                    onClick={() => handleMakePayment(booking)}
                  >
                    Make Payment
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PaymentOutstandingList;
