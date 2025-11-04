import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import heartImg from "../components/heart.jpg";

export default function Login({ onLogin, onSwitchToRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      onLogin(userCredential.user);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSendReset = async (e) => {
    e.preventDefault();
    setResetError("");
    setResetMessage("");
    try {
      const emailToSend = resetEmail || email;
      if (!emailToSend) {
        setResetError("Please enter your email to reset password.");
        return;
      }
      await sendPasswordResetEmail(auth, emailToSend);
      setResetMessage("Password reset email sent. Check your inbox.");
      setResetError("");
    } catch (err) {
      setResetError(err.message || "Failed to send reset email.");
      setResetMessage("");
    }
  };

  return (
    <div className="relative w-screen h-screen flex items-center justify-center">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-left"
        style={{ backgroundImage: `url(${heartImg})` }}
      ></div>
      <div className="absolute inset-0 bg-black/50"></div>

      {/* Card */}
      <div className="relative bg-white shadow-2xl rounded-3xl flex w-full max-w-4xl h-[600px]">
        {/* Left - Login Form */}
        <div className="w-1/2 flex flex-col justify-center p-10">
          <div className="mb-8">
            <h1 className="text-4xl font-extrabold text-indigo-700 font-serif">
              AFib Early Predictor & Detector
            </h1>
            <p className="text-lg text-gray-600 mt-2">Welcome Back 👋</p>
          </div>

          {/* Login form OR Password reset form */}
          {!resetMode ? (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    className="w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      // eye-off icon
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-7 1.02-2.2 2.8-4.03 4.9-5.18" />
                        <path d="M1 1l22 22" />
                      </svg>
                    ) : (
                      // eye icon
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  type="submit"
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Login
                </button>
              </form>

              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={() => setResetMode(true)}
                  className="text-sm text-blue-600 hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
                <p className="text-sm text-gray-500 mt-1">
                  Don’t have an account? {" "}
                  <button
                    onClick={onSwitchToRegister}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Register here
                  </button>
                </p>

            </>
          ) : (
            <form onSubmit={handleSendReset} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                className="w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                value={resetEmail || email}
                onChange={(e) => setResetEmail(e.target.value)}
              />
              {resetError && <p className="text-red-500 text-sm">{resetError}</p>}
              {resetMessage && <p className="text-green-600 text-sm">{resetMessage}</p>}
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Send Reset Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(false);
                    setResetError("");
                    setResetMessage("");
                  }}
                  className="w-1/2 py-2 border rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
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
