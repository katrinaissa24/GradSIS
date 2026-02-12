import { CheckCircle2, Award, Shield, Sparkles } from "lucide-react";

export function SocialProof() {
  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white border-y border-gray-200">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
          <div className="flex items-center gap-3 text-gray-900">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
            <span className="text-lg">Built for AUB CS degree requirements</span>
          </div>
          
          <div className="hidden lg:block h-12 w-px bg-gray-300" />
          
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
            <div className="flex items-center gap-2 text-gray-700">
              <Award className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <span>Official Prerequisites</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Shield className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <span>Always Up-to-Date</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <span>Student Tested</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
