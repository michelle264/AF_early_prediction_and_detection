import { useState } from "react";
import { auth } from "../firebase";
import { sendEmailVerification } from "firebase/auth";

export default function VerifyEmail({ onBackToLogin, onCheckVerified }) {
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    const resend = async () => {
        setMsg("");
        setErr("");
        try {
            if (!auth.currentUser) return;
            await sendEmailVerification(auth.currentUser);
            setMsg("Verification email sent. Please check your inbox/spam.");
        } catch (e) {
            setErr(e.message || "Failed to resend verification email.");
        }
    };

    const handleVerifiedClick = async () => {
        setErr("");
        setMsg("");
        try {
            if (!auth.currentUser) {
                setErr("Session expired. Please login again.");
                return;
            }

            await auth.currentUser.reload();

            if (auth.currentUser.emailVerified) {
                onCheckVerified();
            } else {
                setErr("Email not yet verified. Please check your inbox and click the verification link.");
            }
        } catch (e) {
            setErr("Failed to verify status. Please try again.");
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-6">
            <div className="max-w-xl w-full bg-white rounded-2xl shadow p-6">
                <h1 className="text-2xl font-bold mb-2">Verify your email</h1>
                <p className="text-gray-700 mb-4">
                    We sent a verification link to{" "}
                    <span className="font-semibold">{auth.currentUser?.email}</span>.
                    Please click the link to activate your account.
                </p>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={resend}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                        Resend email
                    </button>

                    <button
                        onClick={handleVerifiedClick}
                        className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
                    >
                        I verified, continue
                    </button>

                    <button
                        onClick={onBackToLogin}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
                    >
                        Sign out & verify later
                    </button>
                </div>

                {msg && <p className="mt-4 text-green-700">{msg}</p>}
                {err && <p className="mt-4 text-red-600">{err}</p>}
            </div>
        </div>
    );
}
