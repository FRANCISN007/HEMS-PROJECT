// src/App.js

import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import HomePage from "./pages/HomePage";
import LoginPage from "./modules/auth/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import RoomsPage from "./pages/RoomsPage";
import BookingsPage from "./pages/BookingsPage";
import StoreDashboardPage from "./components/store/StoreDashboardPage";
import BarDashboardPage from "./components/bar/BarDashboardPage";
import RestDashboardPage from "./components/restaurant/RestDashboardPage";

/* ================= BOOKINGS ================= */
import CreateBooking from "./components/bookings/CreateBooking";
import ListBooking from "./components/bookings/ListBooking";
import CheckoutGuest from "./components/bookings/CheckoutGuest";
import CancelBooking from "./components/bookings/CancelBooking";
import SummaryReport from "./components/bookings/SummaryReport";

/* ================= PAYMENTS ================= */
import CreateBank from "./components/payments/CreateBank";
import CreatePayment from "./components/payments/CreatePayment";
import PaymentOutstandingList from "./components/payments/PaymentOutstandingList";
import ListPayment from "./components/payments/ListPayment";
import VoidPayment from "./components/payments/VoidPayment";

/* ================= OTHER ================= */
import ReservationAlert from "./components/bookings/ReservationAlert";
import RoomStatusBoard from "./pages/RoomStatusBoard";

/* ================= EVENTS ================= */
import CreateEvent from "./components/events/CreateEvent";
import ListEvent from "./components/events/ListEvent";
import EventPayment from "./components/events/EventPayment";
import ListEventPayment from "./components/events/ListEventPayment";
import VoidEventPayment from "./components/events/VoidEventPayment";
import ViewEventForm from "./components/events/ViewEventForm";
import EventUpdate from "./components/events/EventUpdate";
import ViewEventPayment from "./components/events/ViewEventPayment";

/* ================= STORE ================= */
import ListVendor from "./components/store/ListVendor";
import ListCategory from "./components/store/ListCategory";
import ListItem from "./components/store/ListItem";
import CreatePurchase from "./components/store/CreatePurchase";
import ListPurchase from "./components/store/ListPurchase";
import IssueItems from "./components/store/IssueItems";
import ListIssues from "./components/store/ListIssues";
import CreateKitchen from "./components/store/CreateKitchen";
import StockAdjustment from "./components/store/StockAdjustment";
import ListAdjustment from "./components/store/ListAdjustment";
import StockBalance from "./components/store/StockBalance";
import BarBalanceStock from "./components/store/BarBalanceStock";
import KitchenBalanceStock from "./components/store/KitchenBalanceStock";
import KitchenStockAdjust from "./components/store/KitchenStockAdjust";
import KitchenAdjustmentList from "./components/store/KitchenAdjustmentList";
import IssuesToKitchen from "./components/store/IssuesToKitchen";
import KitchenIssueList from "./components/store/KitchenIssueList";

/* ================= BAR ================= */
import ListBar from "./components/bar/ListBar";
import BarStockBalance from "./components/bar/BarStockBalance";
import StoreToBarControl from "./components/bar/StoreToBarControl";
import BarStockAdjustment from "./components/bar/BarStockAdjustment";
import ListBarAdjustment from "./components/bar/ListBarAdjustment";
import BarSalesCreate from "./components/bar/BarSalesCreate";
import ListBarSales from "./components/bar/ListBarSales";
import BarPaymentCreate from "./components/bar/BarPaymentCreate";
import ListBarPayment from "./components/bar/ListBarPayment";
import BarSalesSummary from "./components/bar/BarSalesSummary";

/* ================= RESTAURANT ================= */
import RestaurantLocation from "./components/restaurant/RestaurantLocation";
import MealCategory from "./components/restaurant/MealCategory";
import MealCreate from "./components/restaurant/MealCreate";
import GuestOrderCreate from "./components/restaurant/GuestOrderCreate";
import ListGuestOrder from "./components/restaurant/ListGuestOrder";
import OrderToSales from "./components/restaurant/OrderToSales";
import ListRestaurantSales from "./components/restaurant/ListRestaurantSales";
import RestaurantPayment from "./components/restaurant/RestaurantPayment";
import ListRestaurantPayment from "./components/restaurant/ListRestaurantPayment";
import KitchenStock from "./components/restaurant/KitchenStock";
import SalesSummary from "./components/restaurant/SalesSummary";

