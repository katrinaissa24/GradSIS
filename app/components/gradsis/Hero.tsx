import { Button } from "@/app/components/ui/button";
import { ArrowRight, Play } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50 via-blue-50 to-white pt-20 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl text-center">
        <div className="space-y-8">
          <div className="space-y-6">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl tracking-tight text-gray-900">
              Plan Your CS Degree,
              <br />
              <span className="text-emerald-600">Graduate On Time</span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 max-w-3xl mx-auto">
              The smart graduation planner built for AUB Computer Science students. 
              Visualize your path, track prerequisites, and stay on track to graduate.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-8 text-lg h-14">
              Generate My Plan
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 text-lg h-14 border-2">
              <Play className="mr-2 h-5 w-5" />
              See Demo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
