import React, { useEffect, useState } from "react";
import axiosWithAuth from "../../utils/axiosWithAuth";
import "./StockBalance.css";

const StockBalance = () => {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchStockBalances();
  }, []);

  const fetchStockBalances = async () => {
    try {
      const axios = axiosWithAuth();
      const res = await axios.get("/store/balance-stock");
      setBalances(res.data || []);
    } catch (error) {
      console.error("Error fetching stock balances:", error);
      setMessage("❌ Failed to load stock balances");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const totalStockAmount = balances.reduce(
    (sum, item) => sum + (item.balance_total_amount || 0),
    0
  );

  if (loading) return <p>Loading...</p>;

  return (
    <div className="stock-balance-container">
      <div className="stock-balance-header">
        <h2>📊 Stock Balance Report</h2>
        <div className="total-stock">
          Total Stock Value:{" "}
          <strong>₦{totalStockAmount.toLocaleString()}</strong>
        </div>
      </div>

      {message && <div className="message">{message}</div>}

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Unit</th>
            <th>Total Received</th>
            <th>Total Issued</th>
            <th>Total Adjusted</th>
            <th>Balance</th>
            <th>Last Unit Price</th>
            <th>Balance Value</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((item, index) => (
            <tr
              key={item.item_id}
              className={index % 2 === 0 ? "even-row" : "odd-row"}
            >
              <td>{item.item_name}</td>
              <td>{item.unit}</td>
              <td>{item.total_received}</td>
              <td>{item.total_issued}</td>
              <td>{item.total_adjusted}</td>
              <td>{item.balance}</td>
              <td>
                {item.last_unit_price
                  ? `₦${item.last_unit_price.toLocaleString()}`
                  : "-"}
              </td>
              <td>
                {item.balance_total_amount
                  ? `₦${item.balance_total_amount.toLocaleString()}`
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StockBalance;
