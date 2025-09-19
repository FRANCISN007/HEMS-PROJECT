import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./ViewEventPayment.css";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || `http://${window.location.hostname}:8000`;

const ViewEventPayment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const printRef = useRef();

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];
  if (Array.isArray(storedUser.roles)) roles = storedUser.roles;
  else if (typeof storedUser.role === "string") roles = [storedUser.role];
  roles = roles.map((r) => r.toLowerCase());

  if (!(roles.includes("admin") || roles.includes("event"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to view event payment.</p>
      </div>
    );
  }

  useEffect(() => {
    const fetchPayment = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/eventpayment/eventpayment/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to fetch payment details");
        const data = await res.json();

        // ✅ Use backend-provided total_due and balance_due directly
        setPayment(data);
      } catch (err) {
        setError(err.message || "Error fetching payment");
      } finally {
        setLoading(false);
      }
    };

    fetchPayment();
  }, [id]);

  const handlePrint = () => {
    const printContents = printRef.current.innerHTML;
    const printWindow = window.open("", "", "width=800,height=600");

    printWindow.document.write(`
      <html>
      <head>
        <title>Print Event Payment</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; }
        </style>
      </head>
      <body>
        ${printContents}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  if (loading) return <p>Loading payment details...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!payment) return <p>No payment found.</p>;

  return (
    <div className="view-event-payment-container">
      <button onClick={() => navigate(-1)}>← Back</button>
      <button onClick={handlePrint} style={{ marginLeft: "10px" }}>🖨️ Print</button>

      <div ref={printRef}>
        <h2>Event Payment Details (ID: {payment.id})</h2>
        <table>
          <tbody>
            <tr><th>Organiser:</th><td>{payment.organiser}</td></tr>
            <tr><th>Event Amount:</th><td>₦{payment.event_amount?.toLocaleString()}</td></tr>
            <tr><th>Caution Fee:</th><td>₦{payment.caution_fee?.toLocaleString()}</td></tr>
            <tr><th>Total Due:</th><td>₦{payment.total_due?.toLocaleString()}</td></tr>
            <tr><th>Amount Paid:</th><td>₦{payment.amount_paid?.toLocaleString()}</td></tr>
            <tr><th>Discount Allowed:</th><td>₦{payment.discount_allowed?.toLocaleString()}</td></tr>
            <tr><th>Balance Due:</th><td>₦{payment.balance_due?.toLocaleString()}</td></tr>
            <tr><th>Payment Method:</th><td>{payment.payment_method}</td></tr>
            <tr><th>Payment Status:</th><td>{payment.payment_status}</td></tr>
            <tr><th>Payment Date:</th><td>{new Date(payment.payment_date).toLocaleString()}</td></tr>
            <tr><th>Created By:</th><td>{payment.created_by}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ViewEventPayment;
