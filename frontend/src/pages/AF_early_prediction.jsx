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

export default function UploadAnalysis({ user }) {
  const [recordsZip, setRecordsZip] = useState(null);
  const [risk, setRisk] = useState(null);
  const [probability, setProbability] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rrFeatures, setRrFeatures] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const steps = [
    "Extracting RR intervals…",
    "Segmenting heartbeat windows…",
    "Applying phase-space reconstruction…",
    "Running Neural ODE model…",
    "Finalizing risk score…",
  ];
  const [stepIndex, setStepIndex] = useState(0);

  // Rotate steps
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setStepIndex((prev) => (prev + 1) % steps.length);
      }, 1800);
      return () => clearInterval(interval);
    }
  }, [loading]);

  useEffect(() => {
    if (risk === "Risky") {
      new Notification("⚠️ High AFib Risk Detected!", {
        body: "Probability of danger is high. Please consult a clinician immediately.",
      });
      setShowModal(true);
    }
  }, [risk]);

  const handleRecordsZipChange = (e) => {
    const file = e.target.files[0];
    if (file && file.name.toLowerCase().endsWith(".zip")) {
      setRecordsZip(file);
      setErrorMsg("");
    } else {
      setErrorMsg("Please upload a valid records ZIP file!");
      setRecordsZip(null);
    }
  };

  const handleAnalyze = async () => {
    if (!recordsZip) {
      setErrorMsg("Please select a record ZIP file!");
      return;
    }
    setLoading(true);
    setRisk(null);
    setProbability(null);
    setRecordId(null);
    setRrFeatures(null);

    const formData = new FormData();
    formData.append("records_zip", recordsZip);

    try {
      const response = await fetch("http://localhost:8000/predict/", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("API error");

      const data = await response.json();

      const rid = data.record_id?.[0] || null;
      if (rid) {
        setRecordId(rid);
        if (data.rr_features && data.rr_features[rid]) {
          setRrFeatures(data.rr_features[rid]);
        }
      }

      let p75 = null;
      if (Array.isArray(data.prob_danger) && data.prob_danger.length > 0) {
        const sorted = [...data.prob_danger].sort((a, b) => a - b);
        const idx = Math.floor(0.75 * (sorted.length - 1));
        p75 = sorted[idx];
      }

      if (p75 !== null) {
        const probPercent = Math.round(p75 * 100);
        setProbability(probPercent);

        if (p75 >= 0.53) setRisk("Risky");
        else setRisk("Safe");
      } else {
        setProbability(null);
        setRisk(null);
      }
    } catch (err) {
      console.error("Error analyzing file:", err);
      setErrorMsg("Prediction failed. Please check file format and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!recordsZip || !risk || probability === null) {
      setErrorMsg("Please complete all steps before saving!");
      return;
    }

    const record = {
      date: new Date().toLocaleString(),
      recordsZipName: recordsZip.name,
      type: "prediction",
      record_id: typeof recordId === "undefined" ? null : recordId,
      risk,
      probability,
      userId: auth?.currentUser?.uid || user?.uid || null,
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, "records"), record);
      setSuccessMsg("Record saved successfully!");
    } catch (err) {
      console.error("Error saving record: ", err);
      setErrorMsg("❌ Failed to save record. Check console for details.");
    }
  };


  const handleGenerateReport = async () => {
    if (!recordId || !risk || !rrFeatures) {
      setErrorMsg("You must run detection before generating a report.");
      return;
    }

    const payload = {
      record_id: recordId,
      task_type: "early_prediction",
      decision: risk,
      prob_af: probability,
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
      a.download = `Early_AF_Report_${recordId}.pdf`;
      a.click();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setErrorMsg("Error generating report.");
    }
  };

  const { probText, meanRRText, hrText } =
    rrFeatures ? interpretRRFeatures(rrFeatures, probability, "early_prediction") : {};

  return (
    <div className="flex items-center justify-center py-10 px-6">
      <div className="bg-white shadow-2xl rounded-3xl p-10 w-full max-w-5xl transition-all">
        <h2 className="text-2xl font-bold mb-8 text-center text-gray-800">
          Early AF Prediction
        </h2>

        {/* Instruction Box */}
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

          {/* Upload */}
          <div className="space-y-4">
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

            {/*Analyze */}
            <div className="flex justify-center">
              <button
                onClick={handleAnalyze}
                className="mt-4 mb-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-md transition"
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
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${risk === "Risky"
                      ? "bg-red-100 text-red-600"
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
                    className={`text-3xl font-bold ${risk === "Risky" ? "text-red-600" : "text-green-600"
                      }`}
                  >
                    {probability}%
                  </p>
                </div>

                <p className="text-gray-700 mt-4 text-center">
                  {risk === "Risky"
                    ? "⚠️ Probability of danger is high. Please consult a clinician immediately."
                    : "Normal pattern detected. Keep maintaining a healthy lifestyle."}
                </p>

                {rrFeatures && <RRFeaturesCard rr={rrFeatures} />}
                {rrFeatures && (
                  <RRSummaryBlock
                    probText={probText}
                    meanRRText={meanRRText}
                    hrText={hrText}
                  />
                )}
                {rrFeatures && (
                  <GenerateReportButton onGenerate={handleGenerateReport} />
                )}
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
              Disclaimer: This tool provides an indicative risk estimate based on RR interval patterns and a deep learning model. It is not a medical device. Please consult a clinician for any diagnosis or treatment decisions.
            </p>
          </div>
        </div>

        {/* Modal for High Risk */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md text-center">
              <h2 className="text-2xl font-bold text-red-600 mb-4">
                ⚠️ High Probability of Danger Detected!
              </h2>
              <p className="text-gray-800 text-lg font-semibold mb-2">
                Your estimated probability of danger is{" "}
                <span className="text-red-600 font-bold text-2xl">
                  {probability}%
                </span>
                .
              </p>
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
        {/* Error Modal */}
        <StatusModal
          open={!!errorMsg}
          type="error"
          title="Error"
          message={errorMsg}
          onClose={() => setErrorMsg("")}
        />

        {/* Success Modal */}
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
