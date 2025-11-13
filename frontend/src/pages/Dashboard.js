import { useState } from "react";
import { FaFileAlt, FaHeartbeat } from "react-icons/fa";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DashboardOld({ records }) {
  const [activeTab, setActiveTab] = useState("prediction");

  // --- Separate Records ---
  const predictionRecords = records.filter((r) => r.type === "prediction");
  const detectionRecords = records.filter((r) => r.type === "detection");

  // --- Sort by Date (Old → New) ---
  const sortByDate = (a, b) => new Date(a.date) - new Date(b.date);
  predictionRecords.sort(sortByDate);
  detectionRecords.sort(sortByDate);

  // --- Trend Data (Prediction uses Risky/Safe) ---
  const predictionTrendData = predictionRecords.map((r) => ({
    name: r.date,
    probability: r.probability,
    risk: r.risk,
  }));

const detectionTrendData = detectionRecords.map((r) => ({
  name: r.date,
  probability:
    r.probability !== undefined && r.probability !== null
      ? r.probability
      : 0, 
}));


  return (
    <div className="min-h-screen bg-gray-100 p-6 ">
      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b border-gray-300 font-[Poppins]">
        <button
          onClick={() => setActiveTab("prediction")}
          className={`px-6 py-2 font-semibold rounded-t-lg ${
            activeTab === "prediction"
              ? "bg-white text-blue-600 border-t-2 border-x-2 border-blue-600"
              : "text-gray-500 hover:text-blue-400"
          }`}
        >
          AF Early Prediction
        </button>
        <button
          onClick={() => setActiveTab("detection")}
          className={`px-6 py-2 font-semibold rounded-t-lg ${
            activeTab === "detection"
              ? "bg-white text-blue-600 border-t-2 border-x-2 border-blue-600"
              : "text-gray-500 hover:text-blue-400"
          }`}
        >
          AF Detection
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "prediction" ? (
        <>
          {/* --- Early Prediction --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 ">
            <SummaryCard
              icon={<FaFileAlt size={28} />}
              label="Uploaded Records"
              value={predictionRecords.length}
              color="blue"
            />
            <SummaryCard
              icon={<FaHeartbeat size={28} />}
              label="Risky Cases"
              value={predictionRecords.filter((r) => r.risk === "Risky").length}
              color="red"
            />
          </div>

          {/* --- Table --- */}
          <div className="bg-white shadow-xl rounded-xl p-6 mb-6">
            <h2 className="text-gray-500 text-lg font-bold mb-4 font-[Poppins]">
              AF Early Prediction Records
            </h2>
            <PredictionTable records={predictionRecords} />
          </div>

          {/* --- Trend Chart --- */}
          <TrendChart
            title="Prediction Risk Trend"
            data={predictionTrendData}
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <SummaryCard
              icon={<FaFileAlt size={28} />}
              label="Uploaded Records"
              value={detectionRecords.length}
              color="blue"
            />
            <SummaryCard
              icon={<FaHeartbeat size={28} />}
              label="AF Detected"
              value={detectionRecords.filter((r) => r.af_detected).length}
              color="red"
            />
          </div>

          <div className="bg-white shadow-xl rounded-xl p-6 mb-6">
            <h2 className="text-gray-500 text-lg font-bold mb-4 font-[Poppins]">
              AF Detection Records
            </h2>
            <DetectionTable records={detectionRecords} />
          </div>

         <TrendChart
            title="AF Detection Probability Trend"
            data={detectionTrendData}
            detection={true}
          />
        </>
      )}
    </div>
  );
}

