// Interpret RR Features & Probability
export function interpretRRFeatures(rr, probability, taskType) {
  const { mean_rr, estimated_hr_bpm } = rr || {};

  let probText = "";

  // --- Early AF Prediction ---
  if (taskType === "early_prediction") {
    probText =
      probability >= 53
        ? "The model flags this segment as higher risk based on RR patterns."
        : "The model flags this segment as lower risk based on RR patterns.";
  }

  // --- AF Detection ---
  else if (taskType === "af_detection") {
    probText =
      probability >= 65
        ? "AF Detected."
        : "No AF Detected.";
  }

  const meanRRText =
    typeof mean_rr === "number"
      ? `Average RR interval for the analysed segment is ${mean_rr.toFixed(1)} ms.`
      : "Average RR interval could not be computed.";

  let hrText = "";
  if (typeof estimated_hr_bpm === "number") {
    if (estimated_hr_bpm < 60) {
      hrText = `Estimated heart rate is ${estimated_hr_bpm.toFixed(
        1
      )} bpm (context: slower heartbeat).`;
    } else if (estimated_hr_bpm <= 100) {
      hrText = `Estimated heart rate is ${estimated_hr_bpm.toFixed(
        1
      )} bpm (context: typical resting range).`;
    } else {
      hrText = `Estimated heart rate is ${estimated_hr_bpm.toFixed(
        1
      )} bpm (context: faster heartbeat).`;
    }
  } else {
    hrText = "Heart rate could not be estimated from RR intervals.";
  }

  return { probText, meanRRText, hrText };
}

// RR Feature Display Card
export function RRFeaturesCard({ rr }) {
  if (!rr) return null;

  return (
    <div className="mt-6 bg-blue-50 p-6 rounded-2xl shadow w-full">
      <h4 className="text-xl font-bold text-blue-800 mb-4">
        RR Interval Features <span className="text-sm text-gray-500">(Additional Context Only)</span>
      </h4>

      <div className="grid grid-cols-2 gap-4">

        {/* mean_rr */}
        {"mean_rr" in rr && (
          <div className="bg-white p-4 rounded-xl shadow flex flex-col items-center text-center">
            <p className="text-sm text-gray-500 uppercase tracking-wide">
              MEAN_RR
            </p>

            <p className="text-2xl font-semibold text-blue-700">
              {rr.mean_rr.toFixed(1)} <span className="text-base text-gray-600">ms</span>
            </p>

            <p className="text-xs text-gray-500 mt-1">
              Average time between heartbeats.
            </p>
          </div>
        )}

        {/* estimated_hr_bpm */}
        {"estimated_hr_bpm" in rr && (
          <div className="bg-white p-4 rounded-xl shadow flex flex-col items-center text-center">
            <p className="text-sm text-gray-500 uppercase tracking-wide">
              ESTIMATED_HR_BPM
            </p>

            <p className="text-2xl font-semibold text-blue-700">
              {rr.estimated_hr_bpm.toFixed(1)} <span className="text-base text-gray-600">bpm</span>
            </p>

            <p className="text-xs text-gray-500 mt-1">
              Approximate heart rate from RR intervals.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

// Summary Block
export function RRSummaryBlock({ probText, meanRRText, hrText }) {
  return (
    <div className="mt-4 bg-white rounded-lg shadow p-4 text-sm text-gray-700 space-y-2">
      <p>{probText}</p>
      {/* <br></br> */}
      {/* <p className="text-gray-600 italic">
        *HRV-related values shown below are additional context only and do not determine the model's prediction.*
      </p> */}
      <p>{meanRRText}</p>
      <p>{hrText}</p>
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
          Processing Your RRI…
        </h2>

        <p className="text-gray-600 text-sm mb-4">
          This may take <strong>10-20 seconds</strong>.<br />
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

export function StatusModal({ open, type = "error", title, message, onClose }) {
  if (!open || !message) return null;

  const isError = type === "error";
  const color = isError ? "red" : "green";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 max-w-sm w-full text-center">
        <h2 className={`text-lg font-bold text-${color}-600 mb-3`}>
          {title}
        </h2>
        <p className="text-gray-800 mb-5 whitespace-pre-line">
          {message}
        </p>
        <button
          onClick={onClose}
          className={`px-4 py-2 bg-${color}-600 hover:bg-${color}-700 text-white rounded-lg shadow-md`}
        >
          Close
        </button>
      </div>
    </div>
  );
}


