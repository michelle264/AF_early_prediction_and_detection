import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import heartImg from "../components/heart.jpg";

export default function Register({ onRegister, onSwitchToLogin }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

const handleRegister = async (e) => {
  e.preventDefault();
  // basic validation
  if (!username || username.trim().length < 2) {
    setError("Please enter a display name (at least 2 characters).");
    return;
  }
  const ageNum = parseInt(age, 10);
  if (!age || Number.isNaN(ageNum) || ageNum <= 0 || ageNum > 120) {
    setError("Please enter a valid age.");
    return;
  }
  if (password !== confirmPassword) {
    setError("Passwords do not match");
    return;
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // set displayName
    try {
      await updateProfile(userCredential.user, { displayName: username });
    } catch (updErr) {
      console.warn("Failed to update profile displayName:", updErr);
    }
    // create Firestore user document
    try {
      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: email,
        username: username,
        age: ageNum,
        createdAt: serverTimestamp(),
      });
    } catch (dbErr) {
      console.warn("Failed to create user doc:", dbErr);
    }
    onRegister(userCredential.user);
  } catch (err) {
    // Firebase error handling
    console.log("Registration error:", err);
    if (err.code === "auth/email-already-in-use") {
      setError("This email is already registered. Please login instead.");
    } else if (err.code === "auth/invalid-email") {
      setError("Invalid email address.");
    } else if (err.code === "auth/weak-password") {
      setError("Password is too weak. Please use at least 6 characters.");
    } else {
      setError(err.message);
    }
  }
};


  return (
    <div className="relative w-screen h-screen flex items-center justify-center">
      {/* Full background with overlay */}
      <div
        className="absolute inset-0 bg-cover bg-left"
        style={{ backgroundImage: `url(${heartImg})` }}
      ></div>
      <div className="absolute inset-0 bg-black/50"></div>

      {/* Card */}
      <div className="relative bg-white shadow-2xl rounded-3xl flex w-full max-w-4xl h-[600px]">
        {/* Left - Register Form */}
        <div className="w-1/2 flex flex-col justify-center p-10">
          <div className="mb-8">
            <h1 className="text-4xl font-extrabold text-indigo-700 font-serif">
              AFib Early Predictor & Detector
            </h1>
            <p className="text-lg text-gray-600 mt-2">Create Your Account ✨</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <input
              type="text"
              placeholder="Display name"
              className="w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="number"
              placeholder="Age"
              min={1}
              max={120}
              className="w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
            <input
              type="email"
              placeholder="Email"
              className="w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              type="password"
              placeholder="Confirm Password"
              className="w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              Register
            </button>
          </form>

          {/* Link to login */}
          <p className="text-sm text-gray-500 mt-4">
            Already have an account?{" "}
            <button
              onClick={onSwitchToLogin}
              className="text-blue-600 hover:underline font-medium"
            >
              Login here
            </button>
          </p>
        </div>

        {/* Right - Heart image */}
        <div
          className="w-1/2 h-full bg-cover rounded-r-3xl"
          style={{ backgroundImage: `url(${heartImg})`, backgroundPosition: "85% center" }}
        ></div>
      </div>
    </div>
  );
}
