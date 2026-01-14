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

export default function UploadAnalysis({ user }) {
  const [rrFiles, setRrFiles] = useState([]);
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

  const handleRrFilesChange = (e) => {
    const files = Array.from(e.target.files);
    const validation = validateRRFiles(files);

    if (!validation.valid) {
      setErrorMsg(validation.error);
      setRrFiles([]);
      clearFileInput();
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

  const handleAnalyze = async () => {
    if (rrFiles.length === 0) {
      setErrorMsg("Please select at least one .h5 file!");
      return;
    }
    setLoading(true);
    setRisk(null);
    setProbability(null);
    setRecordId(null);
    setRrFeatures(null);

    const formData = new FormData();
    rrFiles.forEach(file => {
      formData.append("rr_files", file);
    });

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

        if (probPercent >= 53) setRisk("Risky");
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
    if (rrFiles.length === 0 || !risk || probability === null) {
      setErrorMsg("Please complete all steps before saving!");
      return;
    }

    const recordData = {
      filesUploaded: rrFiles.map(f => f.name).join(", "),
      type: "prediction",
      record_id: typeof recordId === "undefined" ? null : recordId,
      risk,
      probability,
    };

    const result = await saveRecordToFirebase(db, auth, recordData);
    
    if (result.success) {
      setSuccessMsg("Record saved successfully!");
    } else {
      setErrorMsg(result.error);
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

        {/* Upload */}
        <div className="space-y-4">
          <FileUploadSection
            rrFiles={rrFiles}
            onFilesChange={handleRrFilesChange}
            onClearFiles={handleClearFiles}
          />

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
