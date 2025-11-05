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

  // --- Trend Data (use all records, not just 5) ---
  const predictionTrendData = predictionRecords.map((r) => ({
    name: r.date,
    probability: r.probability,
  }));

  // For detection trend we want a binary series (Yes=1, No=0)
  const detectionTrendData = detectionRecords.map((r) => ({
    name: r.date,
    value: r.af_detected ? 1 : (r.risk === "Detected" || (r.probability && r.probability > 50) ? 1 : 0),
  }));

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b border-gray-300">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <SummaryCard
              icon={<FaFileAlt size={28} />}
              label="Uploaded Records"
              value={predictionRecords.length}
              color="blue"
            />
            <SummaryCard
              icon={<FaHeartbeat size={28} />}
              label="High Risk Cases"
              value={predictionRecords.filter((r) => r.risk === "High").length}
              color="red"
            />
          </div>

          {/* --- Table --- */}
          <div className="bg-white shadow-xl rounded-xl p-6 mb-6">
            <h2 className="text-gray-500 text-lg font-bold mb-4">
              AF Early Prediction Records
            </h2>
            <PredictionTable records={predictionRecords} />
          </div>

          {/* --- Trend Chart --- */}
          <TrendChart
            title="Prediction Danger Trend (All Records)"
            data={predictionTrendData}
          />
        </>
      ) : (
        <>
          {/* --- AF Detection --- */}
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

          {/* --- Table --- */}
          <div className="bg-white shadow-xl rounded-xl p-6 mb-6">
            <h2 className="text-gray-500 text-lg font-bold mb-4">
              AF Detection Records
            </h2>
            <DetectionTable records={detectionRecords} />
          </div>

          {/* --- Trend Chart --- */}
          <TrendChart
            title="AF Detection Trend (All Records)"
            data={detectionTrendData}
            binary={true}
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

/* --- Early Prediction Table --- */
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
                    r.risk === "High"
                      ? "bg-red-100 text-red-600"
                      : r.risk === "Medium"
                      ? "bg-yellow-100 text-yellow-600"
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

/* --- Detection Table --- */
function DetectionTable({ records }) {
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b">
          <th className="p-2">Date</th>
          <th className="p-2">Record</th>
          <th className="p-2">AF Detected?</th>
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

/* --- Trend Chart --- */
function TrendChart({ title, data, binary = false }) {
  return (
    <div className="bg-white shadow-xl rounded-xl p-6">
      <h2 className="text-gray-500 text-lg font-bold mb-4">{title}</h2>
      {data.length > 0 ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
             <XAxis
              dataKey="name"
              type="category"
              allowDuplicatedCategory={false}
              interval={0}
              tick={({ x, y, payload }) => {
                const parts = payload.value.split(","); // e.g. ["2025-11-05", "10:00"]
                return (
                  <text x={x} y={y + 10} textAnchor="middle" fill="#555" fontSize={13}>
                    <tspan x={x} dy="0">{parts[0]}</tspan>
                    {parts[1] && <tspan x={x} dy="12">{parts[1]}</tspan>}
                  </text>
                );
              }}
              padding={{ left: 0, right: 28 }}
            />
              {binary ? (
                // Binary chart: values are 0 or 1
                <YAxis domain={[0, 1]} ticks={[0, 1]} tickFormatter={(t) => (t === 1 ? "Yes" : "No")} />
              ) : (
                <YAxis domain={[0, 100]} />
              )}
              <Tooltip
                formatter={(value) =>
                  binary ? [`${value === 1 ? "Yes" : "No"}`, "Is AF?"] : [`${value}%`, "Prob of danger"]
                }
              />
              {binary ? (
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#374151"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (cx == null || cy == null) return null;
                    const fill = payload && payload.value === 1 ? "#ef4444" : "#10b981";
                    return <circle cx={cx} cy={cy} r={6} fill={fill} stroke="none" />;
                  }}
                  activeDot={{ r: 8 }}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                type="monotone"
                dataKey="probability"
                stroke="#ef4444"
                strokeWidth={3}
                dot={({ cx, cy, payload }) =>
                  cx && cy && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={6}
                      fill={payload.probability >= 50 ? "#ef4444" : "#10b981"} // red if ≥50%, green otherwise
                    />
                  )
                }
                activeDot={({ cx, cy, payload }) =>
                  cx && cy && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={8}
                      fill={payload.probability >= 50 ? "#ef4444" : "#10b981"}
                    />
                  )
                }
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
