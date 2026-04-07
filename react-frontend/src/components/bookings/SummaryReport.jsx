import React, { useState, useEffect, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./SummaryReport.css";
import { HOTEL_NAME } from "../../config/constants";

const SummaryReport = () => {
  const today = new Date().toISOString().split("T")[0];
  const printRef = useRef();

  const [data, setData] = useState(null);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatAmount = (value) => Number(value || 0).toLocaleString();

  const fetchReport = async () => {
    if (!startDate || !endDate) {
      setError("Please select start and end date");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await axiosWithAuth().get("/bookings/summary-report", {
        params: { start_date: startDate, end_date: endDate },
      });
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || "Failed to fetch summary report");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;

    const content = printRef.current.innerHTML;
    const win = window.open("", "", "width=900,height=700");
    win.document.write(`
      <html>
        <head>
          <title>Booking Summary Report</title>
          <style>
            body { font-family: Arial; padding: 10px; font-size: 12px; }
            h1, h2 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 12px; }
            th, td { border: 1px solid #000; padding: 6px; text-align: center; }
            th { background: #f0f2f5; }
            tbody tr:nth-child(odd) { background: #f7f7f7; }
            tbody tr:nth-child(even) { background: #dcf1c8; }
            .grand-total-row { font-weight: bold; border-top: 2px solid #000; background: #e0e0e0; }
            .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 6px; margin-bottom: 8px; }
            .card { background: #f1efef; border: 1px solid #797373; padding: 6px; text-align: center; border-radius: 6px; font-size: 13px; }
            .card span { color: #555; font-weight: 700; font-size: 12px; }
            .card h3 { margin-top: 3px; font-weight: 600; font-size: 13px; }
            .card.highlight { background: #eafaf0; border: 1px solid #28a745; font-weight: bold; }
            .bank-section { margin-top: 6px; font-size: 13px; }
            .bank-section h4 { margin-bottom: 4px; font-size: 14px; }
            .bank-line { display: flex; align-items: center; gap: 10px; padding: 4px 0; border-bottom: 1px dashed #ddd; }
            .bank-line span { white-space: nowrap; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>${HOTEL_NAME}</h1>
          <h2>📊 Booking Summary Report (${startDate} → ${endDate})</h2>
          ${content}
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  useEffect(() => {
    fetchReport();
  }, []);

  return (
    <div className="summary-report-page">
      <h2>📊 Booking Summary Report</h2>

      {/* Filters */}
      <div className="filter-bar">
        <label>Start Date:</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <label>End Date:</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <button className="print-btn" onClick={fetchReport}>🔄 Load</button>
        <button className="print-btn" onClick={handlePrint}>🖨️ Print</button>
      </div>

      {loading && <p>⏳ Loading report...</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <div ref={printRef}>
          {/* Table */}
          <div className="summary-table-container" style={{ overflowX: "auto" }}>
            <table className="summary-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Room</th>
                  <th>Cost</th>
                  <th>Guest</th>
                  <th>Days</th>
                  <th>Type</th>
                  <th>Phone</th>
                  <th>Date</th>
                  <th>Mode of Payment</th>
                  <th>Bank</th>
                  <th>Amount Paid</th>
                  <th>Created by</th>
                </tr>
              </thead>
              <tbody>
                {(data.bookings || []).length > 0 ? (
                  (data.bookings || []).map((b) => (
                    <tr key={b.id}>
                      <td>{b.id}</td>
                      <td>{b.room_number}</td>
                      <td>₦{formatAmount(b.booking_cost)}</td>
                      <td>{b.guest_name}</td>
                      <td>{b.number_of_days}</td>
                      <td>{b.booking_type}</td>
                      <td>{b.phone_number}</td>
                      <td>{new Date(b.booking_date).toLocaleString()}</td>
                      <td>{b.mode_of_payment}</td>
                      <td>{b.bank}</td>
                      <td>₦{formatAmount(b.amount_paid || 0)}</td>
                      <td>{b.created_by}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="12">No bookings found</td>
                  </tr>
                )}
                <tr className="grand-total-row">
                  <td colSpan="2">Total</td>
                  <td>₦{formatAmount(data.total_booking_cost)}</td>
                  <td colSpan="7"></td>
                  <td>₦{formatAmount(data.total_amount_paid)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary Cards */}
          <div className="summary-grid">
            <div className="card"><span>Total Bookings</span><h3>{data.total_bookings}</h3></div>
            <div className="card"><span>Total Cost</span><h3>₦{formatAmount(data.total_booking_cost)}</h3></div>
            <div className="card highlight"><span>Total Paid</span><h3>₦{formatAmount(data.total_amount_paid)}</h3></div>
            <div className="card"><span>Balance Due</span><h3>₦{formatAmount(data.total_balance_due)}</h3></div>
          </div>

          {/* Payment Method Summary */}
          <div className="summary-grid">
            <div className="card highlight"><span>Cash</span><h3>₦{formatAmount(data.payment_summary?.cash)}</h3></div>
            <div className="card"><span>POS</span><h3>₦{formatAmount(data.payment_summary?.pos)}</h3></div>
            <div className="card"><span>Transfer</span><h3>₦{formatAmount(data.payment_summary?.transfer)}</h3></div>
          </div>

          {/* Bank Breakdown */}
          {data.bank_breakdown && Object.keys(data.bank_breakdown).length > 0 && (
            <div className="bank-section">
              <h4>🏦 Bank Breakdown</h4>
              {Object.entries(data.bank_breakdown).map(([bank, val]) => (
                <div key={bank} className="bank-line">
                  <span>{bank}</span>
                  <span>POS: ₦{formatAmount(val.pos)}</span>
                  <span>Transfer: ₦{formatAmount(val.transfer)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SummaryReport;
