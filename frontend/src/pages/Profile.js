// src/pages/Profile.js
import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export default function Profile({ onNavigate }) {
  const [userData, setUserData] = useState(null);

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const docRef = doc(db, "users", user.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setUserData(snap.data());
      }
    };
    fetchUserData();
  }, []);

  if (!userData) return <p className="text-gray-500 text-center mt-10">Loading...</p>;

  const joined = userData.createdAt?.toDate
    ? userData.createdAt.toDate().toLocaleDateString()
    : "—";

  return (
    <div 
    className="flex justify-center mt-10"
    style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      <div className="bg-white shadow-2xl rounded-3xl overflow-hidden w-full max-w-2xl">
        {/* Header Banner */}
        <div className="h-40 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-400 relative">
          <div className="absolute inset-0 opacity-60"></div>

          {/* Profile Picture (UI Avatar only) */}
          <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
            <img
              src={`https://ui-avatars.com/api/?name=${userData.username}&background=0D8ABC&color=fff`}
              alt="Profile"
              className="w-32 h-32 rounded-full border-4 border-white object-cover shadow-lg"
            />
          </div>
        </div>

        {/* Body */}
        <div className="pt-20 pb-8 px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">{userData.username}</h2>
          <p className="text-gray-500 text-sm mb-4">{userData.email}</p>

          {/* Stats Section */}
          <div className="flex justify-center space-x-8 text-gray-700 mb-6">
            <div>
              <p className="text-lg font-semibold">{userData.age}</p>
              <p className="text-xs text-gray-500">Age</p>
            </div>
            <div>
              <p className="text-lg font-semibold capitalize">{userData.gender}</p>
              <p className="text-xs text-gray-500">Gender</p>
            </div>
            <div>
              <p className="text-lg font-semibold">{joined}</p>
              <p className="text-xs text-gray-500">Joined</p>
            </div>
          </div>

          {/* Edit Profile Button */}
        <div className="mt-8">
        <button
            onClick={() => onNavigate("editProfile")} 
            className="border-2 border-blue-500 text-blue-600 px-8 py-2 rounded-full font-semibold shadow-sm hover:bg-blue-500 hover:text-white hover:scale-105 transform transition-all duration-300"
        >
            Edit Profile
        </button>
        </div>
        </div>
      </div>
    </div>
  );
}
