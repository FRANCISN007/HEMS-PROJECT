// src/App.js

import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";


import HomePage from "./pages/HomePage";
import LicensePage from "./modules/license/LicensePage";
import LoginPage from "./modules/auth/LoginPage";
import RegisterPage from "./modules/auth/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import RoomsPage from "./pages/RoomsPage";
import BookingsPage from "./pages/BookingsPage";

import CreateBooking from "./components/bookings/CreateBooking";
import ListBooking from "./components/bookings/ListBooking";
import CheckoutGuest from "./components/bookings/CheckoutGuest";
import CancelBooking from "./components/bookings/CancelBooking";
import CreatePayment from "./components/payments/CreatePayment";
import PaymentOutstandingList from "./components/payments/PaymentOutstandingList";
import ListPayment from "./components/payments/ListPayment";
import VoidPayment from "./components/payments/VoidPayment";
import ReservationAlert from "./components/bookings/ReservationAlert";
import RoomStatusBoard from "./pages/RoomStatusBoard";
import CreateEvent from "./components/events/CreateEvent";
import ListEvent from "./components/events/ListEvent";
import EventPayment from "./components/events/EventPayment";
import ListEventPayment from "./components/events/ListEventPayment";
import VoidEventPayment from "./components/events/VoidEventPayment";
import ViewEventForm from "./components/events/ViewEventForm"; // ✅ add this
import EventUpdate from "./components/events/EventUpdate";
import ViewEventPayment from "./components/events/ViewEventPayment";

console.log("✅ API BASE:", process.env.REACT_APP_API_BASE_URL);


// import SearchPayment from "./components/payments/SearchPayment";
// import VoidPayment from "./components/payments/VoidPayment";

const App = () => {
  const [isLicenseVerified, setIsLicenseVerified] = useState(false);

  useEffect(() => {
    const licenseVerified = localStorage.getItem("license_verified") === "true";
    setIsLicenseVerified(licenseVerified);
  }, []);

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route
          path="/license"
          element={<LicensePage setIsLicenseVerified={setIsLicenseVerified} />}
        />
        <Route
          path="/login"
          element={
            isLicenseVerified ? <LoginPage /> : <Navigate to="/license" replace />
          }
        />
        <Route
          path="/register"
          element={
            isLicenseVerified ? <RegisterPage /> : <Navigate to="/license" replace />
          }
        />

        {/* Protected dashboard routes */}
        <Route
          path="/dashboard"
          element={
            isLicenseVerified ? <DashboardPage /> : <Navigate to="/license" replace />
          }
        >
          <Route path="users" element={<UsersPage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="rooms/status" element={<RoomStatusBoard />} />

          

          {/* Bookings */}
          <Route path="bookings" element={<BookingsPage />}>
            <Route index element={<ListBooking />} />
            <Route path="create" element={<CreateBooking />} />
            <Route path="list" element={<ListBooking />} />
            <Route path="checkout" element={<CheckoutGuest />} />
            <Route path="cancel" element={<CancelBooking />} />
          </Route>

          {/* ✅ Payments - now correctly placed */}
          <Route path="payments">
            <Route path="create" element={<PaymentOutstandingList />} />
            <Route path="create/:booking_id" element={<CreatePayment />} />
            <Route path="list" element={<ListPayment />} />
            <Route path="void" element={<VoidPayment />} />
          </Route>


          {/* Events */}
          <Route path="events">
            <Route index element={<ListEvent />} />
            <Route path="create" element={<CreateEvent />} />
            <Route path="list" element={<ListEvent />} />
            <Route path="payment" element={<EventPayment />} />
            <Route path="payments/list" element={<ListEventPayment />} />
            <Route path="payments/void" element={<VoidEventPayment />} />
            <Route path="view" element={<ViewEventForm />} />
            <Route path="update" element={<EventUpdate />} />
            <Route path="view/:id" element={<ViewEventPayment />} />
            

          </Route>







          {/* ✅ Add this line below to link the Reservation Alert */}
            <Route path="reservation-alert" element={<ReservationAlert />} />


        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
