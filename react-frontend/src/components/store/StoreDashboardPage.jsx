import React, { useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { FaFileExcel, FaPrint } from "react-icons/fa";
import StorePhoto from "../../assets/images/StorePhoto.png";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import "./StoreDashboardPage.css";


const StoreDashboardPage = () => {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState("");
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showCreateVendor, setShowCreateVendor] = useState(false);

  const exportToExcel = async () => {
    const table = document.querySelector(".content-area table");
    if (!table) return alert("No table found to export.");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Store Data");

    const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
      th.innerText.trim()
    );
    const colCount = headers.length;

    sheet.mergeCells(1, 1, 1, colCount);
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
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `store_report.xlsx`);
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
    {
      name: "📂 Create Category",
      path: "category/list", // 👈 Directly links to List Category
    },

    {
      name: "📦 Manage Items",
      path: "items/list", // ✅ Goes directly to the list
    },
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

    {
      name: "📊 Store Stock",
      path: "stock-balance",
    },
    

    {
      name: "📊 Bar Stock",
      path: "barstock-balance",
    },


    {
      name: "👨‍🍳 Kitchen Stock",
      path: "kitchenstock",
    },

    {
      name: "🏭 Manage Vendor",
      path: "vendor/list", // 👉 direct navigation
    },

  // ✅ New Main Dashboard Button
  {
    name: "🏠 Main Dashboard",
    path: "/dashboard", // navigate back to hotel dashboard
    customClass: "main-dashboard-btn", // 👈 custom class
  },
];

  return (
    <div className="dashboard-container">
      <aside className="sidebars1">
        <h2 className="sidebar-title">STORE MENU</h2>
        <nav className="sidebars1-menu">
          {storeMenu.map((item) => (
            <div
              key={item.name}
              className="sidebar-item-wrapper"
              onMouseEnter={() => setHovered(item.name)}
              onMouseLeave={() => setHovered("")}
            >
              {/* Main Button */}
              <button
                className={`sidebars1-button ${hovered === item.name ? "active" : ""} ${item.customClass || ""}`}
                onClick={() => {
                  if (!item.submenu && item.path) {
                    navigate(item.path);
                  }
                }}
              >
                {item.name}
              </button>

              {/* Submenu */}
              {item.submenu && hovered === item.name && (
                <div className="submenu">
                  {item.submenu.map((sub) => (
                    <button
                      key={sub.label}
                      className="submenu-item"
                      onClick={() => {
                        if (sub.path) navigate(sub.path);
                        if (sub.action) sub.action();
                        setHovered("");
                      }}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="header" style={{ gap: "20px" }}>
          <h1 className="header-title" style={{ flexGrow: 1 }}>
            🏪 Store Management Dashboard
          </h1>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={exportToExcel} className="action-button1">
              <FaFileExcel style={{ marginRight: "5px" }} />
              Export to Excel
            </button>
            <button onClick={printContent} className="action-button1">
              <FaPrint style={{ marginRight: "5px" }} />
              Print
            </button>
            <button onClick={() => navigate("/logout")} className="logout-button1">
              🚪 Logout
            </button>
          </div>
        </header>

        <section
          className="content-area"
          style={{
            position: "relative",
            minHeight: "100%",
            backgroundImage:
              location.pathname === "/store" ? `url(${StorePhoto})` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {showCreateCategory ? (
            <CreateCategory onClose={() => setShowCreateCategory(false)} />
          ) : showCreateVendor ? (
            <CreateVendor onClose={() => setShowCreateVendor(false)} />
          ) : (
            <Outlet />
          )}
        </section>
      </main>
    </div>
  );
};

export default StoreDashboardPage;
