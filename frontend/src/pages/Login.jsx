import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import heartImg from "../components/heart.jpg";

export default function Login({ onLogin, onSwitchToRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      onLogin(userCredential.user);
    } catch (err) {
      setError(err.message);
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
              AFib Early Predictor
            </h1>
            <p className="text-lg text-gray-600 mt-2">Welcome Back 👋</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
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
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Login
            </button>
          </form>

          {/* Link to register */}
          <p className="text-sm text-gray-500 mt-4">
            Don’t have an account?{" "}
            <button
              onClick={onSwitchToRegister}
              className="text-blue-600 hover:underline font-medium"
            >
              Register here
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
