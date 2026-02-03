import { Button } from "@/app/components/ui/button";
import { GraduationCap } from "lucide-react";

export function Navigation() {
  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-emerald-600" />
            <span className="text-2xl text-gray-900">GRADSIS</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition-colors">How It Works</a>
            <a href="#comparison" className="text-gray-600 hover:text-gray-900 transition-colors">Compare</a>
            <a href="#faq" className="text-gray-600 hover:text-gray-900 transition-colors">FAQ</a>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-gray-700 hover:text-gray-900">
              Sign In
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full">
              Generate My Plan
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
