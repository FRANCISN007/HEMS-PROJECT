import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./RestaurantPayment.css";

const RestaurantPayment = () => {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [sales, setSales] = useState([]);
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
      .then((res) => {
        console.log("Fetched locations:", res.data);
        setLocations(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => console.error("Failed to fetch locations:", err));
  }, []);

  // ✅ Fetch unpaid/partial sales for selected location
    const fetchSales = async (locationId) => {
    try {
        const res = await axiosWithAuth().get(
        `/restaurant/sales/outstanding?location_id=${locationId}`
        );
        console.log("Fetched sales:", res.data);
        setSales(Array.isArray(res.data.sales) ? res.data.sales : []);
    } catch (err) {
        console.error("Failed to fetch sales:", err);
    }
    };

  // ✅ Location change handler
  const handleLocationChange = (e) => {
    const locationId = e.target.value;
    setSelectedLocation(locationId);
    if (locationId) {
      fetchSales(locationId);
    } else {
      setSales([]);
    }
  };

  // ✅ Open modal
  const openPaymentModal = (sale) => {
    setCurrentSale(sale);
    setPaymentData({ amount: "", payment_mode: "cash", paid_by: "" });
    setShowPaymentModal(true);
  };

  // ✅ Close modal
  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setCurrentSale(null);
  };

  const handlePaymentSubmit = async () => {
    try {
        await axiosWithAuth().post(
        `/restpayment/sales/${currentSale.id}/payments`,
        null, // no body
        {
            params: {
            amount: parseFloat(paymentData.amount) || 0,
            payment_mode: paymentData.payment_mode,
            paid_by: paymentData.paid_by,
            },
        }
        );

        // ✅ Show temporary success feedback
        alert("✅ Payment recorded successfully!");

        // ✅ Delay for 3 seconds before closing + refreshing
        setTimeout(() => {
        closePaymentModal();
        fetchSales(selectedLocation);
        }, 500);
    } catch (err) {
        console.error("Payment failed:", err.response?.data || err);
        alert("❌ Payment failed. Please try again.");
    }
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

      {/* ✅ Show unpaid/partial sales */}
      {sales.length > 0 && (
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
            {sales.map((sale) => {
              const totalPaid = sale.amount_paid || 0;
              const balance = sale.balance || 0;

              return (
                <tr key={sale.id}>
                  <td>{sale.id}</td>
                  <td>{sale.guest_name}</td>
                  <td>{sale.total_amount}</td>
                  <td>{totalPaid}</td>
                  <td>{balance}</td>
                  <td>
                    <button onClick={() => openPaymentModal(sale)}>
                      💳 Make Payment
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ✅ Payment Modal */}
      {showPaymentModal && (
        <div className="payment-modal-overlay">
          <div className="payment-modal">
            <h3>Make Payment for Sale #{currentSale.id}</h3>

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
              value={paymentData.paid_by || currentSale.guest_name || ""}
              onChange={(e) =>
                setPaymentData({ ...paymentData, paid_by: e.target.value })
              }
              placeholder="Enter payer name"
            />

            <div className="modal-actions">
              <button
                onClick={() => handlePaymentSubmit(currentSale.id)}
                className="btn btn-primary"
              >
                Submit
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="btn btn-secondary"
              >
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
