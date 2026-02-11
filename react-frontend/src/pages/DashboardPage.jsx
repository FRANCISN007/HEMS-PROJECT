import React, { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import axios from "axios";
import HotelPhoto3 from "../assets/images/HotelPhoto3.png";
import "./DashboardPage.css";
import { FaHotel } from "react-icons/fa";
import getBaseUrl from "../api/config";




import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import { FaFileExcel, FaPrint } from "react-icons/fa";


const API_BASE_URL = getBaseUrl();


const DashboardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

const exportToExcel = async () => {
  const table = document.querySelector(".content-area table");
  if (!table) return alert("No table found to export.");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("DashboardData");

  // ✅ Determine title by pathname
  const path = window.location.pathname;
  let title = "Dashboard Data";
  if (path.includes("bookings")) title = "Guest Booking Details";
  else if (path.includes("payments")) title = "Payment Report";
  else if (path.includes("debtor")) title = "Debtor Report";
  else if (path.includes("events")) title = "Event Report";
  else if (path.includes("daily")) title = "Daily Payment Summary";
  else if (path.includes("eventpayment")) title = "Event Payment Report";

  const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
    th.innerText.trim()
  );
  const colCount = headers.length;

  // ✅ Title
  sheet.mergeCells(1, 1, 1, colCount);
  const titleCell = sheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = { size: 14, bold: true };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };

  // ✅ Table headers
  sheet.addRow(headers).font = { bold: true };

  // ✅ Table rows
  const rows = Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
    Array.from(tr.querySelectorAll("td")).map((td) => td.innerText.trim())
  );
  rows.forEach((row) => sheet.addRow(row));

  // ✅ Blank row
  sheet.addRow([]);

  // === 🔽 Summary Sections ===

  // 1. Booking Summary
  const bookingSummary = document.querySelector(".booking-summary");
  if (bookingSummary) {
    const lines = Array.from(bookingSummary.querySelectorAll("p")).map((p) =>
      p.innerText.trim()
    );
    if (lines.length) {
      sheet.addRow(["Booking Summary"]).font = { bold: true, italic: true };
      lines.forEach((line) => sheet.addRow([line]));
      sheet.addRow([]);
    }
  }

  // 2. Payment Summary
  const allSummary = document.querySelector(".all-summary-wrapper");
  if (allSummary) {
    sheet.addRow(["Payment Summary"]).font = { bold: true, italic: true };
    const rows = allSummary.querySelectorAll(".summary-row");
    rows.forEach((rowEl) => {
      const left = rowEl.querySelector(".summary-left");
      const right = rowEl.querySelector(".summary-right");

      const leftText = left ? left.innerText.trim() : "";
      const rightText = right ? right.innerText.trim() : "";

      if (leftText && rightText) {
        sheet.addRow([leftText, rightText]);
      } else if (leftText) {
        sheet.addRow([leftText]);
      }
    });
    sheet.addRow([]);
  }

  // 3. Debtor Summary
  const debtorSummary = document.querySelector(".debtor-summary-wrapper");
  if (debtorSummary) {
    sheet.addRow(["Debtor Summary"]).font = { bold: true, italic: true };
    const rows = debtorSummary.querySelectorAll(".summary-row");
    rows.forEach((rowEl) => {
      const left = rowEl.querySelector(".summary-left");
      const text = left ? left.innerText.trim() : "";
      if (text) sheet.addRow([text]);
    });
    sheet.addRow([]);
  }

  // 4. Daily Payment Summary
  const dailySummary = document.querySelector(".payment-method-summary");
  if (dailySummary) {
    sheet.addRow(["Daily Payment Breakdown"]).font = { bold: true, italic: true };
    const listItems = dailySummary.querySelectorAll("ul li");
    listItems.forEach((li) => {
      sheet.addRow([li.innerText.trim()]);
    });
    sheet.addRow([]);
  }

  // 5. Status Summary
  const statusSummary = document.querySelector(".status-summary-wrapper");
  if (statusSummary) {
    sheet.addRow(["Status Summary"]).font = { bold: true, italic: true };
    const lines = Array.from(statusSummary.querySelectorAll("p")).map((p) =>
      p.innerText.trim()
    );
    lines.forEach((line) => {
      sheet.addRow([line]);
    });
    sheet.addRow([]);
  }

  // 6. Event Summary
  const eventSummary = document.querySelector(".event-summary-wrapper");
  if (eventSummary) {
    sheet.addRow(["Event Summary"]).font = { bold: true, italic: true };

    const lines = Array.from(eventSummary.querySelectorAll("div")).map((div) =>
      div.innerText.trim()
    );

    lines.forEach((line) => {
      sheet.addRow([line]);
    });

    sheet.addRow([]);
  }

  // 7. ✅ Event Payment Breakdown
  const eventPaymentBreakdown = document.querySelector(".all-summary-wrappers");
  if (eventPaymentBreakdown) {
    sheet.addRow(["Event Payment Breakdown"]).font = { bold: true, italic: true };
    const rows = eventPaymentBreakdown.querySelectorAll(".summary-rows");
    rows.forEach((rowEl) => {
      const left = rowEl.querySelector(".summary-lefts");
      const right = rowEl.querySelector(".summary-rights");

      const leftText = left ? left.innerText.trim() : "";
      const rightText = right ? right.innerText.trim() : "";

      if (leftText && rightText) {
        sheet.addRow([leftText, rightText]);
      } else if (leftText) {
        sheet.addRow([leftText]);
      }
    });
    sheet.addRow([]);
  }

  // 8. ✅ Event Payment Summary (Outstanding Events + Balance)
  const eventOutstandingSummary = document.querySelector(".event-payment-summary");
  if (eventOutstandingSummary) {
    sheet.addRow(["Outstanding Event Summary"]).font = { bold: true, italic: true };

    const lines = Array.from(
      eventOutstandingSummary.querySelectorAll(".summary-line")
    ).map((el) => el.innerText.trim());

    lines.forEach((line) => {
      sheet.addRow([line]);
    });

    sheet.addRow([]);
  }

  // ✅ Style all cells
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { vertical: "middle", horizontal: "left" };
    });
  });

  // ✅ Auto column width
  sheet.columns.forEach((col) => {
    let maxLength = 10;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const val = cell.value ? cell.value.toString() : "";
      maxLength = Math.max(maxLength, val.length);
    });
    col.width = maxLength + 2;
  });

  // ✅ Download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `${title.replace(/\s+/g, "_").toLowerCase()}.xlsx`);
};


