import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { ArrowRight, Sparkles } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
      </div>
      
      <div className="mx-auto max-w-4xl text-center space-y-8 relative z-10">
        <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-white">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm">Join 500+ AUB CS students</span>
        </div>
        
        <h2 className="text-4xl sm:text-5xl lg:text-6xl text-white">
          Ready to Graduate On Time?
        </h2>
        
        <p className="text-xl text-emerald-50 max-w-2xl mx-auto leading-relaxed">
          Stop manually tracking prerequisites and requirements. 
          Let GRADSIS do the heavy lifting so you can focus on what matters.
        </p>
        
        <div className="max-w-md mx-auto pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input 
              type="email" 
              placeholder="Enter your AUB email"
              className="h-14 rounded-full px-6 text-lg bg-white/95 backdrop-blur-sm border-2 border-white/50 focus:border-white placeholder:text-gray-400"
            />
            <Button size="lg" className="bg-white text-emerald-600 hover:bg-gray-100 rounded-full px-8 text-lg h-14 shadow-xl whitespace-nowrap">
              Generate My Plan
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
        
        <p className="text-sm text-emerald-100 pt-4">
          Free forever for AUB students • No credit card required
        </p>
      </div>
    </section>
  );
}