console.log("✅ API BASE:", process.env.REACT_APP_API_BASE_URL);

const App = () => {
  return (
    <Router>
      <Routes>

        {/* ================= PUBLIC ================= */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* ================= STORE ================= */}
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
          <Route path="kitchenstock" element={<KitchenBalanceStock />} />
          <Route path="kitchen/create" element={<CreateKitchen />} />
          <Route path="kitchenadjustment/create" element={<KitchenStockAdjust />} />
          <Route path="kitchenadjustment/list" element={<KitchenAdjustmentList />} />
          <Route path="kitchen/lssue" element={<IssuesToKitchen />} />
          <Route path="kitchenissue/list" element={<KitchenIssueList />} />
        </Route>

        {/* ================= BAR ================= */}
        <Route path="/bar" element={<BarDashboardPage />}>
          <Route path="list" element={<ListBar />} />
          <Route path="stock-balance" element={<BarStockBalance />} />
          <Route path="store-issues" element={<StoreToBarControl />} />
          <Route path="adjustment/create" element={<BarStockAdjustment />} />
          <Route path="adjustment/list" element={<ListBarAdjustment />} />
          <Route path="sales/create" element={<BarSalesCreate />} />
          <Route path="sales/list" element={<ListBarSales />} />
          
          <Route path="/bar/sales/SalesSummary" element={<BarSalesSummary />} />

          <Route path="payment/create" element={<BarPaymentCreate />} />
          <Route path="payment/list" element={<ListBarPayment />} />
        </Route>

        {/* ================= RESTAURANT ================= */}
        <Route path="/restaurant" element={<RestDashboardPage />}>
          <Route path="location" element={<RestaurantLocation />} />
          <Route path="MealCategory" element={<MealCategory />} />
          <Route path="MealCreate" element={<MealCreate />} />
          <Route path="GuestOrderCreate" element={<GuestOrderCreate />} />
          <Route path="ListGuestOrder" element={<ListGuestOrder />} />
          <Route path="OrderToSales" element={<OrderToSales />} />
          <Route path="ListRestaurantSales" element={<ListRestaurantSales />} />
          <Route path="RestaurantPayment" element={<RestaurantPayment />} />
          <Route path="ListRestaurantPayment" element={<ListRestaurantPayment />} />
          <Route path="kitchenstock" element={<KitchenStock />} />
          <Route path="SalesSummary" element={<SalesSummary />} />
        </Route>

        {/* ================= DASHBOARD ================= */}
        <Route path="/dashboard" element={<DashboardPage />}>
          <Route path="users" element={<UsersPage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="rooms/status" element={<RoomStatusBoard />} />

          {/* BOOKINGS */}
          <Route path="bookings" element={<BookingsPage />}>
            <Route index element={<ListBooking />} />
            <Route path="create" element={<CreateBooking />} />
            <Route path="list" element={<ListBooking />} />
            <Route path="checkout" element={<CheckoutGuest />} />
            <Route path="cancel" element={<CancelBooking />} />
            <Route path="summary" element={<SummaryReport />} />
          </Route>

          {/* PAYMENTS */}
          <Route path="payments">
            <Route path="create" element={<PaymentOutstandingList />} />
            <Route path="create/:booking_id" element={<CreatePayment />} />
            <Route path="list" element={<ListPayment />} />
            <Route path="void" element={<VoidPayment />} />
            <Route path="bankcreate" element={<CreateBank />} />
          </Route>

          {/* EVENTS */}
          <Route path="events">
            <Route index element={<ListEvent />} />
            <Route path="create" element={<CreateEvent />} />
            <Route path="list" element={<ListEvent />} />
            <Route path="payment" element={<EventPayment />} />
            <Route path="payments/list" element={<ListEventPayment />} />
            <Route path="payments/void" element={<VoidEventPayment />} />
            <Route path="view" element={<ViewEventForm />} />
            <Route path="update" element={<EventUpdate />} />
            <Route path="payments/view/:id" element={<ViewEventPayment />} />
          </Route>

          {/* ALERT */}
          <Route path="reservation-alert" element={<ReservationAlert />} />
        </Route>

        {/* ================= FALLBACK ================= */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Router>
  );
};

export default App;
