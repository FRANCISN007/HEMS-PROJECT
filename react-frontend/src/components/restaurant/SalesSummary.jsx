import React, { useEffect, useState, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./SalesSummary.css";

const SalesSummary = () => {
  const getToday = () => new Date().toISOString().split("T")[0];
  const printRef = useRef();

  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());
  const [locationId, setLocationId] = useState("");
  const [locations, setLocations] = useState([]);
  const [itemSummary, setItemSummary] = useState([]);
  const [itemsSummary, setItemsSummary] = useState({});
  const [paymentSummary, setPaymentSummary] = useState({});
  const [loading, setLoading] = useState(false);

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];

  if (Array.isArray(storedUser.roles)) roles = storedUser.roles;
  else if (typeof storedUser.role === "string") roles = [storedUser.role];

  roles = roles.map((r) => r.toLowerCase());

  // ✅ Dynamic business name
  const businessName = storedUser.business?.name || "HEMS Hotel";

  if (!(roles.includes("admin") || roles.includes("restaurant"))) {
    return <div className="unauthorized">🚫 Access Denied</div>;
  }

  const formatAmount = (value) => {
    const num = Number(value) || 0;
    return new Intl.NumberFormat("en-NG").format(num);
  };

  const fetchLocations = async () => {
    try {
      const res = await axiosWithAuth().get("/restaurant/locations");
      setLocations(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const params = {};
      if (locationId) params.location_id = locationId;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await axiosWithAuth().get(
        "/restaurant/sales/items-summary",
        { params }
      );

      setItemSummary(res.data.items || []);
      setItemsSummary(res.data.items_summary || {});
      setPaymentSummary(res.data.payment_summary || {});
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLocations();
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [locationId, startDate, endDate]);

  // 🖨️ PRINT FUNCTION WITH BUSINESS NAME (NO TEMPLATE STRING $)
  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const newWindow = window.open("", "", "width=900,height=700");

    const html =
      "<html>" +
      "<head>" +
      "<title>Sales Summary</title>" +
      "<style>" +
      "body { font-family: Arial; padding: 10px; font-size: 12px; }" +
      "h1, h2, h4 { margin: 6px 0; text-align: center; }" +

      "table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }" +
      "th, td { border: 1px solid #000; padding: 5px; text-align: center; }" +
      "th { background: #eee; }" +

      ".grand-total-row { font-weight: bold; border-top: 3px solid #000; background: #f0f0f0; }" +

      ".summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px; }" +
      ".card { border: 1px solid #000; padding: 6px; text-align: center; }" +
      ".highlight { background: #eafaf0; border: 1px solid #28a745; }" +

      ".bank-section { margin-top: 10px; }" +
      ".bank-line { display: grid; grid-template-columns: 120px 1fr 1fr; gap: 10px; padding: 3px 0; }" +
      ".bank-name { font-weight: bold; }" +
      "</style>" +
      "</head>" +
      "<body>" +
      "<h1>" + businessName + "</h1>" +
      "<h2>📊 Restaurant Sales Summary</h2>" +
      printContent +
      "</body>" +
      "</html>";

    newWindow.document.write(html);
    newWindow.document.close();
    newWindow.print();
  };

  return (
    <div className="sales-summary-page">
      <h2>📊 Sales Summary</h2>

      {/* Filters */}
      <div className="filter-bar">
        <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">All Locations</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>

        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

        <button className="print-btn" onClick={handlePrint}>🖨️ Print</button>
      </div>

      {loading ? <p>Loading...</p> : (
        <div ref={printRef}>
          {/* ITEMS TABLE */}
          <div className="summary-table-container">
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {itemSummary.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.item}</td>
                    <td>{item.qty}</td>
                    <td>{formatAmount(item.price)}</td>
                    <td>{formatAmount(item.amount)}</td>
                  </tr>
                ))}
                <tr className="grand-total-row">
                  <td colSpan="3">Total</td>
                  <td>₦{formatAmount(itemsSummary.grand_total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SUMMARY */}
          <div className="summary-grid top-summary">
            <div className="card">
              <span>Sales</span><h3>₦{formatAmount(paymentSummary.total_sales)}</h3>
            </div>
            <div className="card">
              <span>Paid</span><h3>₦{formatAmount(paymentSummary.total_paid)}</h3>
            </div>
            <div className="card">
              <span>Balance</span><h3>₦{formatAmount(paymentSummary.total_due)}</h3>
            </div>
          </div>

          <div className="summary-grid payment-row">
            <div className="card highlight">
              <span>Cash</span><h3>₦{formatAmount(paymentSummary.total_cash)}</h3>
            </div>
            <div className="card">
              <span>POS</span><h3>₦{formatAmount(paymentSummary.total_pos)}</h3>
            </div>
            <div className="card">
              <span>Transfer</span><h3>₦{formatAmount(paymentSummary.total_transfer)}</h3>
            </div>
          </div>

          {/* BANK */}
          <div className="bank-section">
            <h4>🏦 Bank Breakdown</h4>
            {paymentSummary.banks &&
              Object.entries(paymentSummary.banks).map(([bank, data]) => (
                <div key={bank} className="bank-line">
                  <span className="bank-name">{bank}</span>
                  <span>POS: ₦{formatAmount(data.pos)}</span>
                  <span>Transfer: ₦{formatAmount(data.transfer)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesSummary;
