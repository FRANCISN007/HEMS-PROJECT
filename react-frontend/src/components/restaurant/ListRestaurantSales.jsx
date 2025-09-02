import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./ListRestaurantSales.css";

const ListRestaurantSales = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    total_sales_amount: 0,
    total_paid_amount: 0,
    total_balance: 0,
  });

  // Fetch sales from backend
  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await axiosWithAuth().get("/restaurant/sales");
      console.log("🔍 Sales response:", res.data);

      setSales(res.data.sales || []);
      setSummary(res.data.summary || {
        total_sales_amount: 0,
        total_paid_amount: 0,
        total_balance: 0,
      });
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
    </div>
  );
};

export default ListRestaurantSales;
