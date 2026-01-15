import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  RRFeaturesCard,
  RRSummaryBlock,
  interpretRRFeatures,
  LoadingModal,
  GenerateReportButton,
  StatusModal,
  validateRRFiles,
  clearFileInput,
  FileUploadSection,
  saveRecordToFirebase
} from "../components/Utils";


export default function AFDetection({ user }) {
  const [rrFiles, setRrFiles] = useState([]);
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

  const handleRrFilesChange = (e) => {
    const files = Array.from(e.target.files);
    const validation = validateRRFiles(files);

    if (!validation.valid) {
      setErrorMsg(validation.error);
      setRrFiles([]);
      return;
    }

    setRrFiles(files);
    setErrorMsg("");
  };

  const handleClearFiles = () => {
    setRrFiles([]);
    setErrorMsg("");
    clearFileInput();
  };

  const handleDetect = async () => {
    if (rrFiles.length === 0) {
      setErrorMsg("Please select at least one .h5 file!");
      return;
    }

    setLoading(true);
    setDecision(null);
    setProbabilities([]);

    const formData = new FormData();
    rrFiles.forEach(file => {
      formData.append("rr_files", file);
    });

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
    if (rrFiles.length === 0 || !decision) {
      return setErrorMsg("Please complete detection before saving!");
    }

    const meanPercent = probabilities.length
      ? Math.round(
        probabilities.reduce((a, b) => a + b, 0) / probabilities.length
      )
      : null;

    const recordData = {
      filesUploaded: rrFiles.map(f => f.name).join(", "),
      fileName: rrFiles.map(f => f.name).join(", "),
      record_id: typeof recordId === "undefined" ? null : recordId,
      type: "detection",
      probability: meanPercent,
      af_detected: decision === "Yes",
      probabilities: probabilities,
    };

    const result = await saveRecordToFirebase(db, auth, recordData);
    
    if (result.success) {
      setSuccessMsg("Record saved successfully!");
    } else {
      setErrorMsg(result.error);
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

  const { probText, meanRRText, hrText, suggestionText } =
    rrFeatures ? interpretRRFeatures(rrFeatures, probabilities, "af_detection") : {};

  return (
    <div className="flex items-center justify-center py-10 px-6">
      <div className="bg-white shadow-2xl rounded-3xl p-10 w-full max-w-5xl transition-all">
        <h2 className="text-2xl font-bold mb-8 text-center text-gray-800">AF Detection</h2>

        <div className="bg-blue-50 p-4 rounded-lg text-sm text-gray-700 leading-relaxed">
          <p className="font-semibold mb-1">📘 Input Instructions</p>
          <p><strong>Upload RR Interval Data (HDF5):</strong></p>
          <ul className="list-disc pl-6 mt-1 space-y-1">
            <li>
              <code>record_{`{record_id}`}_rr_{`{index}`}.h5</code>:
              RR interval data in HDF5 format (automatic QRS annotations by Microport Syneview)
            </li>
            <li>
              You can upload one or multiple .h5 files from the same record
            </li>
            <li>
              <code>{`{index}`}</code> is a zero-based file index:
              <code> 00</code> for the first RRI file, <code>01</code> for the second, etc.
            </li>
          </ul>
        </div>

        <div className="space-y-4 mt-4">
          <FileUploadSection
            rrFiles={rrFiles}
            onFilesChange={handleRrFilesChange}
            onClearFiles={handleClearFiles}
          />

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

                  <p
                    className={`mt-2 text-sm ${decision === "Yes" ? "text-red-600" : "text-green-600"
                      }`}
                  >
                    {decision === "Yes"
                      ? "Please consult a healthcare provider for further evaluation."
                      : "Continue regular monitoring and maintain a healthy lifestyle."}
                  </p>
                </div>
              )}

              <RRFeaturesCard rr={rrFeatures} />
              <div className="w-full mt-4">
                <RRSummaryBlock
                  probText={probText}
                  meanRRText={meanRRText}
                  hrText={hrText}
                  suggestionText={suggestionText}
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
      {/* AF Detection Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              ⚠️ AF Detected!
            </h2>
            <p className="text-gray-800 text-lg font-semibold mb-2">
              Your estimated probability of AF is{" "}
              <span className="text-red-600 font-bold text-2xl">
                {Math.round(
                  probabilities.reduce((a, b) => a + b, 0) / probabilities.length
                )}%
              </span>
              .
            </p>
            <p className="text-gray-700 mb-6">
              Please consult a healthcare provider for further evaluation and treatment options.
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

