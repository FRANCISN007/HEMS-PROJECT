import React, { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import axios from "axios";
//import HotelPhoto3 from "../assets/images/HotelPhoto3.png";
import "./DashboardPage.css";
import * as FaIcons from "react-icons/fa";

import getBaseUrl from "../api/config";
import axiosWithAuth from "../utils/axiosWithAuth";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";


const API_BASE_URL = getBaseUrl();

const DashboardPage = () => {
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  const businessName = storedUser.business?.name || "HEMS Hotel";

  const navigate = useNavigate();

  // ✅ 🔐 AUTH GUARD (ADD THIS HERE)
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
    }
  }, [navigate]);

  // 🔥 PORTAL SUBMENU STATE (Same as Restaurant Dashboard)
  const [submenu, setSubmenu] = useState({
    items: [],
    position: null,
    visible: false,
  });

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

    // 7. Event Payment Breakdown
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

    // 8. Event Payment Summary (Outstanding Events + Balance)
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

  //const [hasReservationAlert, setHasReservationAlert] = useState(false);
  const [reservationCount, setReservationCount] = useState(0);
  const [licenseInfo, setLicenseInfo] = useState(null);

  // 🔥 PORTAL SUBMENU FUNCTIONS
  const openSubmenu = (e, item) => {
    const rect = e.currentTarget.getBoundingClientRect();

    setSubmenu({
      items: item.submenu || [],
      visible: true,
      position: {
        top: rect.top,
        left: rect.right + 5,
      },
    });
  };

  const closeSubmenu = () => {
    setSubmenu({ items: [], position: null, visible: false });
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;

    const getParams = () => {
      let params = {};

      if (user && user.roles?.includes("super_admin")) {
        if (!user.business_id) {
          console.warn("❌ Super admin must select a business_id");
          return null;
        }
        params.business_id = user.business_id;
      }

      return params;
    };

    const checkAlerts = async () => {
      try {
        const params = getParams();
        if (params === null) return;

        const res = await axios.get(
          `${API_BASE_URL}/bookings/reservation-alerts`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params,
          }
        );

        console.log("ALERT RESPONSE:", res.data);

        const count = Array.isArray(res.data) ? res.data.length : 0;
        setReservationCount(count);
      } catch (err) {
        console.error("❌ Alert fetch failed:", err.message);
      }
    };

    const updateRooms = async () => {
      try {
        const params = getParams();
        if (params === null) return;

        await axios.post(
          `${API_BASE_URL}/rooms/update_status_after_checkout`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
            params,
          }
        );
      } catch (err) {
        console.error("❌ Room update failed:", err.message);
      }
    };

    const checkLicense = async () => {
      try {
        const res = await axiosWithAuth().get("/license/check");
        console.log("LICENSE RESPONSE:", res.data);
        setLicenseInfo(res.data);
      } catch (err) {
        console.error("❌ License check failed:", err?.response?.data || err.message);
      }
    };

    // Initial run
    checkAlerts();
    updateRooms();
    checkLicense();

    // Polling
    const alertInterval = setInterval(checkAlerts, 5000);
    const updateInterval = setInterval(updateRooms, 20000);
    const licenseInterval = setInterval(checkLicense, 60000);

    return () => {
      clearInterval(alertInterval);
      clearInterval(updateInterval);
      clearInterval(licenseInterval);
    };
  }, []);

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

  // Updated Menu with submenu support
  const menu = [
    { name: "🙎 Users", path: "/dashboard/users", adminOnly: true },
    { name: "🏨 Rooms", path: "/dashboard/rooms" },
    { 
      name: "📅 Bookings", 
      submenu: [
        { label: "➕ Create Booking", path: "/dashboard/bookings/create" },
        { label: "📝 List Booking", path: "/dashboard/bookings/list" },
        { label: "✅ Checkout Guest", path: "/dashboard/bookings/checkout" },
        { label: "❌ Cancel Booking", path: "/dashboard/bookings/cancel" },
        { label: "📊 Summary Report", path: "/dashboard/bookings/summary" },
      ]
    },
    { 
      name: "💳 Payments", 
      submenu: [
        { label: "➕ Create Bank", path: "/dashboard/payments/bankcreate" },
        { label: "➕ Create Payment", path: "/dashboard/payments/create" },
        { label: "📝 List Payment", path: "/dashboard/payments/list" },
        { label: "❌ Void payment", path: "/dashboard/payments/void" },
      ]
    },
    { 
      name: "🎉 Events", 
      submenu: [
        { label: "➕ Create Event", path: "/dashboard/events/create" },
        { label: "📝 List Event", path: "/dashboard/events/list" },
        { label: "💳 Make Payment", path: "/dashboard/events/payment" },
        { label: "📄 List Payment", path: "/dashboard/events/payments/list" },
        { label: "❌ Void Payment", path: "/dashboard/events/payments/void" },
      ]
    },
    { name: "🍷 Bar & Lounge", path: "/bar" },
    { name: "🏪 Store & Inventory", path: "/store" },
    { name: "🍽️ Restaurant", path: "/restaurant" },
    { name: "🟩 Room Status", path: "/dashboard/rooms/status" },
  ];

  return (
    <div className="dashboard-container" onClick={closeSubmenu}>
      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2 className="sidebar-title">MENU</h2>

        <nav>
          {menu.map((item) => {
            const hasSubmenu = !!item.submenu;
            const isAdminOnly = item.adminOnly && userRole !== "admin";

            if (isAdminOnly) return null;

            return (
              <div key={item.name} className="sidebar-item-wrapper">
                <button
                  className="sidebar-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasSubmenu) {
                      openSubmenu(e, item);
                    } else {
                      navigate(item.path);
                      closeSubmenu();
                    }
                  }}
                >
                  <span style={{ fontSize: "1.3rem", marginRight: "6px" }}>
                    {item.name.slice(0, 2)}
                  </span>
                  {item.name.slice(2).trim()}
                </button>
              </div>
            );
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

      {/* Logout Button */}
      <button onClick={() => navigate("/logout")} className="logout-button">
        🚪 Logout
      </button>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header
          className="header"
          style={{
            display: "flex",
            alignItems: "center",
            paddingRight: "110px",
            gap: "20px",
          }}
        >
          <h1 className="header-title" style={{ flexGrow: 1 }}>
            🏠 Hotel Management Dashboard
          </h1>

          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={exportToExcel} className="action-button">
              <FaIcons.FaFileExcel style={{ marginRight: "5px" }} />
              Export to Excel
            </button>
            <button onClick={printContent} className="action-button">
              <FaIcons.FaPrint style={{ marginRight: "5px" }} />
              Print
            </button>
          </div>
        </header>

        {/* LICENSE ALERT BANNER */}
        {licenseInfo &&
          licenseInfo.days_left !== null &&
          licenseInfo.days_left <= 7 && (
            <div
              style={{
                background:
                  licenseInfo.valid === false || licenseInfo.days_left <= 0
                    ? "#dc2626"
                    : "#f59e0b",
                color: "white",
                padding: "10px",
                borderRadius: "8px",
                marginBottom: "10px",
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              {licenseInfo.valid === false || licenseInfo.days_left <= 0
                ? "❌ License expired"
                : licenseInfo.message}
              <span style={{ marginLeft: "10px" }}>
                ({licenseInfo.days_left} day(s) left)
              </span>
            </div>
          )}

        <section className="content-area">
          <div className="background-overlay">
            <h1 className="watermark">{businessName}</h1>
          </div>

          <div className="content-inner">
            <Outlet />
          </div>
        </section>
      </main>

      {/* 🔥 PORTAL SUBMENU */}
      {submenu.visible &&
        createPortal(
          <div
            className="submenu"
            style={{
              position: "fixed",
              top: submenu.position.top,
              left: submenu.position.left,
              zIndex: 999999,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {submenu.items.map((sub) => (
              <button
                key={sub.path}
                className="submenu-item"
                onClick={() => {
                  navigate(sub.path);
                  closeSubmenu();
                }}
              >
                {sub.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};

export default DashboardPage;