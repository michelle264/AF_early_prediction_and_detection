import React from "react";
import AFImage from "./AF_image.jpg";

export default function Homepage({ onNavigateToLogin }) {
  return (
    <div className="min-h-screen bg-gray-50 font-[Poppins]">
      {/* Fixed Navbar */}
      <header className="fixed top-0 left-0 w-full bg-gradient-to-r from-blue-900 to-blue-700 shadow z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-bold text-white">Heart-Alert</div>
          <nav className="space-x-6 hidden md:flex">
            <a href="#how-it-works" className="text-gray-100 hover:text-yellow-200">
              How It Works
            </a>
            <a href="#af-info" className="text-gray-100 hover:text-yellow-200">
              What is AF?
            </a>
            <a href="#benefits" className="text-gray-100 hover:text-yellow-200">
              Benefits
            </a>
          </nav>
          <button
            onClick={onNavigateToLogin}
            className="px-3 py-1.5 bg-white text-blue-700 text-sm font-medium rounded-full hover:bg-gray-100 transition"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-16">
        <section
          className="relative py-32 text-center text-white"
          style={{
            backgroundImage: `url(${AFImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Overlay for readability */}
          <div className="absolute inset-0 bg-black opacity-50"></div>

          <div className="relative z-10 container mx-auto px-6">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-6 drop-shadow-lg">
              Empowering Early Prediction & Detection of Atrial Fibrillation
            </h1>
            <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed text-gray-100">
            Heart-Alert leverages AI-driven analysis of heart-rate variability to enable early prediction of Atrial Fibrillation (AF) risk and reliable detection of AF episodes.
            </p>
            <button
              onClick={onNavigateToLogin}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-lg rounded-lg shadow-lg"
            >
              Explore Now
            </button>
          </div>
        </section>

        {/* What is AF Section */}
        <section id="af-info" className="py-16 bg-white">
          <div className="container mx-auto px-6 max-w-4xl">
            <h2 className="text-3xl font-bold text-gray-800 mb-4 text-center">
              What is Atrial Fibrillation (AF)?
            </h2>
            <p className="text-gray-700 leading-relaxed text-lg text-justify">
              Atrial Fibrillation (AF) is an irregular and often rapid heart rhythm
              caused by disorganized electrical signals in the upper chambers of the
              heart. It can lead to blood clots, stroke, or heart failure if untreated.
              Many AF episodes occur without noticeable symptoms, making early
              prediction and timely detection essential for preventive care.
            </p>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 bg-gray-100">
        <div className="container mx-auto px-6 max-w-5xl text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-8">How Heart-Alert Works</h2>
            <div className="grid gap-8 md:grid-cols-3">
            <div className="p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-xl font-semibold mb-3">1. Upload Data</h3>
                <p className="text-gray-600">
                Users upload <strong>metadata.csv</strong> and <strong>record.zip</strong> files containing RR interval (RRI) information.
                </p>
            </div>

            <div className="p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-xl font-semibold mb-3">2. AI-Based Analysis</h3>
                <p className="text-gray-600">
                The system analyzes your R–R interval data using Neural ODE–based deep learning models - performing early prediction or AF detection based on your selected analysis mode.
                </p>
            </div>

            <div className="p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-xl font-semibold mb-3">3. Instant Insights</h3>
                <p className="text-gray-600">
                Instantly view results: Safe/Risky with danger probability for prediction, or AF/Normal with AF probability for detection.
                </p>
            </div>
            </div>
        </div>
        </section>


        {/* Benefits Section */}
        <section id="benefits" className="py-16">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">
              Why Use Heart-Alert?
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
            <div className="p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-xl font-semibold mb-3">AI-Driven Insights</h3>
                <p className="text-gray-600">
                  Leverages Neural ODE-based models for rhythm classification
                  and early risk prediction.
                </p>
              </div>
              <div className="p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-xl font-semibold mb-3">Non-Invasive Workflow</h3>
                <p className="text-gray-600">
                  Works seamlessly with RRI data - no wearable sensors or invasive procedures required.
                </p>
              </div>
              <div className="p-6 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-xl font-semibold mb-3">Real-Time Alerts</h3>
                <p className="text-gray-600">
                  Provides on-screen alert messages when the <strong>probability of danger or AF</strong> exceeds a defined threshold - ensuring prompt attention and intervention.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-6">
        <div className="container mx-auto px-6 text-center text-gray-500">
          © {new Date().getFullYear()} Heart-Alert. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
