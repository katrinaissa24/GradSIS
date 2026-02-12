import { Card, CardContent } from "@/app/components/ui/card";
import { Save, FileText, UserCheck, Calendar, GraduationCap } from "lucide-react";

const steps = [
  {
    icon: Save,
    title: "Save Your Plan",
    description: "Keep multiple versions of your degree plan and update them anytime.",
    color: "bg-blue-100 text-blue-600"
  },
  {
    icon: FileText,
    title: "Export PDF",
    description: "Generate a professional PDF with all your courses and prerequisites.",
    color: "bg-emerald-100 text-emerald-600"
  },
  {
    icon: UserCheck,
    title: "Advisor Review",
    description: "Share with your advisor for approval and registration guidance.",
    color: "bg-purple-100 text-purple-600"
  }
];

export function ExportShare() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="mx-auto max-w-7xl">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl sm:text-5xl text-gray-900">
            Save, Export & Share with Your Advisor
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Turn your plan into actionable steps for registration
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-2 items-center">
          {/* Steps */}
          <div className="space-y-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={index} className="border-2 border-gray-200 rounded-2xl hover:border-emerald-300 hover:shadow-lg transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`h-12 w-12 rounded-xl ${step.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl text-gray-900 mb-2">{step.title}</h3>
                        <p className="text-gray-600">{step.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* PDF Preview Mockup */}
          <div className="relative">
            <Card className="border-2 border-gray-300 rounded-2xl shadow-2xl overflow-hidden bg-white transform rotate-1 hover:rotate-0 transition-transform">
              <CardContent className="p-8 space-y-6">
                {/* PDF Header */}
                <div className="border-b-2 border-gray-200 pb-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-8 w-8 text-emerald-600" />
                    <div>
                      <div className="text-sm text-gray-600">GRADSIS Graduation Plan</div>
                      <div className="text-xs text-gray-500">Generated February 1, 2026</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <div className="text-xs text-gray-600">Student Name</div>
                      <div className="text-sm text-gray-900">Sara Mansour</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Student ID</div>
                      <div className="text-sm text-gray-900">202012345</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Major</div>
                      <div className="text-sm text-gray-900">Computer Science</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Expected Graduation</div>
                      <div className="text-sm text-emerald-600">Spring 2027</div>
                    </div>
                  </div>
                </div>

                {/* Credits Summary */}
                <div className="space-y-3">
                  <div className="text-sm text-gray-900">Credits Summary</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Total Credits Completed</span>
                      <span className="text-gray-900">102</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Credits Remaining</span>
                      <span className="text-gray-900">24</span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-gray-200 pt-2">
                      <span className="text-gray-900">Total Required</span>
                      <span className="text-gray-900">126</span>
                    </div>
                  </div>
                </div>

                {/* Semester List Preview */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-600" />
                    <div className="text-sm text-gray-900">Planned Semesters</div>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-900 mb-1">Fall 2026</div>
                      <div className="text-xs text-gray-600">3 courses • 9 credits</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-900 mb-1">Spring 2027</div>
                      <div className="text-xs text-gray-600">3 courses • 9 credits</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 opacity-60">
                      <div className="text-xs text-gray-900 mb-1">Fall 2027</div>
                      <div className="text-xs text-gray-600">2 courses • 6 credits</div>
                    </div>
                  </div>
                </div>

                {/* Footer Note */}
                <div className="border-t-2 border-gray-200 pt-4">
                  <div className="text-xs text-gray-500 italic">
                    This plan is subject to advisor approval and course availability.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PDF Icon Badge */}
            <div className="absolute -top-3 -right-3 bg-red-500 text-white px-3 py-1 rounded-lg text-xs shadow-lg">
              PDF
            </div>
          </div>
        </div>

        {/* Bottom Note */}
        <div className="text-center mt-12">
          <p className="text-gray-600">
            Perfect for advisor meetings and registration planning.
          </p>
        </div>
      </div>
    </section>
  );
}
