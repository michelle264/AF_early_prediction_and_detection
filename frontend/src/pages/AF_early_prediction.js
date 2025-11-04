import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

export default function UploadAnalysis({ user }) {
  const [metadataFile, setMetadataFile] = useState(null);
  const [recordsZip, setRecordsZip] = useState(null);
  const [risk, setRisk] = useState(null);
  const [probability, setProbability] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (risk === "High") {
      new Notification("⚠️ High AFib Risk Detected!", {
        body: "Probability of danger is high. Please consult a clinician immediately.",
      });
      setShowModal(true);
    }
  }, [risk]);

  const handleMetadataChange = (e) => {
    const file = e.target.files[0];
    if (file && file.name.toLowerCase().endsWith(".csv")) {
      setMetadataFile(file);
    } else {
      alert("Please upload a valid metadata.csv file!");
      setMetadataFile(null);
    }
  };

  const handleRecordsZipChange = (e) => {
    const file = e.target.files[0];
    if (file && file.name.toLowerCase().endsWith(".zip")) {
      setRecordsZip(file);
    } else {
      alert("Please upload a valid records ZIP file!");
      setRecordsZip(null);
    }
  };

  const handleAnalyze = async () => {
    if (!metadataFile || !recordsZip) {
      alert("Please select both metadata.csv and record ZIP file!");
      return;
    }

    setLoading(true);
    setRisk(null);
    setProbability(null);

    const formData = new FormData();
    formData.append("metadata_file", metadataFile);
    formData.append("records_zip", recordsZip);

    try {
      const response = await fetch("http://localhost:8000/predict/", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("API error");
      const data = await response.json();

        // Try several common names for record id array returned by backend
        const rid = data.record_ids || data.recordIds || data.record_id || data.recordId || null;
        // If backend returns an array, take the first element; otherwise use the value directly
        setRecordId(Array.isArray(rid) ? (rid.length > 0 ? rid[0] : null) : rid || null);

      const meanProb =
        data.prob_danger && data.prob_danger.length > 0
          ? data.prob_danger.reduce((a, b) => a + b, 0) /
            data.prob_danger.length
          : null;

      setProbability(meanProb !== null ? Math.round(meanProb * 100) : null);

      if (meanProb !== null) {
        if (meanProb > 0.52) setRisk("High");
        else if (meanProb >= 0.45) setRisk("Moderate");
        else setRisk("Low");
      }
    } catch (err) {
      console.error("Error analyzing file:", err);
      alert("Failed to analyze file. Check backend and file format.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!metadataFile || !recordsZip || !risk || probability === null) {
      return alert("Please complete all steps before saving!");
    }

    const record = {
      date: new Date().toLocaleString(),
      // Use the fields the Dashboard expects
      fileName: metadataFile.name,
      metadataFileName: metadataFile.name,
      recordsZipName: recordsZip.name,
      type: "prediction",
  // include backend primary record id when available
  record_id: typeof recordId === "undefined" ? null : recordId,
      risk,
      probability,
      // Prefer auth.currentUser.uid to avoid undefined userId; fallback to prop
      userId: auth?.currentUser?.uid || user?.uid || null,
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, "records"), record);
      alert("✅ Record saved successfully!");
      setMetadataFile(null);
      setRecordsZip(null);
      setRisk(null);
      setProbability(null);
    } catch (err) {
      console.error("Error saving record: ", err);
      alert("❌ Failed to save record. Check console for details.");
    }
  };

  return (
    <div className="flex items-center justify-center py-10 px-6">
      <div className="bg-white shadow-2xl rounded-3xl p-10 w-full max-w-5xl transition-all">
        <h2 className="text-2xl font-bold mb-8 text-center text-gray-800">
          AFib Early Prediction
        </h2>

        {/* Instruction Box */}
        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700 leading-relaxed">
          <p className="font-semibold mb-1">📘 Input Instructions</p>
          <p>
          <strong>metadata.csv</strong> — Must include columns: <code>patient_id</code>, <code>patient_sex</code>, <code>patient_age</code>, <code>record_id</code>, <code>record_date</code>, <code>record_start_time</code>, <code>record_end_time</code>, <code>record_timedelta</code>, <code>record_files</code>, <code>record_seconds</code>, <code>record_samples</code>.
        </p>
          <p><strong>records.zip</strong> — Contains:</p>
          <ul className="list-disc pl-6 mt-1 space-y-1">
            <li><code>record_*_rr_*.h5</code>: RR interval data (HDF5 format, automatic QRS annotations by Microport Syneview)</li>
            <li><code>record_*_rr_labels_*.csv</code>: RR interval annotations (<code>start_file_index</code>, <code>start_rr_index</code>, <code>end_file_index</code>, <code>end_rr_index</code>)</li>
          </ul>
          <p className="mt-1">The <code>*</code> corresponds to the same record ID as in <code>metadata.csv</code> (e.g. <code>record_000_rr_labels_000.h5</code>).</p>
        </div>

          {/* Upload */}
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1 mt-4">
                Upload Files
              </p>
              <div className="bg-gray-50 p-4 rounded-lg shadow-inner">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  metadata.csv
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleMetadataChange}
                  className="block w-full text-gray-700 text-sm mb-3"
                />

                <label className="block text-sm font-medium text-gray-600 mb-1">
                  records.zip
                </label>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleRecordsZipChange}
                  className="block w-full text-gray-700 text-sm"
                />
              </div>
            </div>

            {/*Analyze */}
          <div className="flex justify-center">
            <button
              onClick={handleAnalyze}
              className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-md transition"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin h-5 w-5 mr-2 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    ></path>
                  </svg>
                  Loading...
                </span>
              ) : (
                "Submit"
              )}
            </button>
          </div>

          {/* Result */}
          {risk && !loading && (
            <div className="bg-gray-50 rounded-xl shadow-lg p-6 mt-6 transition-all duration-500 ease-in-out transform scale-105">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Result</h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                    risk === "High"
                      ? "bg-red-100 text-red-600"
                      : risk === "Moderate"
                      ? "bg-yellow-100 text-yellow-600"
                      : "bg-green-100 text-green-600"
                  }`}
                >
                  {risk}
                </span>
              </div>

              <div className="bg-white p-4 rounded-lg shadow flex flex-col items-center justify-center">
                <p className="text-sm text-gray-500 mb-1">
                  Probability of Danger
                </p>
                <p
                  className={`text-3xl font-bold ${
                    risk === "High"
                      ? "text-red-600"
                      : risk === "Moderate"
                      ? "text-yellow-600"
                      : "text-green-600"
                  }`}
                >
                  {probability}%
                </p>
              </div>

              <p className="text-gray-700 mt-4 text-center">
                {risk === "High"
                  ? "⚠️ Probability of danger is high. Please consult a clinician immediately."
                  : risk === "Moderate"
                  ? "Slightly elevated risk. Consider regular monitoring or consulting a doctor if symptoms appear."
                  : "Normal risk detected. Keep maintaining a healthy lifestyle."}
              </p>

              <div className="flex justify-center">
                <button
                  onClick={handleSave}
                  className="px-5 py-2 mt-5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-md transition"
                >
                  Save Record
                </button>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-gray-500 mt-6 text-center">
            Disclaimer: This tool provides an indicative risk estimate based on RR
            variability features and is not a medical device. Consult a clinician for
            diagnosis.
          </p>
        </div>
      </div>

      {/* Modal for High Risk */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              ⚠️ High AFib Risk Detected!
            </h2>
            <p className="text-gray-700 mb-6">
              Probability of danger is high. Please consult a clinician immediately.
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
