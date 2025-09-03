import React, { useEffect, useState, useRef } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListRestaurantSales.css";
import "./Receipt.css"; // ✅ Receipt styles

const ListRestaurantSales = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    total_sales_amount: 0,
    total_paid_amount: 0,
    total_balance: 0,
  });
  const [selectedSale, setSelectedSale] = useState(null); // For print modal
  const printRef = useRef(); // Reference for receipt content

  // Fetch sales from backend
  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await axiosWithAuth().get("/restaurant/sales");
      setSales(res.data.sales || []);
      setSummary(
        res.data.summary || {
          total_sales_amount: 0,
          total_paid_amount: 0,
          total_balance: 0,
        }
      );
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

  // ✅ Print receipt-style content
  const printModalContent = () => {
    if (!printRef.current) return;

    const printWindow = window.open("", "_blank", "width=400,height=600");
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt #${selectedSale.id}</title>
          <style>
            ${document.querySelector("style")?.innerHTML || ""}
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  useEffect(() => {
    fetchSales();
  }, []);

  return (
    <div className="list-sales">
      <h2>📊 Restaurant Sales</h2>

      {loading ? (
        <p>Loading sales...</p>
      ) : sales.length === 0 ? (
        <p className="no-sales">No sales records found.</p>
      ) : (
        <>
          <div className="sales-summary">
            <span>Total Sales: ₦{summary.total_sales_amount.toFixed(2)}</span>
            <span>Total Paid: ₦{summary.total_paid_amount.toFixed(2)}</span>
            <span>Total Balance: ₦{summary.total_balance.toFixed(2)}</span>
          </div>

          <ul className="sales-list">
            {sales.map((sale) => (
              <li key={sale.id} className="sale-card">
                <div className="sale-header">
                  <strong>Sale #{sale.id}</strong> — Served by {sale.served_by} on{" "}
                  {new Date(sale.created_at).toLocaleString()}
                </div>

                <div className="sale-details">
                  <p>Status: <strong>{sale.status}</strong></p>
                  <p>Total Amount: ₦{sale.total_amount.toFixed(2)}</p>
                  <p>Amount Paid: ₦{sale.amount_paid.toFixed(2)}</p>
                  <p>Balance: ₦{sale.balance.toFixed(2)}</p>
                </div>

                <div className="sale-items">
                  <h4>Items:</h4>
                  {sale.items && sale.items.length > 0 ? (
                    sale.items.map((item, idx) => (
                      <div key={idx} className="sale-item">
                        <span>{item.meal_name} × {item.quantity}</span>
                        <span>₦{item.total_price?.toFixed(2)}</span>
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
          <div
            className="print-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div ref={printRef} className="receipt-container">
              <div className="receipt-header">
                <h2>Destone Hotel & Suite</h2>
                <p>Bar / Restaurant</p>
                <p>{new Date(selectedSale.created_at).toLocaleString()}</p>
                <hr />
              </div>

              <div className="receipt-info">
                <p><strong>Sale No:</strong> {selectedSale.id}</p>
                <p><strong>Served by:</strong> {selectedSale.served_by}</p>
              </div>
              <hr />

              <div className="receipt-items">
                {selectedSale.items && selectedSale.items.length > 0 ? (
                  selectedSale.items.map((item, idx) => (
                    <div key={idx} className="receipt-item">
                      <span>{item.quantity} × {item.meal_name}</span>
                      <span className="amount">
                        ₦{item.total_price?.toFixed(2)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p>No items</p>
                )}
              </div>
              <hr />

              <div className="receipt-totals">
                <p><span>Subtotal</span> <span>₦{selectedSale.total_amount.toFixed(2)}</span></p>
                <p><span>Paid</span> <span>₦{selectedSale.amount_paid.toFixed(2)}</span></p>
                <p className="grand-total">
                  <span>Balance</span> 
                  <span>₦{selectedSale.balance.toFixed(2)}</span>
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
