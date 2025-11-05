import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";

import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/AF_early_prediction";
import AFDetection from "./pages/AF_detection";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Login from "./pages/Login";
import Register from "./pages/Register";

function App() {
  const [page, setPage] = useState("login");
  const [records, setRecords] = useState([]);
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setPage("dashboard");

        const q = query(
          collection(db, "records"),
          where("userId", "==", currentUser.uid)
        );
        const unsubscribeRecords = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setRecords(data);
        });

        return () => unsubscribeRecords();
      } else {
        setPage("login");
        setRecords([]);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setRecords([]);
    setPage("login");
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Auth pages */}
      {showRegister ? (
        <Register
          onRegister={() => setShowRegister(false)}
          onSwitchToLogin={() => setShowRegister(false)}
        />
      ) : page === "login" ? (
        <Login
          onLogin={(loggedInUser) => {
            setUser(loggedInUser);
            setPage("dashboard");
          }}
          onSwitchToRegister={() => setShowRegister(true)}
        />
      ) : (
        <>
          {/* ✅ Sidebar gets onNavigate */}
          <Sidebar
            onNavigate={setPage}
            activePage={page}
            onLogout={handleLogout}
          />

          <div className="flex-1 p-6">
            {page === "dashboard" && <Dashboard records={records} />}
            {page === "prediction" && <Upload user={user} />}
            {page === "detection" && <AFDetection user={user} />}
            {page === "profile" && <Profile onNavigate={setPage} />}
            {page === "editProfile" && <EditProfile onNavigate={setPage} />}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
