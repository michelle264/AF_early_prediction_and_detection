import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { StatusModal } from "../components/Utils";

export default function EditProfile({ onNavigate }) {
  const [form, setForm] = useState({ username: "", age: "", gender: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ open: false, type: "success", message: "" });

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setForm({
          username: data.username || "",
          age: data.age || "",
          gender: data.gender || "",
        });
      }
      setLoading(false);
    };
    fetchUserData();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const user = auth.currentUser;
      await updateDoc(doc(db, "users", user.uid), form);

      setModal({
        open: true,
        type: "success",
        message: "Profile updated successfully!",
      });

    } catch (err) {
      console.error(err);
      setModal({
        open: true,
        type: "error",
        message: "Failed to update profile.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <p className="text-center text-gray-500 mt-10 text-sm">Loading profile...</p>;

  return (
    <div
      className="flex justify-center "
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      <div className="bg-white p-8 shadow-2xl rounded-3xl w-full max-w-lg border border-blue-100">
        <h2 className="text-2xl font-semibold text-center text-blue-600 mb-6">
          Edit Profile
        </h2>

        {/* Form Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">
              Username
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 focus:border-blue-500 px-3 py-2 rounded-lg outline-none text-gray-700 text-sm transition-all duration-300"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="Enter your display name"
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">
              Age
            </label>
            <input
              type="number"
              min="1"
              max="120"
              className="w-full border border-gray-300 focus:border-blue-500 px-3 py-2 rounded-lg outline-none text-gray-700 text-sm transition-all duration-300"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              placeholder="Enter your age"
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">
              Gender
            </label>
            <select
              className="w-full border border-gray-300 focus:border-blue-500 px-3 py-2 rounded-lg outline-none text-gray-700 text-sm transition-all duration-300"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>

            </select>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-8 flex justify-between">
          <button
            onClick={() => onNavigate("profile")}
            className="border-2 border-gray-400 text-gray-600 text-sm px-5 py-1.5 rounded-full font-medium hover:bg-gray-100 hover:scale-105 transform transition-all duration-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="border-2 border-blue-500 text-blue-500 text-sm px-6 py-1.5 rounded-full font-medium hover:bg-blue-500 hover:text-white hover:scale-105 transform transition-all duration-300"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
      <StatusModal
        open={modal.open}
        type={modal.type}
        title={modal.type === "error" ? "Error" : "Success"}
        message={modal.message}
        onClose={() => {
          setModal({ ...modal, open: false });

          if (modal.type === "success") {
            onNavigate("profile");
          }
        }}
      />
    </div>
  );
}
