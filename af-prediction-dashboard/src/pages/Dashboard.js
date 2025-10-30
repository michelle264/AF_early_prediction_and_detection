// src/pages/Dashboard.js
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

export default function Dashboard({ records }) {
  // Take last 5 records for trend chart
  const lastFive = records.slice(-5).map((r, i) => ({
    name: r.date,
    probability: r.probability,
  }));

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Total Records */}
        <div className="bg-white shadow-xl rounded-xl p-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
              <FaFileAlt size={28} />
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-lg font-bold">
                Uploaded Records
              </p>
            </div>
          </div>
          <p className="text-4xl font-extrabold text-blue-600">
            {records.length}
          </p>
        </div>

        {/* Number of Alert Cases */}
        <div className="bg-white shadow-xl rounded-xl p-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-red-100 text-red-600 rounded-full">
              <FaHeartbeat size={28} />
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wide text-lg font-bold">
                High Risk Cases
              </p>
            </div>
          </div>
          <p className="text-4xl font-extrabold text-red-500">
            {records.filter((r) => r.risk === "High").length}
          </p>
        </div>
      </div>

      {/* Table as Card */}
      <div className="bg-white shadow-xl rounded-xl p-6 mb-6">
        <h2 className="text-gray-500 text-lg font-bold mb-4">Records</h2>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b">
              <th className="p-2">Date</th>
              <th className="p-2">File</th>
              <th className="p-2">Risk</th>
              <th className="p-2">Probability of Danger</th>
              {/* <th className="p-2">Predicted Time Horizon (Mins)</th> */}
            </tr>
          </thead>
          <tbody>
            {records.length > 0 ? (
              records.map((r) => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 text-gray-600">{r.date}</td>
                  <td className="p-2">{r.fileName}</td>
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
                    {r.risk === "High" && (
                      <span className="ml-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                        ALERT
                      </span>
                    )}
                  </td>
                  <td className="p-2">{r.probability}%</td>
                  {/* <td className="p-2">{r.timeHorizon}</td> */}
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-4 text-gray-500" colSpan={5}>
                  No records yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Risk Trend Card */}
      <div className="bg-white shadow-xl rounded-xl p-6">
        <h2 className="text-gray-500 text-lg font-bold mb-4">
          Danger Trend (Last 5 Records)
        </h2>
        {lastFive.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lastFive}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="probability"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500">No data to display</p>
        )}
      </div>
    </div>
  );
}
