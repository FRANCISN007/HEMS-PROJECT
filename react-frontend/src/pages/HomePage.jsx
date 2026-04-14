import React from "react";
import { useNavigate } from "react-router-dom";
import backgroundImage from "../assets/images/hotel-bg.jpg";
import "./HomePage.css";

import { HOTEL_NAME } from "../config/constants";

const HomePage = () => {
  const navigate = useNavigate();

  // ✅ SIMPLE FLOW (like Shopman)
  const handleProceed = () => {
    navigate("/login", { replace: true });
  };

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Audiowide&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&display=swap"
        rel="stylesheet"
      />

      <div
        className="home-container"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Hotel Name */}
        <div className="hotel-name-banner">{HOTEL_NAME}</div>

        {/* Main Content */}
        <div className="home-card">
          <h1 className="heading-line1">Welcome to</h1>

          <div className="hems-text">
            <span className="hems-letter">H</span>
            <span className="hems-letter">E</span>
            <span className="hems-letter">M</span>
            <span className="hems-letter">S</span>
          </div>

          <h2 className="heading-line2">
            Hotel &amp; Event Management System
          </h2>

          <button
            className="proceed-button"
            onClick={handleProceed}
          >
            Proceed &gt;&gt;
          </button>
        </div>

        <footer className="home-footer">
          <div>Produced & Licensed by School of Accounting Package</div>
          <div>© 2025</div>
        </footer>
      </div>
    </>
  );
};

export default HomePage;
