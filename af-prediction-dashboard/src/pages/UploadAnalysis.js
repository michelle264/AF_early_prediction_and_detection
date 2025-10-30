
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

export default function UploadAnalysis({ user }) {
  const [metadataFile, setMetadataFile] = useState(null);
  const [recordsZip, setRecordsZip] = useState(null);
  const [risk, setRisk] = useState(null);
  const [probability, setProbability] = useState(null);
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
      alert("Please upload a valid record zip file!");
      setRecordsZip(null);
    }
  };

  const handleAnalyze = async () => {
    if (!metadataFile || !recordsZip) {
      alert("Please select both metadata.csv and record zip file!");
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

      // Use mean probability from API (mean of prob_danger)
      const meanProb = data.prob_danger && data.prob_danger.length > 0 ? (data.prob_danger.reduce((a, b) => a + b, 0) / data.prob_danger.length) : null;
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
      metadataFileName: metadataFile.name,
      recordsZipName: recordsZip.name,
      risk,
      probability,
      userId: user.uid,
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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6 relative">
      <div className="bg-white shadow-lg rounded-2xl p-10 w-full max-w-2xl">
        <h2 className="text-xl font-bold mb-6 text-center text-gray-800">
          Upload metadata csv and record zip
        </h2>
        <div className="space-y-4">
          {/* File Uploads */}
          <div className="flex flex-col space-y-3">
            <label className="text-sm font-medium">metadata csv</label>
            <input type="file" accept=".csv" onChange={handleMetadataChange} className="block w-full text-gray-700 text-sm" />
            <label className="text-sm font-medium">record zip</label>
            <input type="file" accept=".zip" onChange={handleRecordsZipChange} className="block w-full text-gray-700 text-sm" />
            <button
              onClick={handleAnalyze}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-md self-start transition"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center"><svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>Analyzing...</span>
              ) : (
                "Submit"
              )}
            </button>
          </div>

          {/* Analysis Result */}
          {risk && !loading && (
            <div className="bg-gray-50 rounded-xl shadow-md p-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Result
                </h3>
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
                <p className="text-sm text-gray-500">Probability of Danger</p>
                <p
                  className={`text-2xl font-bold ${
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

              {/* Reminder message for all risk levels */}
              <p className="text-gray-700 mt-4 text-center">
                {risk === "High"
                  ? "Probability of danger is high. Please consult a clinician immediately."
                  : risk === "Moderate"
                  ? "Slightly elevated risk. Consider regular monitoring or consulting a doctor if symptoms appear."
                  : "Normal risk detected. Keep maintaining a healthy lifestyle."}
              </p>

              {/* Save Button */}
              <button
                onClick={handleSave}
                className="px-4 py-2 mt-3 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-md transition"
              >
                Save Record
              </button>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-6 text-center">
            Disclaimer: This tool provides an indicative risk estimate based on RR
            variability features and is not a medical device. Consult a clinician for
            diagnosis.
          </p>
        </div>
      </div>

      {/* High Risk Modal */}
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
