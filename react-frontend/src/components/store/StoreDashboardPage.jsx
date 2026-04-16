import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, Outlet } from "react-router-dom";
import { FaFileExcel, FaPrint } from "react-icons/fa";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import "./StoreDashboardPage.css";

const StoreDashboardPage = () => {
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  const businessName = storedUser.business?.name || "HEMS Hotel";

  const navigate = useNavigate();

  // 🔥 submenu state (portal-based)
  const [submenu, setSubmenu] = useState({
    items: [],
    position: null,
    visible: false,
  });

  const exportToExcel = async () => {
    const table = document.querySelector(".content-area table");
    if (!table) return alert("No table found to export.");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Store Data");

    const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
      th.innerText.trim()
    );

    sheet.mergeCells(1, 1, 1, headers.length);

    const titleCell = sheet.getCell("A1");
    titleCell.value = "Store Report";
    titleCell.font = { size: 14, bold: true };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };

    sheet.addRow(headers).font = { bold: true };

    const rows = Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((td) => td.innerText.trim())
    );

    rows.forEach((row) => sheet.addRow(row));

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

    sheet.columns.forEach((col) => {
      let maxLength = 10;
      col.eachCell({ includeEmpty: true }, (cell) => {
        const val = cell.value ? cell.value.toString() : "";
        maxLength = Math.max(maxLength, val.length);
      });
      col.width = maxLength + 2;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, "store_report.xlsx");
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

  const storeMenu = [
    { name: "📂 Create Category", path: "category/list" },
    { name: "📦 Manage Items", path: "items/list" },

    {
      name: "🛒 Purchase",
      submenu: [
        { label: "➕ New Purchase", path: "purchase/create" },
        { label: "📃 List Purchase", path: "purchase/list" },
      ],
    },

    {
      name: "🍶 Manage Bar",
      submenu: [
        { label: "📤 Issue to Bar", path: "issue/create" },
        { label: "📃 List Items", path: "issue/list" },
      ],
    },

    {
      name: "👨‍🍳 Manage Kitchen",
      submenu: [
        { label: "➕ Create Kitchen", path: "kitchen/create" },
        { label: "📃 Issue to Kitchen", path: "kitchen/lssue" },
        { label: "📃 List Issue", path: "kitchenissue/list" },
        { label: "🔧 Adjust Stock", path: "kitchenadjustment/create" },
        { label: "🔧 List Adjustment", path: "kitchenadjustment/list" },
      ],
    },

    {
      name: "⚖️ Stock Adjustment",
      submenu: [
        { label: "🔧 Adjust Stock", path: "adjustment/create" },
        { label: "🔧 List Adjustment", path: "adjustment/list" },
      ],
    },

    { name: "📊 Store Stock", path: "stock-balance" },
    { name: "📊 Bar Stock", path: "barstock-balance" },
    { name: "👨‍🍳 Kitchen Stock", path: "kitchenstock" },
    { name: "🏭 Manage Vendor", path: "vendor/list" },

    {
      name: "🏠 Main Dashboard",
      path: "/dashboard",
      customClass: "main-dashboard-btn",
    },
  ];

  // 🔥 open submenu with position
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

  return (
    <div className="dashboard-container" onClick={closeSubmenu}>
      {/* SIDEBAR */}
      <aside className="sidebars1">
        <h2 className="sidebar-title">STORE MENU</h2>

        <nav>
          {storeMenu.map((item) => (
            <div key={item.name} className="sidebar-item-wrapper">
              <button
                className={`sidebars1-button ${item.customClass || ""}`}
                onClick={(e) => {
                  e.stopPropagation();

                  if (item.submenu) {
                    openSubmenu(e, item);
                  } else if (item.path) {
                    navigate(item.path);
                    closeSubmenu();
                  }
                }}
              >
                {item.name}
              </button>
            </div>
          ))}
        </nav>
      </aside>

      {/* MAIN */}
      <main className="main-content">
        <header className="header">
          <h1 className="header-title">🏪 Store Management Dashboard</h1>

          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={exportToExcel} className="action-button1">
              <FaFileExcel /> Export
            </button>

            <button onClick={printContent} className="action-button1">
              <FaPrint /> Print
            </button>

            <button
              onClick={() => navigate("/logout")}
              className="logout-button1"
            >
              🚪 Logout
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
                key={sub.label}
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

export default StoreDashboardPage;
