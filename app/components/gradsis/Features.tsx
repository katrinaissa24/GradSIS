import { Card, CardContent } from "@/app/components/ui/card";
import { GripVertical, AlertCircle, TrendingUp } from "lucide-react";

const features = [
  {
    icon: GripVertical,
    title: "Drag-and-Drop Scheduling",
    description: "Visually plan your semesters by dragging courses into slots. Rearrange your entire degree plan in seconds with an intuitive interface.",
    color: "bg-blue-100 text-blue-600"
  },
  {
    icon: AlertCircle,
    title: "Automatic Prerequisite Checking",
    description: "Never worry about course dependencies again. GRADSIS instantly validates your plan and alerts you to any prerequisite conflicts.",
    color: "bg-emerald-100 text-emerald-600"
  },
  {
    icon: TrendingUp,
    title: "Real-Time GPA & Credit Tracking",
    description: "See your projected GPA and credit progress update instantly as you plan. Stay on top of graduation requirements and academic standing.",
    color: "bg-purple-100 text-purple-600"
  }
];

export function Features() {
  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="mx-auto max-w-7xl">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl sm:text-5xl text-gray-900">
            Everything You Need to Graduate
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Powerful features designed specifically for AUB CS students
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="border-2 border-gray-200 hover:border-emerald-300 hover:shadow-xl transition-all rounded-2xl">
                <CardContent className="p-8 space-y-4">
                  <div className={`h-14 w-14 rounded-2xl ${feature.color} flex items-center justify-center`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-2xl text-gray-900">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
