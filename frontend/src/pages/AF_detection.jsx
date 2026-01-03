import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import {
  RRFeaturesCard,
  RRSummaryBlock,
  interpretRRFeatures,
  LoadingModal,
  GenerateReportButton,
  StatusModal
} from "../components/Utils";


export default function AFDetection({ user }) {
  const [recordsZip, setRecordsZip] = useState(null);
  const [decision, setDecision] = useState(null);
  const [probabilities, setProbabilities] = useState([]);
  const [recordId, setRecordId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [rrFeatures, setRrFeatures] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const steps = [
    "Extracting RR intervals…",
    "Segmenting heartbeat windows…",
    "Applying phase-space reconstruction…",
    "Running Neural ODE model…",
    "Computing AF probability…",
  ];
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setStepIndex((prev) => (prev + 1) % steps.length);
      }, 1800);
      return () => clearInterval(interval);
    }
  }, [loading]);

  useEffect(() => {
    if (decision === "Yes") {
      new Notification("⚠️ AF Detected", {
        body: "AF detected in uploaded records.",
      });
    }
  }, [decision]);

  const handleRecordsZipChange = (e) => {
    const file = e.target.files[0];
    if (file && file.name.toLowerCase().endsWith(".zip")) {
      setRecordsZip(file);
    } else {
      setErrorMsg("Please upload a valid records ZIP file!");
      setRecordsZip(null);
    }
  };

  const handleDetect = async () => {
    if (!recordsZip) {
      setErrorMsg("Please select record ZIP file!");
      return;
    }

    setLoading(true);
    setDecision(null);
    setProbabilities([]);

    const formData = new FormData();
    formData.append("records_zip", recordsZip);

    try {
      const response = await fetch("http://localhost:8000/detect/", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("API error");
      const data = await response.json();

      if (data.rr_features) {
        const rid = Object.keys(data.rr_features)[0];
        setRecordId(rid);
        setRrFeatures(data.rr_features[rid]);
      }

      const probs = data.prob_af || [];
      setProbabilities(probs.map((p) => Math.round(p * 100)));

      const ridRaw =
        data.record_ids ||
        data.recordIds ||
        data.record_id ||
        data.recordId ||
        null;

      const rid = Array.isArray(ridRaw)
        ? ridRaw.length > 0
          ? ridRaw[0]
          : null
        : ridRaw || null;
      setRecordId(rid);

      const anyHigh = probs.some((p) => p >= 0.65);
      setDecision(anyHigh ? "Yes" : "No");
      if (anyHigh) setShowModal(true);
    } catch (err) {
      console.error("Error detecting AF:", err);
      setErrorMsg("Failed to detect AF. Please check file format and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!recordsZip || !decision) {
      return setErrorMsg("Please complete detection before saving!");
    }

    const meanPercent = probabilities.length
      ? Math.round(
        probabilities.reduce((a, b) => a + b, 0) / probabilities.length
      )
      : null;

    const record = {
      date: new Date().toLocaleString(),
      recordsZipName: recordsZip.name,
      fileName: recordsZip.name,
      record_id: typeof recordId === "undefined" ? null : recordId,
      type: "detection",
      probability: meanPercent,
      af_detected: decision === "Yes",
      probabilities: probabilities,
      userId: auth?.currentUser?.uid || user?.uid || null,
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, "records"), record);
      setSuccessMsg("Record saved successfully!");
    } catch (err) {
      console.error("Error saving detection: ", err);
      setErrorMsg("❌ Failed to save detection. Check console for details.");
    }
  };

  const handleGenerateReport = async () => {
    if (!recordId || !decision || !rrFeatures) {
      return setErrorMsg("You must run detection before generating a report.");
    }

    const payload = {
      record_id: recordId,
      task_type: "af_detection",
      decision,
      prob_af: Math.round(probabilities.reduce((a, b) => a + b, 0) / probabilities.length),
      rr_features: rrFeatures,
      timestamp: new Date().toLocaleString()
    };

    try {
      const response = await fetch("http://localhost:8000/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to generate report");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `AF_Report_${recordId}.pdf`;
      a.click();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setErrorMsg("Error generating report.");
    }
  };

  const { probText, meanRRText, hrText } =
    rrFeatures ? interpretRRFeatures(rrFeatures, probabilities, "af_detection") : {};

  return (
    <div className="flex items-center justify-center py-10 px-6">
      <div className="bg-white shadow-2xl rounded-3xl p-10 w-full max-w-5xl transition-all">
        <h2 className="text-2xl font-bold mb-8 text-center text-gray-800">AF Detection</h2>

        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700 leading-relaxed">
          <p className="font-semibold mb-1">📘 Input Instructions</p>
          <p><strong>record.zip</strong> — Contains:</p>
          <ul className="list-disc pl-6 mt-1 space-y-1">
            <li>
              <code>record_{`{record_id}`}_rr_{`{index}`}.h5</code>:
              RR interval data (HDF5 format, automatic QRS annotations by Microport Syneview)
            </li>
            <li>
              <code>record_{`{record_id}`}_rr_labels.csv</code>:
              RR interval annotations
              (<code>start_file_index</code>, <code>start_rr_index</code>,
              <code>end_file_index</code>, <code>end_rr_index</code>)
            </li>
          </ul>
          <p className="mt-1 text-sm text-gray-600">
            <code>{`{index}`}</code> is a zero-based file index:
            <code>00</code> for the first RR file, <code>01</code> for the second, and so on.
          </p>
        </div>

        <div className="space-y-4 mt-4">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1 mt-4">
              Upload Files
            </p>
            <div className="bg-gray-50 p-4 rounded-lg shadow-inner">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                record.zip
              </label>
              <input
                type="file"
                accept=".zip"
                onChange={handleRecordsZipChange}
                className="block w-full text-gray-700 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleDetect}
              disabled={loading}
              className={`mt-4 px-6 py-2 text-white text-sm font-medium rounded-lg shadow-md transition ${loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                }`}
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


          {decision && !loading && (
            <div className="bg-gray-50 rounded-xl shadow-lg p-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">AF Detected?</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${decision === "Yes" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                  {decision}
                </span>
              </div>

              <div className="bg-white p-4 rounded-lg shadow flex flex-col items-center justify-center">
                <p className="text-sm text-gray-500 mb-1">Decision</p>
                <p
                  className={`text-3xl font-bold ${decision === "Yes" ? "text-red-600" : "text-green-600"
                    }`}
                >
                  {decision}
                </p>
              </div>
              {probabilities.length > 0 && (
                <div
                  className={`mt-5 px-5 py-3 rounded-lg w-full max-w-md mx-auto text-center ${decision === "Yes" ? "bg-red-50" : "bg-green-50"
                    }`}
                >
                  <p
                    className={`font-semibold text-base ${decision === "Yes" ? "text-red-700" : "text-green-700"
                      }`}
                  >
                    Your estimated probability of AF is{" "}
                    <span className="text-2xl font-bold">
                      {Math.round(
                        probabilities.reduce((a, b) => a + b, 0) / probabilities.length
                      )}
                      % !!
                    </span>
                  </p>

                  <p
                    className={`mt-1 font-semibold ${decision === "Yes" ? "text-red-700" : "text-green-700"
                      }`}
                  >
                    {decision === "Yes"
                      ? "AF is present in your uploaded records."
                      : "No AF detected in your uploaded records."}
                  </p>
                </div>
              )}

              <RRFeaturesCard rr={rrFeatures} />
              <div className="w-full mt-4">
                <RRSummaryBlock
                  probText={probText}
                  meanRRText={meanRRText}
                  hrText={hrText}
                />
              </div>
              {rrFeatures && <GenerateReportButton onGenerate={handleGenerateReport} />}

              <div className="flex justify-center">
                <button onClick={handleSave} className="px-5 py-2 mt-5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow-md transition">Save Record</button>
              </div>
            </div>
          )}
          {/* Disclaimer */}
          <p className="text-xs text-gray-500 mt-6 text-center">
            Disclaimer: This tool provides an indicative risk estimate based on RR interval patterns and a deep learning model. It is not a medical device. Please consult a clinician for any diagnosis or treatment decisions.
          </p>
        </div>

      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center transform transition-all scale-100 hover:scale-105">
            <h2 className="text-2xl font-bold text-red-600 mb-4">⚠️ AF Detected!</h2>
            <p className="text-gray-700 mb-4">
              Your uploaded records indicate a high probability of Atrial Fibrillation (AF).
            </p>
            <p className="text-lg font-semibold text-red-700 mb-6">
              Probability of AF:{" "}
              {Math.round(
                probabilities.reduce((a, b) => a + b, 0) / probabilities.length
              )}
              %
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
      <StatusModal
        open={!!errorMsg}
        type="error"
        title="Error"
        message={errorMsg}
        onClose={() => setErrorMsg("")}
      />

      <StatusModal
        open={!!successMsg}
        type="success"
        title="Success"
        message={successMsg}
        onClose={() => setSuccessMsg("")}
      />
      <LoadingModal
        visible={loading}
        steps={steps}
        stepIndex={stepIndex}
        onClose={() => setLoading(false)}
      />
    </div>
  );
}

