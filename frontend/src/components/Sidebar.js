// src/components/Sidebar.js
import { FaChartBar, FaUpload, FaHeartbeat, FaSignOutAlt } from "react-icons/fa";

export default function Sidebar({ onNavigate, activePage, onLogout }) {
  return (
    <div className="w-64 bg-gray-800 text-white flex flex-col">
      {/* Header */}
      <h1 className="flex items-center text-2xl font-bold p-4 border-b border-gray-700">
        <span className="logo mr-3 text-blue-400">AF</span>
        <p className="text-lg">AF Early Prediction & Detection</p>
      </h1>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        <button
          onClick={() => onNavigate("dashboard")}
          className={`flex items-center space-x-2 w-full text-left px-3 py-2 rounded-lg ${
            activePage === "dashboard"
              ? "bg-gray-600 text-blue-400"
              : "hover:bg-gray-700"
          }`}
        >
          <FaChartBar size={18} />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => onNavigate("prediction")}
          className={`flex items-center space-x-2 w-full text-left px-3 py-2 rounded-lg ${
            activePage === "prediction"
              ? "bg-gray-600 text-blue-400"
              : "hover:bg-gray-700"
          }`}
        >
          <FaUpload size={18} />
          <span>AF Early Prediction</span>
        </button>

        {/* ✅ New AF Detection Button */}
        <button
          onClick={() => onNavigate("detection")}
          className={`flex items-center space-x-2 w-full text-left px-3 py-2 rounded-lg ${
            activePage === "detection"
              ? "bg-gray-600 text-blue-400"
              : "hover:bg-gray-700"
          }`}
        >
          <FaHeartbeat size={18} />
          <span>AF Detection</span>
        </button>
      </nav>

      {/* Logout Button */}
      <div className="p-4 mt-auto border-t border-gray-700">
        <button
          onClick={onLogout}
          className="flex items-center space-x-2 w-full text-left px-3 py-2 rounded-lg hover:bg-red-600"
        >
          <FaSignOutAlt size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
