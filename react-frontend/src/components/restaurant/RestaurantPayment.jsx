import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./RestaurantPayment.css";

const RestaurantPayment = () => {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentSale, setCurrentSale] = useState(null);
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(true);

  // User roles
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = Array.isArray(storedUser.roles)
    ? storedUser.roles
    : typeof storedUser.role === "string"
    ? [storedUser.role]
    : [];
  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("restaurant"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to create restaurant payment.</p>
      </div>
    );
  }

  const [paymentData, setPaymentData] = useState({
    amount: "",
    payment_mode: "cash",
    paid_by: "",
    bank: "",
  });

  // Fetch locations
  useEffect(() => {
    
    axiosWithAuth()
      .get("/restaurant/locations")
      .then((res) => setLocations(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("Failed to fetch locations:", err));
  }, []);

  // Fetch banks
  useEffect(() => {
    setBanksLoading(true);
    axiosWithAuth()
      .get("/bank/simple")
      .then((res) => setBanks(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error("Failed to fetch banks:", err);
        setBanks([]);
      })
      .finally(() => setBanksLoading(false));
  }, []);

  // Fetch sales
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

  const handleLocationChange = (e) => {
    const locationId = e.target.value;
    setSelectedLocation(locationId);
    fetchSales(locationId);
  };

  const openPaymentModal = (sale) => {
    setCurrentSale(sale);
    setPaymentData({
      amount: "",
      payment_mode: "cash",
      paid_by: sale.guest_name || "",
      bank: "",
    });
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setCurrentSale(null);
    setPaymentData({ amount: "", payment_mode: "cash", paid_by: "", bank: "" });
  };

  const handlePaymentSubmit = async () => {
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      alert("⚠️ Enter a valid amount");
      return;
    }
    if (
      (paymentData.payment_mode === "pos" || paymentData.payment_mode === "transfer") &&
      !paymentData.bank
    ) {
      alert("⚠️ Select a bank for POS/Transfer payments");
      return;
    }

    try {
      await axiosWithAuth().post(
        `/restpayment/sales/${currentSale.id}/payments`,
        {
          amount: parseFloat(paymentData.amount),
          payment_mode: paymentData.payment_mode,
          paid_by: paymentData.paid_by,
          bank: paymentData.payment_mode === "cash" ? null : paymentData.bank,
        }
      );
      alert("✅ Payment recorded successfully!");
      fetchSales(selectedLocation);
      closePaymentModal();
    } catch (err) {
      console.error("Payment failed:", err.response?.data || err);
      alert(`❌ Payment failed. ${err.response?.data?.detail || "Please try again."}`);
    }
  };

  return (
    <div className="restaurant-payment">
      <h2>🍽️ Create Restaurant Payments</h2>

      {/* Location Selector */}
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

      {/* Summary */}
      {summary && (
        <div className="summary">
          <div className="summary-card">
            <h4>Total Sales</h4>
            <p>₦{Number(summary.total_sales_amount || 0).toLocaleString()}</p>
          </div>
          <div className="summary-card">
            <h4>Total Paid</h4>
            <p>₦{Number(summary.total_paid_amount || 0).toLocaleString()}</p>
          </div>
          <div className="summary-card">
            <h4>Total Balance</h4>
            <p>₦{Number(summary.total_balance || 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Sales Table */}
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
                  <button className="btn-pay" onClick={() => openPaymentModal(sale)}>
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

      {/* Payment Modal */}
      {showPaymentModal && currentSale && (
        <div className="payment-modal-overlay">
          <div className="payment-modal">
            <h3>💰 Make Payment for Sale #{currentSale.id}</h3>
            <div className="payment-modal-content">
              <div className="sale-summary">
                <p>
                  <strong>Total:</strong> ₦{Number(currentSale.total_amount).toLocaleString()}
                </p>
                <p>
                  <strong>Already Paid:</strong> ₦{Number(currentSale.amount_paid).toLocaleString()}
                </p>
                <p>
                  <strong>Balance:</strong> ₦{Number(currentSale.balance).toLocaleString()}
                </p>
              </div>

              <label>Amount:</label>
              <input
                type="number"
                placeholder="Enter amount"
                value={paymentData.amount}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, amount: e.target.value })
                }
              />

              <label>Payment Mode:</label>
              <select
                value={paymentData.payment_mode}
                onChange={(e) =>
                  setPaymentData({
                    ...paymentData,
                    payment_mode: e.target.value,
                    bank: e.target.value === "cash" ? "" : paymentData.bank,
                  })
                }
              >
                <option value="">-- Select Mode --</option>
                <option value="CASH">Cash</option>
                <option value="TRANSFER">Transfer</option>
                <option value="POS">POS</option>
              </select>

              {/* Bank Dropdown */}
              {(paymentData.payment_mode === "TRANSFER" || paymentData.payment_mode === "POS") && (
                <>
                  <label>Bank:</label>
                  {banksLoading ? (
                    <p>Loading banks...</p>
                  ) : (
                    <select
                      value={paymentData.bank}
                      onChange={(e) =>
                        setPaymentData({ ...paymentData, bank: e.target.value })
                      }
                    >
                      <option value="">-- Select Bank --</option>
                      {banks.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}

              <label>Paid By:</label>
              <input
                type="text"
                placeholder="Enter name"
                value={paymentData.paid_by}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, paid_by: e.target.value })
                }
              />

              {/* Payment History */}
              {currentSale.payments?.length > 0 && (
                <div className="payment-history">
                  <h4>📜 Payment History</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Amount</th>
                        <th>Mode</th>
                        <th>Bank</th>
                        <th>Paid By</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSale.payments.map((p) => (
                        <tr key={p.id} style={{ color: p.is_void ? "red" : "" }}>
                          <td>{p.id}</td>
                          <td>₦{Number(p.amount_paid).toLocaleString()}</td>
                          <td>{p.payment_mode}</td>
                          <td>{p.bank || "N/A"}</td>
                          <td>{p.paid_by || "N/A"}</td>
                          <td>{new Date(p.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={handlePaymentSubmit}
                disabled={
                  !paymentData.amount ||
                  parseFloat(paymentData.amount) <= 0 ||
                  ((paymentData.payment_mode === "pos" ||
                    paymentData.payment_mode === "transfer") &&
                    !paymentData.bank)
                }
              >
                ✅ Submit
              </button>
              <button className="btn btn-secondary" onClick={closePaymentModal}>
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantPayment;
