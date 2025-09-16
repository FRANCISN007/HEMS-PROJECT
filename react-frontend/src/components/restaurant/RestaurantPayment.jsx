import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./RestaurantPayment.css";

const RestaurantPayment = () => {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null); // ✅ summary totals from backend
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentSale, setCurrentSale] = useState(null);
  const [paymentData, setPaymentData] = useState({
    amount: "",
    payment_mode: "cash",
    paid_by: "",
  });

  // ✅ Fetch locations
  useEffect(() => {
    axiosWithAuth()
      .get("/restaurant/locations")
      .then((res) => setLocations(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("Failed to fetch locations:", err));
  }, []);

  // ✅ Fetch sales from backend (use backend-provided balance/amount_paid)
  const fetchSales = async (locationId) => {
    if (!locationId) {
      setSales([]);
      setSummary(null);
      return;
    }
    try {
      const res = await axiosWithAuth().get(
        `/restaurant/sales/outstanding?location_id=${locationId}`
      );

      setSales(res.data.sales || []);
      setSummary(res.data.summary || null);
    } catch (err) {
      console.error("Failed to fetch sales:", err);
    }
  };

  // ✅ Open modal
  const openPaymentModal = (sale) => {
    setCurrentSale(sale);
    setPaymentData({
      amount: "",
      payment_mode: "cash",
      paid_by: sale.guest_name || "",
    });
    setShowPaymentModal(true);
  };

  // ✅ Close modal
  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setCurrentSale(null);
    setPaymentData({ amount: "", payment_mode: "cash", paid_by: "" });
  };

  // ✅ Submit payment
  const handlePaymentSubmit = async () => {
    try {
      await axiosWithAuth().post(
        `/restpayment/sales/${currentSale.id}/payments`,
        {
          amount: parseFloat(paymentData.amount) || 0,
          payment_mode: paymentData.payment_mode,
          paid_by: paymentData.paid_by,
        }
      );

      alert("✅ Payment recorded successfully!");

      setTimeout(() => {
        closePaymentModal();
        fetchSales(selectedLocation); // ✅ refresh list with new balance
      }, 500);
    } catch (err) {
      console.error("Payment failed:", err.response?.data || err);
      alert(
        `❌ Payment failed. ${
          err.response?.data?.detail || "Please try again."
        }`
      );
    }
  };

  // ✅ Handle location change
  const handleLocationChange = (e) => {
    const locationId = e.target.value;
    setSelectedLocation(locationId);
    fetchSales(locationId);
  };

  return (
    <div className="restaurant-payment">
      <h2>Restaurant Payments</h2>

      {/* ✅ Select location */}
      <div className="location-select">
        <label>Select Location:</label>
        <select value={selectedLocation} onChange={handleLocationChange}>
          <option value="">-- Choose Location --</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      {/* ✅ Show summary */}
      {summary && (
        <div className="summary">
          <p>
            <strong>Total Sales:</strong> ₦
            {Number(summary.total_sales_amount).toLocaleString()}
          </p>
          <p>
            <strong>Total Paid:</strong> ₦
            {Number(summary.total_paid_amount).toLocaleString()}
          </p>
          <p>
            <strong>Total Balance:</strong> ₦
            {Number(summary.total_balance).toLocaleString()}
          </p>
        </div>
      )}

      {/* ✅ Outstanding sales */}
      {sales.length > 0 ? (
        <table className="sales-table">
          <thead>
            <tr>
              <th>Sale ID</th>
              <th>Guest Name</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>{sale.id}</td>
                <td>{sale.guest_name}</td>
                <td>₦{Number(sale.total_amount).toLocaleString()}</td>
                <td>₦{Number(sale.amount_paid).toLocaleString()}</td>
                <td>₦{Number(sale.balance).toLocaleString()}</td>
                <td>
                  <button onClick={() => openPaymentModal(sale)}>
                    💳 Make Payment
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        selectedLocation && <p>No outstanding sales for this location.</p>
      )}

      {/* ✅ Payment Modal */}
      {showPaymentModal && currentSale && (
        <div className="payment-modal-overlay">
          <div className="payment-modal">
            <h3>Make Payment for Sale #{currentSale.id}</h3>

            <div className="sale-summary">
              <p>
                <strong>Total:</strong> ₦
                {Number(currentSale.total_amount).toLocaleString()}
              </p>
              <p>
                <strong>Already Paid:</strong> ₦
                {Number(currentSale.amount_paid).toLocaleString()}
              </p>
              <p>
                <strong>Balance:</strong> ₦
                {Number(currentSale.balance).toLocaleString()}
              </p>
            </div>

            <label>Amount:</label>
            <input
              type="number"
              value={paymentData.amount}
              onChange={(e) =>
                setPaymentData({ ...paymentData, amount: e.target.value })
              }
            />

            <label>Payment Mode:</label>
            <select
              value={paymentData.payment_mode}
              onChange={(e) =>
                setPaymentData({ ...paymentData, payment_mode: e.target.value })
              }
            >
              <option value="cash">Cash</option>
              <option value="transfer">Transfer</option>
              <option value="pos">POS</option>
            </select>

            <label>Paid By:</label>
            <input
              type="text"
              value={paymentData.paid_by}
              onChange={(e) =>
                setPaymentData({ ...paymentData, paid_by: e.target.value })
              }
            />

            <div className="modal-actions">
              <button
                onClick={handlePaymentSubmit}
                className="btn btn-primary"
                disabled={!paymentData.amount || parseFloat(paymentData.amount) <= 0}
              >
                Submit
              </button>
              <button onClick={closePaymentModal} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantPayment;
