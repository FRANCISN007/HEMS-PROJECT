export const openViewForm = (booking) => {
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};

  // ✅ Dynamic business name
  const businessName = storedUser.business?.name || "HEMS Hotel";

  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    alert("Popup blocked. Please allow popups for this site.");
    return;
  }

  const content = `
    <html>
      <head>
        <title>Guest Booking Form</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            font-size: 15px;
            margin: 10px;
            color: #000;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          .hotel-name {
            font-size: 22px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .form-title {
            font-size: 18px;
            margin-bottom: 10px;
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
        </style>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </head>
      <body>
        <div class="header">
          <div class="hotel-name">${businessName}</div>
          <div class="form-title">Guest Booking Form</div>
        </div>

        <div class="grid">
          <div><span class="label">Booking ID:</span> ${booking.id}</div>
          <div><span class="label">Room No:</span> ${booking.room_number}</div>
          <div><span class="label">Guest Name:</span> ${booking.guest_name}</div>
          <div><span class="label">Gender:</span> ${booking.gender}</div>
          <div><span class="label">Booking Cost:</span> ₦${booking.booking_cost}</div>
          <div><span class="label">Arrival:</span> ${booking.arrival_date}</div>
          <div><span class="label">Departure:</span> ${booking.departure_date}</div>
          <div><span class="label">Status:</span> ${booking.status}</div>
          <div><span class="label">No of Days:</span> ${booking.number_of_days}</div>
          <div><span class="label">Booking Type:</span> ${booking.booking_type}</div>
          <div><span class="label">Phone Number:</span> ${booking.phone_number}</div>
          <div><span class="label">Booking Date:</span> ${booking.booking_date}</div>
          <div><span class="label">Payment Status:</span> ${booking.payment_status}</div>
          <div><span class="label">ID Mode:</span> ${booking.mode_of_identification}</div>
          <div><span class="label">ID Number:</span> ${booking.identification_number}</div>
          <div><span class="label">Address:</span> ${booking.address}</div>
          <div><span class="label">Vehicle No:</span> ${booking.vehicle_no}</div>
          <div><span class="label">Created By:</span> ${booking.created_by}</div>
        </div>

        <div class="footer">
          <b>Guest Acknowledgement and Agreement</b><br/><br/>
          I, _____________________________________, hereby acknowledge that I have carefully read, understood, and agreed to abide by the rules and directives outlined below. 
          I understand that failure to comply with any of the stated rules may result in penalties, fines, or eviction from the hotel premises without refund. 
          I accept full responsibility for any violations and understand that I will be held liable as specified herein.<br/><br/>

          <b>RULES AND DIRECTIVES</b><br/>
          X No smoking of any kind or intake of hard drugs in the room or toilet. Fine is N__________.<br/>
          X Guests are not allowed to bring in food and drinks from outside into the hotel premises.<br/>
          X Smoking of cigarette is only allowed outside.<br/>
          X All guests are to drop their keycards whenever they are leaving the hotel premises.<br/>
          X Misplacement of room keycard attracts a fine of N__________ for immediate replacement.<br/>
          X Destroying or staining towels, bedsheets, or rugs in the room or any area in the hotel will attract immediate replacement.<br/><br/>

          <b>NOTE:</b> Guests that go contrary to the above stated rules and directives will be evicted without refund.<br/><br/>

          <table style="width: 100%; margin-top: 30px;">
            <tr>
              <td>Guest Signature ________________________</td>
              <td>Receptionist Signature ____________________</td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(content);
  printWindow.document.close();
};
