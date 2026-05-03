import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
//import { FaFileExcel, FaPrint } from "react-icons/fa";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import "./BarDashboardPage.css";

const BarDashboardPage = () => {
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  const businessName = storedUser.business?.name || "HEMS Hotel";

  const navigate = useNavigate();
  const location = useLocation();

  const [submenu, setSubmenu] = useState({
    items: [],
    position: null,
    visible: false,
  });

  const barMenu = [
    { name: "🍾 Bar Outlet", path: "/bar/list" },
    {
      name: "🛍️ Bar Sales",
      submenu: [
        { label: "➕ Create Sales", path: "/bar/sales/create" },
        { label: "📃 List Sales", path: "/bar/sales/list" },
        { label: "📊 Sales Summary", path: "/bar/sales/SalesSummary" },
      ],
    },
    {
      name: "💳 Bar Payment",
      submenu: [
        { label: "➕ Create Payment", path: "/bar/payment/create" },
        { label: "📃 List Payment", path: "/bar/payment/list" },
      ],
    },
    { name: "📊 Stock Balance", path: "/bar/stock-balance" },
    {
      name: "🛠️ Stock Adjustment",
      submenu: [
        { label: "🔧 Adjust Stock", path: "/bar/adjustment/create" },
        { label: "📃 List Adjustment", path: "/bar/adjustment/list" },
      ],
    },
    { name: "🏪 Store Issues", path: "/bar/store-issues" },
  ];

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

  const exportToExcel = async () => {
    const table = document.querySelector(".content-area table");
    if (!table) return alert("No table found to export.");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Bar Data");

    const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
      th.innerText.trim()
    );

    sheet.mergeCells(1, 1, 1, headers.length);

    const titleCell = sheet.getCell("A1");
    titleCell.value = "Bar Report";

    sheet.addRow(headers).font = { bold: true };

    const rows = Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((td) => td.innerText.trim())
    );

    rows.forEach((row) => sheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, "bar_report.xlsx");
  };

  const printContent = () => {
    const content = document.querySelector(".content-area");
    if (!content) return;

    const printWindow = window.open("", "_blank");
    printWindow.document.write("<html><body>");
    printWindow.document.write(content.innerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="dashboard-container" onClick={closeSubmenu}>
      <aside className="sidebars1">
        <h2 className="sidebar-title">BAR MENU</h2>

        {barMenu.map((item) => (
          <div key={item.name} className="sidebar-item-wrapper">
            <button
              className="sidebars1-button"
              onClick={(e) => {
                e.stopPropagation();

                if (item.submenu) {
                  openSubmenu(e, item);
                } else {
                  navigate(item.path);
                  closeSubmenu();
                }
              }}
            >
              {item.name}
            </button>
          </div>
        ))}

        <button
          className="sidebars1-button main-dashboard-btn"
          onClick={() => navigate("/dashboard")}
        >
          🏠 Main Dashboard
        </button>
      </aside>

      <main className="main-content">
        <header className="header">
          <h1 className="header-title">🍷 Bar Management Dashboard</h1>

          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={exportToExcel} className="action-button1">
              Export
            </button>

            <button onClick={printContent} className="action-button1">
              Print
            </button>

            <button onClick={() => navigate("/logout")} className="logout-button1">
              Logout
            </button>
          </div>
        </header>

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

export default BarDashboardPage;
