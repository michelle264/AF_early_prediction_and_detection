import { useEffect, useState } from "react";
import {
  FaChartBar,
  FaUpload,
  FaHeartbeat,
  FaSignOutAlt,
  FaUserCircle,
} from "react-icons/fa";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";

export default function Sidebar({ onNavigate, activePage, onLogout }) {
  const [username, setUsername] = useState("");
  const [photoURL, setPhotoURL] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUsername(data.username || "User");
          setPhotoURL(data.photoURL || null);
        } else {
          setUsername(user.displayName || "User");
        }
      },
      (error) => {
        console.error("Error fetching user data:", error);
      }
    );

    // Cleanup listener when component unmounts
    return () => unsubscribe();
  }, []);

  return (
    <div className="w-64 bg-gray-800 text-white flex flex-col overflow-y-auto font-[Poppins]">
      <div className="flex flex-col items-center text-center p-6 border-b border-gray-700 bg-gray-900">
        {photoURL ? (
          <img
            src={photoURL}
            alt="Profile"
            className="w-16 h-16 rounded-full border-2 border-blue-400 object-cover mb-2 shadow-md"
          />
        ) : (
          <FaUserCircle className="text-blue-400 w-16 h-16 mb-2" />
        )}

        <h2
          className="text-lg font-semibold"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          Hello {username}!
        </h2>

        <button
          onClick={() => onNavigate("profile")}
          className="border-2 border-blue-500 text-blue-600 text-sm px-4 py-1.5 mt-2 rounded-full font-medium shadow-sm hover:bg-blue-500 hover:text-white hover:scale-105 transform transition-all duration-300"
        >
          View Profile
        </button>
      </div>

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
          <span>Early AF Prediction</span>
        </button>

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

      {/* Logout */}
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
