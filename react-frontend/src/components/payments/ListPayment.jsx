import React, { useState, useEffect } from "react";
import "./ListPayment.css";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  `http://${window.location.hostname}:8000`;

const ListPayment = () => {
  const [payments, setPayments] = useState([]);
  const [banks, setBanks] = useState([]);
  const [status, setStatus] = useState("none");
  const [debtorName, setDebtorName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [noDataMessage, setNoDataMessage] = useState("");
  const [totalPayments, setTotalPayments] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [methodTotals, setMethodTotals] = useState({});
  const [viewMode, setViewMode] = useState("");
  const [summary, setSummary] = useState({});
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [bankFilter, setBankFilter] = useState("");

  


  // ---------------- ROLE VALIDATION ---------------- //
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = Array.isArray(storedUser.roles)
    ? storedUser.roles
    : typeof storedUser.role === "string"
    ? [storedUser.role]
    : [];
  roles = roles.map((r) => r.toLowerCase());
  if (!(roles.includes("admin") || roles.includes("dashboard"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to list booking payment.</p>
      </div>
    );
  }

  // ✅ Get business name dynamically
  const businessName = storedUser.business?.name || "HEMS Hotel";

  // ---------------- UTIL ---------------- //
  const fetchWithToken = async (url) => {
    return fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }).then((res) => res.json());
  };

  // ---------------- FETCH BANK LIST ---------------- //
  useEffect(() => {
    const loadBanks = async () => {
      try {
        const data = await fetchWithToken(`${API_BASE_URL}/bank/simple`);
        setBanks(Array.isArray(data) ? data : data.banks || []);
      } catch {
        console.log("Failed to load bank list.");
      }
    };
    loadBanks();
  }, []);

  // AUTO TRIGGER WHEN BANK FILTER CHANGES
  useEffect(() => {
    if (bankFilter) {
      fetchByStatus();
    }
  }, [bankFilter]);

  
  // Helper to normalize bank field
const normalizePayment = (p) => ({
  ...p,
  bank_name:
    p.bank_name ||
    p.bank?.name ||
    p.bank ||
    "-"
});

// ---------------- FETCH PAYMENTS ---------------- //
const fetchByStatus = async () => {
  if (status === "none" && !bankFilter) return;

  setLoading(true);
  setError(null);
  setNoDataMessage("");

  try {
    const params = new URLSearchParams();

    if (startDate) {
      params.append("start_date", startDate);
    }

    if (endDate) {
      params.append("end_date", endDate);
    }

    // 🔥 IMPORTANT FIX
    // Backend expects bank_name query param
    if (bankFilter) {
      params.append("bank_name", bankFilter);
    }

    let url = "";

    // ------------------------------------------------
    // 1️⃣ BANK FILTER ONLY
    // ------------------------------------------------
    if (bankFilter && status === "none") {
      url = `${API_BASE_URL}/payments/by-bank?${params.toString()}`;
    }

    // ------------------------------------------------
    // 2️⃣ ALL PAYMENTS
    // ------------------------------------------------
    else if (status === "All") {
      url = `${API_BASE_URL}/payments/list?${params.toString()}`;
    }

    // ------------------------------------------------
    // 3️⃣ FILTER BY STATUS
    // ------------------------------------------------
    else {
      params.append("status", status);

      url = `${API_BASE_URL}/payments/by-status?${params.toString()}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch payments");
    }

    const data = await response.json();

    // ------------------------------------------------
    // 🔥 NORMALIZE PAYMENTS
    // ------------------------------------------------
    let paymentData = Array.isArray(data.payments)
      ? data.payments.map((p) => ({
          ...p,
          bank_name:
            p.bank_name ||
            p.bank?.name ||
            p.bank ||
            "-",
        }))
      : [];

    // ------------------------------------------------
    // 🔥 FRONTEND EXTRA FILTER
    // (prevents mismatch issue)
    // ------------------------------------------------
    if (bankFilter) {
      paymentData = paymentData.filter(
        (p) =>
          (p.bank_name || "")
            .toLowerCase()
            .trim() === bankFilter.toLowerCase().trim()
      );
    }

    // ------------------------------------------------
    // 🔥 REMOVE VOIDED EXCEPT VOIDED VIEW
    // ------------------------------------------------
    if (status !== "voided") {
      paymentData = paymentData.filter(
        (p) => p.status !== "voided"
      );
    }

    setPayments(paymentData);

    // ------------------------------------------------
    // 🔥 BANK SUMMARY
    // ------------------------------------------------
    if (url.includes("/payments/by-bank")) {
      setViewMode("bank");

      setSummary({
        total_pos: data.summary?.total_pos || 0,
        total_bank_transfer:
          data.summary?.total_bank_transfer || 0,
      });

      if (!paymentData.length) {
        setNoDataMessage(
          "No payment records found for selected bank."
        );
      }

      return;
    }

    // ------------------------------------------------
    // 🔥 ALL PAYMENTS SUMMARY
    // ------------------------------------------------
    if (status === "All") {
      setViewMode("all");

      setSummary(data.summary || {});

      setMethodTotals(
        data.payment_method_totals || {}
      );

      if (!paymentData.length) {
        setNoDataMessage("No payment records found.");
      }

      return;
    }

    // ------------------------------------------------
    // 🔥 STATUS SUMMARY
    // ------------------------------------------------
    setViewMode("status");

    setSummary({
      total_payments:
        data.total_payments || paymentData.length || 0,

      total_amount:
        data.total_amount ||
        paymentData.reduce(
          (sum, p) => sum + (p.amount_paid || 0),
          0
        ),
    });

    if (!paymentData.length) {
      setNoDataMessage("No payment records found.");
    }

  } catch (error) {
    console.log(error);
    setError("Failed to fetch payments.");
  } finally {
    setLoading(false);
  }
};



  // ---------------- DAILY PAYMENT SUMMARY ---------------- //
  const fetchDaily = async () => {
    setLoading(true);
    setViewMode("daily");
    setError(null);
    setNoDataMessage("");

    try {
      const data = await fetchWithToken(
        `${API_BASE_URL}/payments/total_daily_payment`
      );

      // Normalize payments
      setPayments(
        (data.payments || []).map((p) => ({
          ...p,
          bank_name: p.bank_name || p.bank || p.bank_name?.name || "-",
        }))
      );

      setTotalPayments(data.total_payments || 0);
      setTotalAmount(data.total_amount || 0);

      // Combine global totals with bank-level totals
      const totals = data.total_by_method || {};
      const bankTotals = {};

      Object.entries(totals).forEach(([key, value]) => {
        if (value && typeof value === "object") {
          // Only objects are treated as bank-level totals
          bankTotals[key] = value;
        }
      });

      setMethodTotals({ ...totals, ...bankTotals });

      if (!data.payments?.length) {
        setNoDataMessage("No daily payments found for today.");
      }
    } catch (err) {
      console.log(err);
      setError("Failed to fetch daily payments.");
    } finally {
      setLoading(false);
    }
  };


  // ---------------- DEBTOR LIST ---------------- //
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

      const data = await fetchWithToken(
        `${API_BASE_URL}/payments/debtor_list?${params}`
      );

      setPayments(data.debtors || []);
      setTotalPayments(data.total_debtors || 0);
      setTotalAmount(data.total_current_debt || 0);

      setSummary({
        total_gross_debt: data.total_gross_debt || 0,
        total_current_debt: data.total_current_debt || 0,
        total_debtors: data.total_debtors || 0,
      });

      if (!data.debtors?.length) {
        setNoDataMessage("No debtors found.");
      }
    } catch {
      setError("Failed to fetch debtor list.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- POPUP ---------------- //
  const handleView = (paymentId) => {
    const payment = payments.find((p) => p.payment_id === paymentId);
    setSelectedPayment(payment || null);
    setShowPopup(true);
  };

  const closePopup = () => {
    setShowPopup(false);
    setSelectedPayment(null);
  };

  const handlePrint = (payment) => {
    const receiptWindow = window.open("", "_blank");

    receiptWindow.document.write(`
      <html>
        <head>
          <title>Payment Receipt</title>
          <style>
            body {
              font-family: monospace, Arial, sans-serif;
              padding: 5px;
              margin: 0;
              width: 80mm;
            }
            h2 {
              text-align: center;
              font-size: 14px;
              margin: 5px 0;
            }
            p {
              margin: 2px 0;
              font-size: 12px;
            }
            hr {
              border: 1px dashed #000;
              margin: 6px 0;
            }
          </style>
        </head>
        <body>
          <h2>${businessName.toUpperCase()}</h2>
          <h2>Payment Receipt</h2>
          <hr/>

          <p><strong>Payment ID:</strong> ${payment.payment_id}</p>
          <p><strong>Booking ID:</strong> ${payment.booking_id}</p>
          <p><strong>Guest Name:</strong> ${payment.guest_name}</p>
          <p><strong>Room:</strong> ${payment.room_number}</p>

          <hr/>

          <p><strong>Booking Cost:</strong> ₦${(payment.booking_cost || 0).toLocaleString()}</p>
          <p><strong>Amount Paid:</strong> ₦${(payment.amount_paid || 0).toLocaleString()}</p>
          <p><strong>Discount:</strong> ₦${(payment.discount_allowed || 0).toLocaleString()}</p>
          <p><strong>Balance:</strong> ₦${(payment.balance_due || 0).toLocaleString()}</p>

          <hr/>

          <p><strong>Payment Method:</strong> ${payment.payment_method}</p>
          <p><strong>Bank:</strong> ${payment.bank_name || "N/A"}</p>
          <p><strong>Status:</strong> ${payment.status}</p>
          <p><strong>Date:</strong> ${new Date(payment.payment_date).toLocaleString()}</p>

          <hr/>
          <p style="text-align:center;">Thank you!</p>
        </body>
      </html>
    `);

    receiptWindow.document.close();
    receiptWindow.print();
  };



  // ---------------- RENDER ---------------- //
  return (
    <div className="list-payment-container">
      <div className="list-payment-header-row">
        <h2 className="compact-title">💳 Payment Management</h2>
      </div>

      {/* FILTER ROWS */}
      <div className="filters-grid">
        <div className="filter-item">
          <label>Payment Status:</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="none">Select</option>
            <option value="All">All</option>
            <option value="fully paid">Fully Paid</option>
            <option value="part payment">Part Payment</option>
            <option value="voided">Voided</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Bank:</label>
          <select
            value={bankFilter}
            onChange={(e) => setBankFilter(e.target.value)}
          >
            <option value="">All</option>
            {banks.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Debtor:</label>
          <input
            type="text"
            placeholder="Enter name..."
            value={debtorName}
            onChange={(e) => setDebtorName(e.target.value)}
          />
        </div>

        <div className="filter-item">
          <button className="fetch-button" onClick={fetchByStatus}>
            Fetch Payments
          </button>
          <button className="fetch-button" onClick={fetchDebtors}>
            Fetch Debtors
          </button>
        </div>
      </div>

      {/* DATE RANGE */}
      <div className="filters-grid">
        <div className="filter-item">
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
          <button className="daily-button" onClick={fetchDaily}>
            📊 Daily Summary
          </button>
        </div>
      </div>

      {/* POPUP */}
      {showPopup && selectedPayment && (
        <div className="popup-overlay">
          <div className="popup-content large-popup">
            <h2 className="popup-title">Guest Payment Details</h2>

            <div className="popup-grid large-font">
              <div>
                <strong>Payment ID:</strong> {selectedPayment.payment_id}
              </div>
              <div>
                <strong>Booking ID:</strong> {selectedPayment.booking_id}
              </div>
              <div>
                <strong>Guest Name:</strong> {selectedPayment.guest_name}
              </div>
              <div>
                <strong>Room Number:</strong> {selectedPayment.room_number}
              </div>
              <div>
                <strong>Booking Cost:</strong> ₦
                {selectedPayment.booking_cost?.toLocaleString()}
              </div>
              <div>
                <strong>Amount Paid:</strong> ₦
                {selectedPayment.amount_paid?.toLocaleString()}
              </div>
              <div>
                <strong>Discount:</strong> ₦
                {selectedPayment.discount_allowed?.toLocaleString()}
              </div>
              <div>
                <strong>Balance Due:</strong> ₦
                {selectedPayment.balance_due?.toLocaleString()}
              </div>
              <div>
                <strong>Method:</strong> {selectedPayment.payment_method}
              </div>
              <div>
                <strong>Bank:</strong> {selectedPayment.bank_name || "N/A"}
              </div>
              <div>
                <strong>Status:</strong> {selectedPayment.status}
              </div>
              <div>
                <strong>Payment Date:</strong>{" "}
                {new Date(selectedPayment.payment_date).toLocaleString()}
              </div>
              <div>
                <strong>Void Date:</strong> {selectedPayment.void_date || "-"}
              </div>
              <div>
                <strong>Created By:</strong> {selectedPayment.created_by}
              </div>
            </div>

            <div className="popup-buttons">
              <button
                className="print-btn"
                onClick={() => handlePrint(selectedPayment)}
              >
                🖨 Print to PDF
              </button>

              <button className="close-popup-btn" onClick={closePopup}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOADING / ERRORS */}
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {noDataMessage && <p className="no-data">{noDataMessage}</p>}

      {/* DAILY SUMMARY */}
      {viewMode === "daily" && (
        <div className="summary-box daily-summary">
          <h3>📊 Today’s Payment Summary</h3>

          <div className="summary-grid">
            <div className="summary-item">
              <strong>Total Payments:</strong>{" "}
              {totalPayments.toLocaleString()}
            </div>

            <div className="summary-item">
              <strong>Total Amount:</strong>{" "}
              ₦{totalAmount.toLocaleString()}
            </div>

            <div className="summary-item">
              <strong>POS Card:</strong>{" "}
              ₦{(methodTotals.pos_card || 0).toLocaleString()}
            </div>

            <div className="summary-item">
              <strong>Bank Transfer:</strong>{" "}
              ₦{(methodTotals.bank_transfer || 0).toLocaleString()}
            </div>

            <div className="summary-item">
              <strong>Cash:</strong>{" "}
              ₦{(methodTotals.cash || 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* ALL PAYMENTS SUMMARY — cleaned and simplified */}
      {viewMode === "all" && Object.keys(methodTotals || {}).length > 0 && (
        <div className="summary-box compact-summary">
          <h4>💰 Payment Summary</h4>

          <div className="summary-stack">
            <div className="summary-item">
              <strong>Cash:</strong> ₦{(methodTotals.total_cash ?? 0).toLocaleString()}
            </div>
            <div className="summary-item">
              <strong>POS:</strong> ₦{(methodTotals.total_pos ?? 0).toLocaleString()}
            </div>
            <div className="summary-item">
              <strong>Bank Transfer:</strong> ₦{(methodTotals.total_bank_transfer ?? 0).toLocaleString()}
            </div>

            {/* 🔥 ADD THIS TOTAL PAYMENT ROW */}
            <div className="summary-item total-row">
              <strong>Total Payment:</strong>{" "}
              ₦{(
                (methodTotals.total_cash ?? 0) +
                (methodTotals.total_pos ?? 0) +
                (methodTotals.total_bank_transfer ?? 0)
              ).toLocaleString()}
            </div>
          </div>

          {/* BANK-WISE BREAKDOWN */}
          {Object.keys(methodTotals)
            .filter(
              (k) =>
                ![
                  "total_cash",
                  "total_pos",
                  "total_bank_transfer",
                  "total_payment",
                ].includes(k)
            )
            .map((bankName) => {
              const bankData = methodTotals[bankName];
              return (
                <div key={bankName} className="summary-stack bank-summary">
                  <div className="summary-item bank-name">
                    <strong>{bankName}</strong>
                  </div>
                  <div className="summary-item">
                    POS: ₦{(bankData.pos_card ?? 0).toLocaleString()}
                  </div>
                  <div className="summary-item">
                    Bank Transfer: ₦{(bankData.bank_transfer ?? 0).toLocaleString()}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* DEBTOR SUMMARY */}
      {viewMode === "debtor" && (
        <div className="summary-box debtor-summary">
          <h4>💳 Debtor Summary</h4>
          <div className="summary-grid">
            <div className="summary-item">
              <strong>Total Debtors:</strong> {summary.total_debtors ?? payments.length}
            </div>
            <div className="summary-item">
              <strong>Total Current Debt:</strong> ₦{(summary.total_current_debt ?? 0).toLocaleString()}
            </div>
            <div className="summary-item">
              <strong>Total Gross Debt:</strong> ₦{(summary.total_gross_debt ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT TABLE */}
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
                    <th>Bank</th>
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
                <tr key={i}>
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
                      <td>
                        {p.last_payment_date
                          ? new Date(p.last_payment_date).toLocaleString()
                          : "-"}
                      </td>
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
                      <td>{p.bank_name || "-"}</td>
                      <td>{p.status}</td>
                      <td>{new Date(p.payment_date).toLocaleString()}</td>
                      <td>{p.void_date || "-"}</td>
                      <td>{p.created_by}</td>
                      <td>
                        <button
                          className="view-btn"
                          onClick={() => handleView(p.payment_id)}
                        >
                          View
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ListPayment;
