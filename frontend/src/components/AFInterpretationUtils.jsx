// Interpret RR Features & Probability
export function interpretRRFeatures(rr, prob) {
  const p = prob || 0;

  const probText =
    p < 0.3 ? "Low irregularity detected."
      : p < 0.6 ? "Moderate irregularity observed."
      : "High irregularity detected. Rhythm resembles AF-like pattern.";

  const meanRRText =
    rr.mean_rr < 700 ? "Fast heart rate detected."
      : rr.mean_rr < 1100 ? "Normal heart rate range."
      : "Slow heart rate detected.";

  const sdnnText =
    rr.sdnn < 50 ? "Low variability (stable rhythm)."
      : rr.sdnn < 100 ? "Moderate variability."
      : "High variability (possible irregular rhythm).";

  const rmssdText =
    rr.rmssd < 30 ? "Low short-term variability."
      : rr.rmssd < 80 ? "Moderate short-term variability."
      : "High short-term variability (irregular rhythm).";

  const cvrrText =
    rr.cvrr < 0.05 ? "Very stable rhythm."
      : rr.cvrr < 0.15 ? "Moderately variable rhythm."
      : "Highly irregular rhythm.";

  return { probText, meanRRText, sdnnText, rmssdText, cvrrText };
}


// RR Feature Display Card
export function RRFeaturesCard({ rr }) {
  if (!rr) return null;

  return (
    <div className="mt-6 bg-blue-50 p-6 rounded-2xl shadow w-full">
      <h4 className="text-xl font-bold text-blue-800 mb-4">
        RR Interval Features
      </h4>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(rr).map(([key, value]) => (
          <div key={key} className="bg-white p-4 rounded-xl shadow flex flex-col items-center">
            <p className="text-sm text-gray-500">{key.toUpperCase()}</p>
            <p className="text-2xl font-semibold text-blue-700">
              {typeof value === "number" ? value.toFixed(2) : value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}


// Summary Block
export function RRSummaryBlock({ rr, prob }) {
  if (!rr) return null;

  const { probText, meanRRText, sdnnText, rmssdText, cvrrText } =
    interpretRRFeatures(rr, prob);

  return (
    <div className="mt-6 bg-yellow-50 p-6 rounded-xl shadow w-full">
      <h4 className="text-xl font-bold text-yellow-800 mb-3">Summary</h4>
      <ul className="text-yellow-900 space-y-2 text-sm font-medium">
        <li>• {probText}</li>
        <li>• {meanRRText}</li>
        <li>• {sdnnText}</li>
        <li>• {rmssdText}</li>
        <li>• {cvrrText}</li>
      </ul>
    </div>
  );
}


// Loading Modal
export function LoadingModal({ visible, steps, stepIndex, onClose }) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 backdrop-blur-sm">
      <div className="relative bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-3 right-5 text-gray-500 hover:text-gray-700 text-xl font-bold"
        >
          ×
        </button>

        <div className="mb-4 flex justify-center">
          <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Processing Your ECG…
        </h2>

        <p className="text-gray-600 text-sm mb-4">
          This may take <strong>10–20 seconds</strong>.<br />
          Please do not close the page.
        </p>

        <p className="text-blue-600 font-semibold animate-pulse">
          {steps[stepIndex]}
        </p>
      </div>
    </div>
  );
}

export function GenerateReportButton({ onGenerate }) {
  return (
    <div className="flex justify-center mt-6">
      <button
        onClick={onGenerate}
        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm 
                   font-semibold rounded-xl shadow-md transition flex items-center gap-2"
      >
        Generate PDF Report
      </button>
    </div>
  );
}

