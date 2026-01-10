// src/pages/UsersPage.jsx
import React from "react";
import UserManagement from "../modules/users/UserManagement";

const UsersPage = () => {
  const token = localStorage.getItem("token"); // ✅ Correct if stored as "token"


  if (!token) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="p-6 text-red-600 text-lg font-semibold">
          Unauthorized. Please log in.
        </div>
      </div>
    );
  }

  
  return (
    <div className="max-w-6xl mx-auto mt-10 px-4">
      <UserManagement token={token} />
    </div>
  );
};

export default UsersPage;

