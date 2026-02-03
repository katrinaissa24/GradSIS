import { Button } from "@/app/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-600">
      <div className="mx-auto max-w-4xl text-center space-y-8">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl text-white">
          Ready to Get Started?
        </h2>
        <p className="text-lg text-blue-100 max-w-2xl mx-auto">
          Join thousands of teams already using our platform to transform their workflow. 
          Start your free trial today, no credit card required.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
            Start Free Trial
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button size="lg" variant="outline" className="border-white text-white hover:bg-blue-700">
            Contact Sales
          </Button>
        </div>
      </div>
    </section>
  );
}
