import { Upload, Calendar, Target } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Import Your Progress",
    description: "Upload your transcript or manually input completed courses. GRADSIS automatically syncs with your academic history.",
    color: "text-blue-600"
  },
  {
    number: "02",
    icon: Calendar,
    title: "Plan Your Semesters",
    description: "Drag and drop courses into future semesters. Our smart system ensures all prerequisites are met and requirements are fulfilled.",
    color: "text-emerald-600"
  },
  {
    number: "03",
    icon: Target,
    title: "Stay On Track",
    description: "Track your progress in real-time. Get alerts about registration deadlines, prerequisite issues, and graduation milestones.",
    color: "text-purple-600"
  }
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="mx-auto max-w-7xl">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl sm:text-5xl text-gray-900">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get from enrollment to graduation in three simple steps
          </p>
        </div>

        <div className="grid gap-12 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative">
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="relative">
                    <div className={`h-20 w-20 rounded-full bg-white border-4 border-gray-200 flex items-center justify-center ${step.color}`}>
                      <Icon className="h-10 w-10" />
                    </div>
                    <div className="absolute -top-3 -right-3 h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white text-sm">
                      {step.number}
                    </div>
                  </div>
                  <h3 className="text-2xl text-gray-900">{step.title}</h3>
                  <p className="text-gray-600 leading-relaxed max-w-sm">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-1/2 w-full h-0.5 bg-gradient-to-r from-gray-300 to-gray-200" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