/* --- Reusable Summary Card --- */
function SummaryCard({ icon, label, value, color }) {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-600",
    red: "bg-red-100 text-red-600",
  };
  return (
    <div className="bg-white shadow-xl rounded-xl p-6 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className={`p-4 rounded-full ${colorClasses[color]}`}>{icon}</div>
        <p className="text-gray-500 uppercase tracking-wide text-lg font-bold">
          {label}
        </p>
      </div>
      <p
        className={`text-4xl font-extrabold ${
          color === "red" ? "text-red-500" : "text-blue-600"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/* --- Early Prediction Table (Risky/Safe) --- */
function PredictionTable({ records }) {
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b">
          <th className="p-2">Date</th>
          <th className="p-2">Record</th>
          <th className="p-2">Risk</th>
          <th className="p-2">Probability of Danger</th>
        </tr>
      </thead>
      <tbody>
        {records.length > 0 ? (
          records.map((r) => (
            <tr key={r.id} className="border-b hover:bg-gray-50">
              <td className="p-2 text-gray-600">{r.date}</td>
              <td className="p-2">{r.record_id}</td>
              <td className="p-2 font-bold">
                <span
                  className={`px-2 py-1 rounded-full text-sm ${
                    r.risk === "Risky"
                      ? "bg-red-100 text-red-600"
                      : "bg-green-100 text-green-600"
                  }`}
                >
                  {r.risk}
                </span>
              </td>
              <td className="p-2">{r.probability}%</td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="p-4 text-gray-500" colSpan={4}>
              No records yet
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/* --- Detection Table (unchanged) --- */
function DetectionTable({ records }) {
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b">
          <th className="p-2">Date</th>
          <th className="p-2">Record</th>
          <th className="p-2">AF Detected?</th>
          <th className="p-2">Probability of AF</th>
        </tr>
      </thead>
      <tbody>
        {records.length > 0 ? (
          records.map((r) => (
            <tr key={r.id} className="border-b hover:bg-gray-50">
              <td className="p-2 text-gray-600">{r.date}</td>
              <td className="p-2">{r.record_id}</td>
              <td className="p-2 font-bold">
                <span
                  className={`px-2 py-1 rounded-full text-sm ${
                    r.af_detected
                      ? "bg-red-100 text-red-600"
                      : "bg-green-100 text-green-600"
                  }`}
                >
                  {r.af_detected ? "Yes" : "No"}
                </span>
              </td>
              <td className="p-2">
                {r.probability !== undefined && r.probability !== null
                  ? `${r.probability}%`
                  : "-"}
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="p-4 text-gray-500" colSpan={3}>
              No records yet
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function TrendChart({ title, data, binary = false, detection = false }) {
  return (
    <div className="bg-white shadow-xl rounded-xl p-6">
      <h2 className="text-gray-500 text-lg font-bold mb-4 font-[Poppins]">
        {title}
      </h2>

      {data.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />

              {/* --- X-Axis with date/time split --- */}
              <XAxis
                dataKey="name"
                type="category"
                allowDuplicatedCategory={false}
                interval={0}
                tick={({ x, y, payload }) => {
                  const parts = payload.value.split(",");
                  return (
                    <text
                      x={x}
                      y={y + 10}
                      textAnchor="middle"
                      fill="#555"
                      fontSize={13}
                    >
                      <tspan x={x} dy="0">
                        {parts[0]}
                      </tspan>
                      {parts[1] && <tspan x={x} dy="12">{parts[1]}</tspan>}
                    </text>
                  );
                }}
                padding={{ left: 0, right: 28 }}
              />

              {/* --- Y-Axis --- */}
              {binary ? (
                <YAxis
                  domain={[0, 1]}
                  ticks={[0, 1]}
                  tickFormatter={(t) => (t === 1 ? "Yes" : "No")}
                />
              ) : (
                <YAxis domain={[0, 100]} />
              )}

              {/* --- Tooltip --- */}
              <Tooltip
                formatter={(value) =>
                  binary
                    ? [`${value === 1 ? "Yes" : "No"}`, "Is AF?"]
                    : detection
                    ? [`${value}%`, "Prob of AF"] 
                    : [`${value}%`, "Prob of danger"] 
                }
              />

              {binary ? (
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#374151"
                  strokeWidth={2}
                  dot={({ cx, cy, payload }) => {
                    if (cx == null || cy == null) return null;
                    const fill =
                      payload && payload.value === 1 ? "#ef4444" : "#10b981";
                    return (
                      <circle cx={cx} cy={cy} r={6} fill={fill} stroke="none" />
                    );
                  }}
                  activeDot={{ r: 8 }}
                  isAnimationActive={false}
                />
              ) : detection ? (
                <Line
                  type="monotone"
                  dataKey="probability"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  dot={({ cx, cy, payload }) => {
                    if (cx == null || cy == null) return null;
                    const fill =
                      payload.probability > 50 ? "#ef4444" : "#10b981";
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={6}
                        fill={fill}
                        stroke="white"
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={({ cx, cy, payload }) => {
                    if (cx == null || cy == null) return null;
                    const fill =
                      payload.probability > 50 ? "#ef4444" : "#10b981";
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={8}
                        fill={fill}
                        stroke="white"
                        strokeWidth={2}
                      />
                    );
                  }}
                  isAnimationActive={false}
                />
              ) : (
                // 🔵 Prediction probability line (Risky/Safe)
                <Line
                  type="monotone"
                  dataKey="probability"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  dot={({ cx, cy, payload }) => {
                    if (cx == null || cy == null) return null;
                    const fill =
                      payload?.risk === "Risky" ? "#ef4444" : "#10b981";
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={6}
                        fill={fill}
                        stroke="white"
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={({ cx, cy, payload }) => {
                    if (cx == null || cy == null) return null;
                    const fill =
                      payload?.risk === "Risky" ? "#ef4444" : "#10b981";
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={8}
                        fill={fill}
                        stroke="white"
                        strokeWidth={2}
                      />
                    );
                  }}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-gray-500">No data to display</p>
      )}
    </div>
  );
}
