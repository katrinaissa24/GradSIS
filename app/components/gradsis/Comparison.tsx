import { Check, X } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/card";

const comparisonData = [
  { feature: "Visual Semester Planning", gradsis: true, resis: false, coursis: false },
  { feature: "Drag-and-Drop Interface", gradsis: true, resis: false, coursis: false },
  { feature: "Prerequisite Validation", gradsis: true, resis: "partial", coursis: false },
  { feature: "GPA Projection", gradsis: true, resis: false, coursis: false },
  { feature: "Multi-Semester View", gradsis: true, resis: false, coursis: true },
  { feature: "Real-Time Updates", gradsis: true, resis: false, coursis: false },
  { feature: "Mobile Friendly", gradsis: true, resis: false, coursis: false },
];

export function Comparison() {
  return (
    <section id="comparison" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="mx-auto max-w-5xl">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl sm:text-5xl text-gray-900">
            Why Choose GRADSIS?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            See how GRADSIS compares to traditional AUB systems
          </p>
        </div>

        <Card className="border-2 border-gray-200 rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-gray-900">Feature</th>
                    <th className="px-6 py-4 text-center text-emerald-600">GRADSIS</th>
                    <th className="px-6 py-4 text-center text-gray-600">RESIS</th>
                    <th className="px-6 py-4 text-center text-gray-600">COURSIS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {comparisonData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-900">{row.feature}</td>
                      <td className="px-6 py-4 text-center">
                        {row.gradsis === true ? (
                          <Check className="h-6 w-6 text-emerald-600 mx-auto" />
                        ) : row.gradsis === "partial" ? (
                          <span className="text-yellow-600 text-sm">Partial</span>
                        ) : (
                          <X className="h-6 w-6 text-gray-300 mx-auto" />
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {row.resis === true ? (
                          <Check className="h-6 w-6 text-emerald-600 mx-auto" />
                        ) : row.resis === "partial" ? (
                          <span className="text-yellow-600 text-sm">Partial</span>
                        ) : (
                          <X className="h-6 w-6 text-gray-300 mx-auto" />
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {row.coursis === true ? (
                          <Check className="h-6 w-6 text-emerald-600 mx-auto" />
                        ) : row.coursis === "partial" ? (
                          <span className="text-yellow-600 text-sm">Partial</span>
                        ) : (
                          <X className="h-6 w-6 text-gray-300 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
