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
import StoreDashboardPage from "./components/store/StoreDashboardPage";
import BarDashboardPage from "./components/bar/BarDashboardPage";
import RestDashboardPage from "./components/restaurant/RestDashboardPage";

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
import ViewEventForm from "./components/events/ViewEventForm";
import EventUpdate from "./components/events/EventUpdate";
import ViewEventPayment from "./components/events/ViewEventPayment";

import ListVendor from "./components/store/ListVendor";
import ListCategory from "./components/store/ListCategory";
import ListItem from "./components/store/ListItem";
import CreatePurchase from "./components/store/CreatePurchase";
import ListPurchase from "./components/store/ListPurchase";
import IssueItems from "./components/store/IssueItems";
import ListIssues from "./components/store/ListIssues";
import StockAdjustment from "./components/store/StockAdjustment";
import ListAdjustment from "./components/store/ListAdjustment";
import StockBalance from "./components/store/StockBalance";
import BarBalanceStock from "./components/store/BarBalanceStock";



import ListBar from "./components/bar/ListBar";
import BarStockBalance from "./components/bar/BarStockBalance";

import StoreToBarControl from "./components/bar/StoreToBarControl";
import BarStockAdjustment from "./components/bar/BarStockAdjustment";

import ListBarAdjustment from "./components/bar/ListBarAdjustment";
import BarSalesCreate from "./components/bar/BarSalesCreate";
import ListBarSales from "./components/bar/ListBarSales";
import BarPaymentCreate from "./components/bar/BarPaymentCreate";
import ListBarPayment from "./components/bar/ListBarPayment";


import RestaurantLocation from "./components/restaurant/RestaurantLocation";
import MealCategory from "./components/restaurant/MealCategory";
import MealCreate from "./components/restaurant/MealCreate";

import GuestOrderCreate from "./components/restaurant/GuestOrderCreate";
import ListGuestOrder from "./components/restaurant/ListGuestOrder";
import OrderToSales from "./components/restaurant/OrderToSales";
import ListRestaurantSales from "./components/restaurant/ListRestaurantSales";


console.log("✅ API BASE:", process.env.REACT_APP_API_BASE_URL);

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

        {/* ✅ Fullscreen Store route */}
        <Route path="/store" element={<StoreDashboardPage />}>
          <Route path="vendor/list" element={<ListVendor />} />
          <Route path="category/list" element={<ListCategory />} />
          <Route path="items/list" element={<ListItem />} />
          <Route path="purchase/create" element={<CreatePurchase />} />
          <Route path="purchase/list" element={<ListPurchase />} />
          <Route path="issue/create" element={<IssueItems />} />
          <Route path="issue/list" element={<ListIssues />} />
          <Route path="adjustment/create" element={<StockAdjustment />} />
          <Route path="adjustment/list" element={<ListAdjustment />} />
          <Route path="stock-balance" element={<StockBalance />} />
          <Route path="barstock-balance" element={<BarBalanceStock />} />
        </Route>



        {/* ✅ Bar routes (match Store style: base /bar + relative children) */}
        <Route path="/bar" element={<BarDashboardPage />}>
          <Route path="list" element={<ListBar />} />
          <Route path="stock-balance" element={<BarStockBalance />} />
          <Route path="/bar/store-issues" element={<StoreToBarControl />} />
          <Route path="/bar/adjustment/create" element={<BarStockAdjustment />} />
          <Route path="/bar/adjustment/list" element={<ListBarAdjustment />} />
          <Route path="/bar/sales/create" element={<BarSalesCreate />} />
          <Route path="/bar/sales/list" element={<ListBarSales />} />
          <Route path="/bar/payment/create" element={<BarPaymentCreate />} />
          <Route path="/bar/payment/list" element={<ListBarPayment />} />
        </Route>

        
        {/* Restaurant dashboard */}
        <Route path="/restaurant" element={<RestDashboardPage />}>
          <Route path="location" element={<RestaurantLocation />} />
          <Route path="MealCategory" element={<MealCategory />} />
          <Route path="MealCreate" element={<MealCreate />} />
          <Route path="GuestOrderCreate" element={<GuestOrderCreate />} />
          <Route path="ListGuestOrder" element={<ListGuestOrder />} />
          <Route path="OrderToSales" element={<OrderToSales />} />
          <Route path="ListRestaurantSales" element={<ListRestaurantSales />} />
          
        </Route>

      

        {/* Main dashboard (protected) */}
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

          {/* Payments */}
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

          {/* Reservation alerts */}
          <Route path="reservation-alert" element={<ReservationAlert />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