const printContent = () => {
  const content = document.querySelector(".content-area");
  if (!content) return;

  const printWindow = window.open("", "_blank");
  printWindow.document.write("<html><head><title>Print</title></head><body>");
  printWindow.document.write(content.innerHTML);
  printWindow.document.write("</body></html>");
  printWindow.document.close();
  printWindow.print();
};

  const userRole = "admin";

  const [hasReservationAlert, setHasReservationAlert] = useState(false);
  const [isBookingsHovered, setBookingsHovered] = useState(false);
  const [isPaymentsHovered, setPaymentsHovered] = useState(false);
  const [isEventsHovered, setEventsHovered] = useState(false);
  const [reservationCount, setReservationCount] = useState(0);

    useEffect(() => {
      const token = localStorage.getItem("token");
      if (!token) return;

      const checkDashboardStatus = async () => {
        try {
          // ✅ 1. Check reservation alerts
          const res = await axios.get(`${API_BASE_URL}/bookings/reservations/alerts`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const count = res.data.count || 0;
          setReservationCount(count);

          // ✅ 2. Trigger backend to auto-update room statuses after checkout time
          await axios.post(`${API_BASE_URL}/rooms/update_status_after_checkout`, {}, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

        } catch (err) {
          console.error("Dashboard check failed:", err.message);
        }
      };

      // Initial run
      checkDashboardStatus();

      // 🔁 Repeat every 30 seconds
      const intervalId = setInterval(checkDashboardStatus, 5000);

      // Cleanup
      return () => clearInterval(intervalId);
    }, []);

  const menu = [
    { name: "🙎 Users", path: "/dashboard/users", adminOnly: true },
    { name: "🏨 Rooms", path: "/dashboard/rooms" },
    { name: "📅 Bookings", path: "/dashboard/bookings" },
    { name: "💳 Payments", path: "/dashboard/payments" },
    { name: "🎉 Events", path: "/dashboard/events" },
    { name: "🍷 Bar & Lounge", path: "/bar" },
    { name: "🏪 Store & Inventory", path: "/store" },
    { name: "🍽️ Restaurant", path: "/restaurant" }, // ✅ fixed
    { name: "🟩 Room Status", path: "/dashboard/rooms/status" }, // ⬅️ add this
  ];

  const bookingSubmenu = [
    { label: "➕ Create Booking", path: "/dashboard/bookings/create" },
    { label: "📝 List Booking", path: "/dashboard/bookings/list" },
    { label: "✅ Checkout Guest", path: "/dashboard/bookings/checkout" },
    { label: "❌ Cancel Booking", path: "/dashboard/bookings/cancel" },
  ];

  const paymentSubmenu = [
    { label: "➕ Create Bank", path: "/dashboard/payments/bankcreate" },
    { label: "➕ Create Payment", path: "/dashboard/payments/create" },
    { label: "📝 List Payment", path: "/dashboard/payments/list" },
    { label: "❌ Void payment", path: "/dashboard/payments/void" },
  ];

  const eventSubmenu = [
    { label: "➕ Create Event", path: "/dashboard/events/create" },
    { label: "📝 List Event", path: "/dashboard/events/list" },
    { label: "💳 Make Payment", path: "/dashboard/events/payment" },
    { label: "📄 List Payment", path: "/dashboard/events/payments/list" },
    { label: "❌ Void Payment", path: "/dashboard/events/payments/void" },
    

  ];


  const handleBackupClick = async () => {
    const confirmBackup = window.confirm("Are you sure you want to back up the database?");
    if (!confirmBackup) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/backup/db`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        alert(`❌ Backup failed: ${text}`);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || "backup.sql";

      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);

      alert(`✅ Backup downloaded: ${filename}`);
    } catch (error) {
      alert(`❌ Backup failed: ${error.message}`);
    }
  };




  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <h2 className="sidebar-title">MENU</h2>

        <nav>
          {menu.map((item) => {
            const isBookings = item.name.includes("Bookings");
            const isPayments = item.name.includes("Payments");
            const isEvents = item.name.includes("Events");

            return (!item.adminOnly || userRole === "admin") ? (
              <div
                key={item.path}
                className="sidebar-item-wrapper"
                onMouseEnter={() => {
                  if (isBookings) setBookingsHovered(true);
                  if (isPayments) setPaymentsHovered(true);
                  if (isEvents) setEventsHovered(true);
                }}
                onMouseLeave={() => {
                  if (isBookings) setBookingsHovered(false);
                  if (isPayments) setPaymentsHovered(false);
                  if (isEvents) setEventsHovered(false);
                }}
                style={{ position: "relative" }}
              >
                <button
                  onClick={() => {
                    navigate(item.path); // let React Router handle it
                  }}



                  className={`sidebar-button ${
                    isBookings && isBookingsHovered ||
                    isPayments && isPaymentsHovered ||
                    isEvents && isEventsHovered
                      ? "sidebar-button-active"
                      : ""
                  }`}
                >
                  <span style={{ fontSize: "1.3rem", marginRight: "6px" }}>
                    {item.name.slice(0, 2)}
                  </span>
                  {item.name.slice(2).trim()}
                </button>

                {isBookings && isBookingsHovered && (
                  <div className="submenu">
                    {bookingSubmenu.map((sub) => (
                      <button
                        key={sub.path}
                        onClick={() => {
                          navigate(sub.path);
                          setBookingsHovered(false);
                        }}
                        className="submenu-item"
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}

                {isPayments && isPaymentsHovered && (
                  <div className="submenu">
                    {paymentSubmenu.map((sub) => (
                      <button
                        key={sub.path}
                        onClick={() => {
                          navigate(sub.path);
                          setPaymentsHovered(false);
                        }}
                        className="submenu-item"
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* ✅ Event submenu */}
                {isEvents && isEventsHovered && (
                <div className="submenu">
                  {eventSubmenu.map((sub) => (
                    <button
                      key={sub.path}
                      onClick={() => {
                        navigate(sub.path);
                        setEventsHovered(false);
                      }}
                      className="submenu-item"
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}


              </div>
            ) : null;
          })}

          <button
            onClick={handleBackupClick}
            className="sidebars-button"
            style={{ fontSize: "0.9rem", marginTop: "8px" }}
          >
            💾 Backup Files
          </button>


          <button
            onClick={() => navigate("/dashboard/reservation-alert")}
            className={`sidebar-button reservation-button ${
              reservationCount > 0 ? "alert-active" : "alert-inactive"
            }`}
          >
            🔔 Reservation Alert{reservationCount > 0 ? ` (${reservationCount})` : ""}
          </button>


        </nav>
      </aside>

      <button onClick={() => navigate("/logout")} className="logout-button">
        🚪 Logout
      </button>

      <main className="main-content">
        <header
          className="header"
          style={{
            display: "flex",
            alignItems: "center",
            paddingRight: "110px", // ✅ create space from the Logout button
            gap: "20px",
          }}
        >
          <h1 className="header-title" style={{ flexGrow: 1 }}>
            🏠 Hotel Management Dashboard
          </h1>

          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={exportToExcel} className="action-button">
              <FaFileExcel style={{ marginRight: "5px" }} />
              Export to Excel
            </button>
            <button onClick={printContent} className="action-button">
              <FaPrint style={{ marginRight: "5px" }} />
              Print
            </button>
          </div>
        </header>


        <section
                  className="content-area"
                  style={{
                    position: "relative",
                    minHeight: "100%",
                    backgroundImage:
                      location.pathname === "/dashboard" ? `url(${HotelPhoto3})` : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                >
                  <Outlet />
                </section>
      </main>
    </div>
  );
};

export default DashboardPage;