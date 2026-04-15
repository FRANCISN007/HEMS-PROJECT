// src/components/restaurant/ListRestaurantSales.jsx
import React, { useEffect, useState, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListRestaurantSales.css";
import "./Receipt.css"; // ✅ Receipt styles

const ListRestaurantSales = () => {
  const printRef = useRef(); // Reference for receipt content

  // ✅ Helper to get today's YYYY-MM-DD
  const getToday = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  // ✅ States
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    total_sales_amount: 0,
    total_paid_amount: 0,
    total_balance: 0,
  });
  const [selectedSale, setSelectedSale] = useState(null); // For print modal
  const [locationId, setLocationId] = useState(""); // ✅ location filter
  const [locations, setLocations] = useState([]); // ✅ available locations
  const [startDate, setStartDate] = useState(getToday());
  const [endDate, setEndDate] = useState(getToday());

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];

  if (Array.isArray(storedUser.roles)) {
    roles = storedUser.roles;
  } else if (typeof storedUser.role === "string") {
    roles = [storedUser.role];
  }

  roles = roles.map((r) => r.toLowerCase());

  // Get business name from login response (this fixes the business name issue)
  const businessName = storedUser.business?.name || "HEMS Hotel";

  if (!(roles.includes("admin") || roles.includes("restaurant"))) {
    return (
      <div className="unauthorized">
        <h2>🚫 Access Denied</h2>
        <p>You do not have permission to list restaurant sales.</p>
      </div>
    );
  }

  // ✅ Format numbers with commas
  const formatAmount = (value) => {
    if (value === null || value === undefined || value === "") return "0";
    const num = Number(value);
    if (isNaN(num)) return "0";
    return new Intl.NumberFormat("en-NG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // ✅ Fetch sales from backend
  const fetchSalesWithDates = async (from, to) => {
    setLoading(true);
    try {
      const params = {};
      if (locationId) params.location_id = locationId;
      if (from) params.start_date = from;
      if (to) params.end_date = to;

      const res = await axiosWithAuth().get("/restaurant/sales", { params });

      // normalize sales & summary
      const normalizedSales = (res.data.sales || []).map((sale) => ({
        ...sale,
        total_amount: Number(sale.total_amount) || 0,
        amount_paid: Number(sale.amount_paid) || 0,
        balance: Number(sale.balance) || 0,
        items: (sale.items || []).map((item) => ({
          ...item,
          total_price: Number(item.total_price) || 0,
          quantity: Number(item.quantity) || 0,
        })),
      }));

      const normalizedSummary = {
        total_sales_amount: Number(res.data.summary?.total_sales_amount) || 0,
        total_paid_amount: Number(res.data.summary?.total_paid_amount) || 0,
        total_balance: Number(res.data.summary?.total_balance) || 0,
      };

      setSales(normalizedSales);
      setSummary(normalizedSummary);
    } catch (err) {
      console.error("❌ Error fetching sales:", err);
      setSales([]);
      setSummary({
        total_sales_amount: 0,
        total_paid_amount: 0,
        total_balance: 0,
      });
    }
    setLoading(false);
  };

  // Keep this for filter button or manual refetch
  const fetchSales = () => fetchSalesWithDates(startDate, endDate);

  // ✅ Fetch locations from backend
  const fetchLocations = async () => {
    try {
      const res = await axiosWithAuth().get("/restaurant/locations");
      setLocations(res.data || []);
    } catch (err) {
      console.error("❌ Error fetching locations:", err);
      setLocations([]);
    }
  };

  // Delete sale
  const handleDeleteSale = async (saleId) => {
    if (!window.confirm("Are you sure you want to delete this sale?")) return;

    try {
      await axiosWithAuth().delete(`/restaurant/sales/${saleId}`);
      setSales((prev) => prev.filter((sale) => sale.id !== saleId));
    } catch (err) {
      console.error("❌ Error deleting sale:", err);
      alert(err.response?.data?.detail || "Failed to delete sale.");
    }
  };

  // Open print modal
  const handlePrintSale = (sale) => {
    setSelectedSale(sale);
  };

  // Close modal
  const closeModal = () => {
    setSelectedSale(null);
  };

  // ✅ Print receipt-style content optimized for 80mm
  const printModalContent = () => {
    if (!printRef.current || !selectedSale) return;

    const printWindow = window.open("", "_blank", "width=400,height=600");
    printWindow.document.write(`
      <html>
        <head>
          <title>Sale Receipt #${selectedSale.id}</title>
          <style>
          @page { margin: 0; }

          body {
            font-family: monospace, Arial, sans-serif;
            margin: 10;
            padding: 2px 4px;
            width: 76mm;
          }

          h2 {
            text-align: center;
            font-size: 13px;
            margin: 1px 0;
          }

          p {
            margin: 1px 0;
            font-size: 11px;
          }

          hr {
            border: none;
            border-top: 1px dashed #000;
            margin: 3px 0;
          }

          .receipt-item {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
          }

          .receipt-item span:first-child {
            max-width: 60%;
            word-wrap: break-word;
          }

          .grand-total {
            font-weight: bold;
            font-size: 12px;
          }

          .footer {
            text-align: center;
            margin-top: 4px;
            font-size: 10px;
          }
        </style>
        </head>
        <body>
          <h2>${businessName}</h2>
          <p style="text-align:center;">Restaurant Sale Receipt</p>
          <p style="text-align:center;">${new Date(selectedSale.created_at).toLocaleString()}</p>
          <hr />

          <p><strong>Sale No:</strong> ${selectedSale.id}</p>
          <p><strong>Guest:</strong> ${selectedSale.guest_name || "N/A"}</p>
          <p><strong>Served by:</strong> ${selectedSale.served_by}</p>
          <hr />

          ${selectedSale.items && selectedSale.items.length > 0
            ? selectedSale.items.map(
                (item) => `
                  <div class="receipt-item">
                    <span>${item.quantity} × ${item.item_name}</span>
                    <span>₦${Number(item.total_price).toLocaleString()}</span>
                  </div>`
              ).join("")
            : "<p>No items</p>"
          }

          <hr />
          <p class="receipt-item"><span>Subtotal</span> <span>₦${Number(selectedSale.total_amount).toLocaleString()}</span></p>
          <p class="receipt-item"><span>Paid</span> <span>₦${Number(selectedSale.amount_paid).toLocaleString()}</span></p>
          <p class="receipt-item grand-total"><span>Balance</span> <span>₦${Number(selectedSale.balance).toLocaleString()}</span></p>
          <hr />

          <div class="footer">
            <p>Thank you for your patronage!</p>
            <p>Powered by HEMS</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  // ✅ Load locations & today’s sales on mount
  useEffect(() => {
    fetchLocations();
    fetchSalesWithDates(getToday(), getToday());
  }, []);

  // ✅ Refetch sales when location/date filters change
  useEffect(() => {
    fetchSales();
  }, [locationId, startDate, endDate]);

  return (
    <div className="list-sales">
      <h2>📊 Restaurant Sales</h2>

      {/* ✅ Filters */}
      <div className="filter-bar">
        <label>Filter by Location:</label>
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
        >
          <option value="">All Locations</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>

        <label>From:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />

        <label>To:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      {loading ? (
        <p>Loading sales...</p>
      ) : sales.length === 0 ? (
        <p className="no-sales">No sales records found.</p>
      ) : (
        <>
          <div className="sales-summary">
            <span>Total Sales: ₦{formatAmount(summary.total_sales_amount)}</span>
            <span>Total Paid: ₦{formatAmount(summary.total_paid_amount)}</span>
            <span>Total Balance: ₦{formatAmount(summary.total_balance)}</span>
          </div>

          <ul className="sales-list">
            {sales.map((sale) => (
              <li key={sale.id} className="sale-card">
                <div className="sale-header">
                  <strong>Sale #{sale.id}</strong> — Served by {sale.served_by} on{" "}
                  {new Date(sale.created_at).toLocaleString()}
                </div>

                <div className="sale-details">
                  <p>Guest Name: <strong>{sale.guest_name}</strong></p>
                  <p>Status: <strong>{sale.status}</strong></p>
                  <p>Total Amount: ₦{formatAmount(sale.total_amount)}</p>
                  <p>Amount Paid: ₦{formatAmount(sale.amount_paid)}</p>
                  <p>Balance: ₦{formatAmount(sale.balance)}</p>
                </div>

                <div className="sale-items">
                  <h4>Items:</h4>
                  {sale.items && sale.items.length > 0 ? (
                    sale.items.map((item, idx) => (
                      <div key={idx} className="sale-item">
                        <span>{item.item_name} × {item.quantity}</span>
                        <span>₦{formatAmount(item.total_price)}</span>
                      </div>
                    ))
                  ) : (
                    <p>No items</p>
                  )}
                </div>

                <div className="sale-footer">
                  <button
                    className="print-sale-btn"
                    onClick={() => handlePrintSale(sale)}
                  >
                    🖨️ Print
                  </button>
                  <button
                    className="delete-sale-btn"
                    onClick={() => handleDeleteSale(sale.id)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ✅ Global Modal showing POS receipt */}
      {selectedSale && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="print-modal" onClick={(e) => e.stopPropagation()}>
            <div ref={printRef} className="receipt-container">
              <div className="receipt-header">
                <h2>{businessName}</h2>
                <p>Restaurant Sales & Payment</p>
                <p>{new Date(selectedSale.created_at).toLocaleString()}</p>
                <hr />
              </div>

              <div className="receipt-info">
                <p><strong>Sale No:</strong> {selectedSale.id}</p>
                <p><strong>Guest:</strong> {selectedSale.guest_name || "N/A"}</p>
                <p><strong>Served by:</strong> {selectedSale.served_by}</p>
              </div>
              <hr />

              <div className="receipt-items">
                {selectedSale.items && selectedSale.items.length > 0 ? (
                  selectedSale.items.map((item, idx) => (
                    <div key={idx} className="receipt-item">
                      <span>{item.quantity} × {item.item_name}</span>
                      <span className="amount">₦{formatAmount(item.total_price)}</span>
                    </div>
                  ))
                ) : (
                  <p>No items</p>
                )}
              </div>
              <hr />

              <div className="receipt-totals">
                <p><span>Subtotal</span> <span>₦{formatAmount(selectedSale.total_amount)}</span></p>
                <p><span>Paid</span> <span>₦{formatAmount(selectedSale.amount_paid)}</span></p>
                <p className="grand-total">
                  <span>Balance</span> 
                  <span>₦{formatAmount(selectedSale.balance)}</span>
                </p>
              </div>

              <hr />

              <div className="receipt-footer">
                <p>Thank you for your patronage!</p>
                <p>Powered by HEMS</p>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={printModalContent} className="print-btn">
                🖨️ Print Now
              </button>
              <button onClick={closeModal} className="close-btn">
                ❌
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListRestaurantSales;