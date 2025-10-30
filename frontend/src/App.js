import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, addDoc, query, where, onSnapshot } from "firebase/firestore";

import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/UploadAnalysis";
import Login from "./pages/Login";
import Register from "./pages/Register";
import './App.css';

function App() {
  const [page, setPage] = useState("login"); // "login" | "dashboard" | "upload"
  const [records, setRecords] = useState([]);
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        setPage("dashboard");

        // Listen to user's records in real-time
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

  // Upload record and save to Firestore
  // const handleUpload = async (record) => {
  //   try {
  //     const docRef = await addDoc(collection(db, "records"), {
  //       ...record,
  //       userId: auth.currentUser.uid,
  //       createdAt: new Date(),
  //     });

  //     // Optimistic update
  //     setRecords([...records, { id: docRef.id, ...record }]);
  //     setPage("dashboard");
  //   } catch (err) {
  //     console.error("Error saving record:", err);
  //     alert("Failed to save record!");
  //   }
  // };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setRecords([]);
    setPage("login");
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Register Page */}
      {showRegister ? (
        <Register
          onRegister={() => setShowRegister(false)} // after register, go back to login
          onSwitchToLogin={() => setShowRegister(false)} // manual switch
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
          <Sidebar
            onNavigate={setPage}
            activePage={page}
            onLogout={handleLogout}
          />
          <div className="flex-1 p-6">
            {page === "dashboard" && (
              <Dashboard records={records} />
            )}
            {page === "upload" && <Upload user={user}/>}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
