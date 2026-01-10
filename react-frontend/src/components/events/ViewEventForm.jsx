import React from "react";
import { useLocation, useNavigate } from "react-router-dom";


import getBaseUrl from "../../api/config";
const API_BASE_URL = getBaseUrl();


const ViewEventForm = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const event = location.state?.event;

  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  let roles = [];

  if (Array.isArray(storedUser.roles)) {
    roles = storedUser.roles;
  } else if (typeof storedUser.role === "string") {
    roles = [storedUser.role];
  }

  roles = roles.map((r) => r.toLowerCase());


  if (!(roles.includes("admin") || roles.includes("event"))) {
  return (
    <div className="unauthorized">
      <h2>🚫 Access Denied</h2>
      <p>You do not have permission to view event form.</p>
    </div>
  );
}


  const handlePrint = () => {
    if (!event) {
      alert("No event data provided.");
      navigate("/dashboard/events/list");
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");

    if (!printWindow) {
      alert("Popup blocked. Please allow popups for this site.");
      return;
    }

    const content = `
      <html>
        <head>
          <title>Event Form</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              font-size: 15px;
              margin: 30px;
              color: #000;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px 16px;
              margin-bottom: 30px;
            }
            .label {
              font-weight: bold;
              display: inline-block;
              width: 150px;
            }
            .footer {
              font-size: 14px;
              line-height: 1.7;
            }
            .actions {
              text-align: center;
              margin-top: 40px;
            }
            .actions button {
              padding: 10px 20px;
              margin: 0 10px;
              font-size: 14px;
              cursor: pointer;
            }
            @media print {
              .actions {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Event Booking Form</h2>
          </div>
          <div class="grid">
            <div><span class="label">Event ID:</span> ${event.id}</div>
            <div><span class="label">Event Name:</span> ${event.title}</div>
            <div><span class="label">Organiser:</span> ${event.organizer}</div>
            <div><span class="label">Phone:</span> ${event.phone_number}</div>
            <div><span class="label">Start:</span> ${event.start_datetime}</div>
            <div><span class="label">End:</span> ${event.end_datetime}</div>
            <div><span class="label">Event Amount:</span> ₦${Number(event.event_amount || 0).toLocaleString()}</div>
            <div><span class="label">Caution Fee:</span> ₦${Number(event.caution_fee || 0).toLocaleString()}</div>
            <div><span class="label">Status:</span> ${event.payment_status}</div>
            <div><span class="label">Address:</span> ${event.address}</div>
            <div><span class="label">Created by:</span> ${event.created_by}</div>
          </div>

          <div class="footer">
            <b>Event Directives / Rules</b><br/><br/>
            Please ensure all the following are adhered to strictly by the organiser and guests:<br/><br/>

            <b>RULES</b><br/>
            - Full payment must be made <strong>before the event date</strong>.<br/>
            - <strong>No smoking or use of hard drugs</strong> is allowed on premises.<br/>
            - All equipment brought for the event <strong>must be removed after the event</strong>.<br/>
            - Noise must be kept <strong>within approved levels</strong> at all times.<br/>
            - Any damage to property will result in <strong>charges to the organiser</strong>.<br/>
            - Staying above the stiputed time of the Event <strong>attracts extra cost</strong>.<br/>
            - Caution fees are refunded after proper check <strong>that all Event facilities are in good condition</strong>.<br/><br/>
            <b>NOTE:</b> Failure to comply with the above may result in fines, cancellation of the event, or denial of future bookings.<br/><br/>

            <table style="width: 100%; margin-top: 30px;">
              <tr>
                <td>Organiser Signature ________________________</td>
                <td>Event Manager Signature ____________________</td>
              </tr>
            </table>
          </div>

          <div class="actions">
            <button onclick="window.print()">🖨️ Print</button>
            <button onclick="alert('You can manually close this window when done.')">✖ Cancel</button>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();

    // Watch when print window closes, then return
    const checkClosed = setInterval(() => {
      if (printWindow.closed) {
        clearInterval(checkClosed);
        navigate("/dashboard/events/list");
      }
    }, 500);
  };

  if (!event) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>No event data provided.</p>
        <button onClick={() => navigate("/dashboard/events/list")}>Go Back</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>Ready to Print Event Booking Form</h2>
      <button onClick={handlePrint} style={{ padding: "10px 20px", fontSize: "16px" }}>
        🖨️ Print Event Form
      </button>
    </div>
  );
};

export default ViewEventForm;
