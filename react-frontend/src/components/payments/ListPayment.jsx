import React, { useState } from "react";
import "./ListPayment.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || `http://${window.location.hostname}:8000`;


const ListPayment = () => {
  const [payments, setPayments] = useState([]);
  const [status, setStatus] = useState("none");
  const [debtorName, setDebtorName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [noDataMessage, setNoDataMessage] = useState(""); // ✅ new
  const [totalPayments, setTotalPayments] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [methodTotals, setMethodTotals] = useState({});
  const [viewMode, setViewMode] = useState("");
  const [summary, setSummary] = useState({});
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

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
      <p>You do not have permission to list booking payment.</p>
    </div>
  );
}




  const fetchWithToken = async (url) => {
    return fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }).then((res) => res.json());
  };

  const fetchByStatus = async () => {
    if (status === "none") return;
    setLoading(true);
    setError(null);
    setNoDataMessage("");

    try {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      let url = "";
      if (status === "All") {
        url = `${API_BASE_URL}/payments/list?${params.toString()}`;
      } else {
        params.append("status", status);
        url = `${API_BASE_URL}/payments/by-status?${params.toString()}`;
      }

      const data = await fetchWithToken(url);
      setPayments(data.payments || []);

      if (status === "All") {
        setViewMode("all");
        setSummary(data.summary || {});
        setMethodTotals(data.payment_method_totals || {});
      } else {
        setViewMode("status");
        setSummary({ total_payments: data.total_payments || 0, total_amount: data.total_amount || 0 });
        setMethodTotals({});
      }

      if (!data.payments || data.payments.length === 0) {
        setNoDataMessage("No payment records found.");
      }
    } catch {
      setError("Failed to fetch payments.");
    } finally {
      setLoading(false);
    }
  };



  const fetchDaily = async () => {
    setLoading(true);
    setViewMode("daily");
    setError(null);
    setNoDataMessage("");
    try {
      const data = await fetchWithToken(`${API_BASE_URL}/payments/total_daily_payment`);
      setPayments(data.payments || []);
      setTotalPayments(data.total_payments || 0);
      setTotalAmount(data.total_amount || 0);
      setMethodTotals(data.total_by_method || {});
      if (!data.payments || data.payments.length === 0) {
        setNoDataMessage("No daily payments found for today.");
      }
    } catch {
      setError("Failed to fetch daily payments.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDebtors = async () => {
    setLoading(true);
    setViewMode("debtor");
    setError(null);
    setNoDataMessage("");
    try {
      const params = new URLSearchParams();
      if (debtorName) params.append("debtor_name", debtorName);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      const url = `${API_BASE_URL}/payments/debtor_list?${params}`;
      const data = await fetchWithToken(url);

      setPayments(data.debtors || []);
      setTotalPayments(data.total_debtors || 0);
      setTotalAmount(data.total_current_debt || 0);
      setSummary({ total_gross_debt: data.total_gross_debt || 0 });
      setMethodTotals({});

      if (!data.debtors || data.debtors.length === 0) {
        setNoDataMessage("No debtors found for the selected filters.");
      }
    } catch {
      setError("Failed to fetch debtor list.");
    } finally {
      setLoading(false);
    }
  };

  const handleView = (paymentId) => {
    const payment = payments.find((p) => p.payment_id === paymentId);
    if (payment) {
      setSelectedPayment(payment);
      setShowPopup(true);
    }
  };

  const closePopup = () => {
    setShowPopup(false);
    setSelectedPayment(null);
  };


  return (
    <div className="list-payment-container">
      <div className="list-payment-header-row">
        <h2 className="compact-title">💳 Payment Management</h2>
      </div>

      <div className="filters-grid">
        <div className="filter-item">
          <label>Payment Status:</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="none">Select</option>
            <option value="All">All</option>
            <option value="fully paid">Fully Paid</option>
            <option value="part payment">Part Payment</option>
            <option value="voided">Voided</option>
          </select>
          <button className="fetch-button" onClick={fetchByStatus}>Fetch</button>
        </div>

        <div className="filter-item">
          <label>Debtor:</label>
          <input
            type="text"
            placeholder="Enter name..."
            value={debtorName}
            onChange={(e) => setDebtorName(e.target.value)}
          />
          <button className="fetch-button" onClick={fetchDebtors}>Fetch</button>
        </div>

        <div className="filter-item date-range-wrapper">
          <label>Date Range:</label>
          <div className="date-range-row">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="daily-button-wrapper">
          <button className="daily-button" onClick={fetchDaily}>📊 Daily Summary</button>
        </div>

        {showPopup && selectedPayment && (
            <div className="popup-overlay">
              <div className="popup-content large-popup">
                <h2 className="popup-title">Guest Payment Details</h2>
                <div className="popup-grid large-font">
                  <div><strong>Payment ID:</strong> {selectedPayment.payment_id}</div>
                  <div><strong>Booking ID:</strong> {selectedPayment.booking_id}</div>
                  <div><strong>Guest Name:</strong> {selectedPayment.guest_name}</div>
                  <div><strong>Room Number:</strong> {selectedPayment.room_number}</div>
                  <div><strong>Booking Cost:</strong> ₦{selectedPayment.booking_cost?.toLocaleString()}</div>
                  <div><strong>Amount Paid:</strong> ₦{selectedPayment.amount_paid?.toLocaleString()}</div>
                  <div><strong>Discount:</strong> ₦{selectedPayment.discount_allowed?.toLocaleString()}</div>
                  <div><strong>Balance Due:</strong> ₦{selectedPayment.balance_due?.toLocaleString()}</div>
                  <div><strong>Payment Method:</strong> {selectedPayment.payment_method}</div>
                  <div><strong>Status:</strong> {selectedPayment.status}</div>
                  <div><strong>Payment Date:</strong> {new Date(selectedPayment.payment_date).toLocaleString()}</div>
                  <div><strong>Void Date:</strong> {selectedPayment.void_date || "-"}</div>
                  <div><strong>Created By:</strong> {selectedPayment.created_by}</div>
                </div>

                <div className="popup-buttons">
                  <button className="print-btn" onClick={() => window.print()}>🖨 Print to PDF</button>
                  <button className="close-popup-btn" onClick={closePopup}>Close</button>
                </div>
              </div>
            </div>
          )}


      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {noDataMessage && <p className="no-data">{noDataMessage}</p>}

      {payments.length > 0 && (
        <div className="payment-table-wrapper">
          

          <table className="payment-table">
            <thead>
              <tr>
                {viewMode === "debtor" ? (
                  <>
                    <th>Guest</th>
                    <th>Room</th>
                    <th>BookID</th>
                    <th>Room Price</th>
                    <th>Days</th>
                    <th>Booking Cost</th>
                    <th>Paid</th>
                    <th>Discount</th>
                    <th>Amount Due</th>
                    <th>Booking Date</th>
                    <th>Last Payment</th>
                  </>
                ) : (
                  <>
                    <th>PayID</th>
                    <th>BookID</th>
                    <th>Guest</th>
                    <th>Room</th>
                    <th>Booking Cost</th>
                    <th>Amount Paid</th>
                    <th>Disc</th>
                    <th>Due</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Payment Date</th>
                    <th>Void Date</th>
                    <th>Created By</th>
                    <th>Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={i} className={p.status === "voided" ? "voided-row" : ""}>
                  {viewMode === "debtor" ? (
                    <>
                      <td>{p.guest_name}</td>
                      <td>{p.room_number}</td>
                      <td>{p.booking_id}</td>
                      <td>₦{p.room_price?.toLocaleString()}</td>
                      <td>{p.number_of_days}</td>
                      <td>₦{p.booking_cost?.toLocaleString()}</td>
                      <td>₦{p.total_paid?.toLocaleString()}</td>
                      <td>₦{p.discount_allowed?.toLocaleString()}</td>
                      <td>₦{p.amount_due?.toLocaleString()}</td>
                      <td>{new Date(p.booking_date).toLocaleString()}</td>
                      <td>{p.last_payment_date ? new Date(p.last_payment_date).toLocaleString() : "-"}</td>
                    </>
                  ) : (
                    <>
                      <td>{p.payment_id}</td>
                      <td>{p.booking_id}</td>
                      <td>{p.guest_name}</td>
                      <td>{p.room_number}</td>
                      <td>₦{p.booking_cost?.toLocaleString()}</td>
                      <td>₦{p.amount_paid?.toLocaleString()}</td>
                      <td>₦{p.discount_allowed?.toLocaleString()}</td>
                      <td>₦{p.balance_due?.toLocaleString()}</td>
                      <td>{p.payment_method}</td>
                      <td>{p.status}</td>
                      <td>{new Date(p.payment_date).toLocaleString()}</td>
                      <td>{p.void_date || "-"}</td>
                      <td>{p.created_by}</td>
                      <td><button className="view-btn" onClick={() => handleView(p.payment_id)}>View</button></td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            
            

          </table>
          
          {viewMode === "status" && (
            <div className="status-summary-wrapper">
              <h4>Summary</h4>
              <p><strong>Total Entries:</strong> {summary.total_payments || 0}</p>
              <p><strong>Total Amount Paid:</strong> ₦{(summary.total_amount || 0).toLocaleString()}</p>
            </div>
          )}


          {viewMode === "debtor" && (
            <div className="debtor-summary-wrapper">
              <div className="summary-row">
                <div className="summary-left">
                  <strong>Total Debtors:</strong><span>{totalPayments}</span>
                </div>
              </div>
              <div className="summary-row">
                <div className="summary-left">
                  <strong>Total Current Debt:</strong><span>₦{(totalAmount || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="summary-row">
                <div className="summary-left">
                  <strong>Total Gross Debt:</strong><span>₦{(summary.total_gross_debt || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          

          {viewMode === "all" && (
            <div className="all-summary-wrapper">
              <div className="summary-row">
                <div className="summary-left">
                  <strong>Total Bookings:</strong><span>{summary.total_bookings || 0}</span>
                </div>
                <div className="summary-right">
                  <strong>Cash:</strong><span>₦{(methodTotals.cash || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="summary-row">
                <div className="summary-left">
                  <strong>Total Booking Cost:</strong><span>₦{(summary.total_booking_cost || 0).toLocaleString()}</span>
                </div>
                <div className="summary-right">
                  <strong>POS:</strong><span>₦{(methodTotals.pos_card || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="summary-row">
                <div className="summary-left">
                  <strong>Total Paid:</strong><span>₦{(summary.total_amount_paid || 0).toLocaleString()}</span>
                </div>
                <div className="summary-right">
                  <strong>Bank Transfer:</strong><span>₦{(methodTotals.bank_transfer || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="summary-row">
                <div className="summary-left">
                  <strong>Total Discount:</strong><span>₦{(summary.total_discount_allowed || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="summary-row">
                <div className="summary-left">
                  <strong>Total Due:</strong><span>₦{(summary.total_due || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}


          {viewMode === "daily" && (
            <div className="payment-method-summary">
              <h4>Breakdown by Payment Method</h4>
              <ul>
                <li><strong>Cash:</strong> ₦{(methodTotals?.cash || 0).toLocaleString()}</li>
                <li><strong>POS:</strong> ₦{(methodTotals?.pos_card || 0).toLocaleString()}</li>
                <li><strong>Bank Transfer:</strong> ₦{(methodTotals?.bank_transfer || 0).toLocaleString()}</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ListPayment;
