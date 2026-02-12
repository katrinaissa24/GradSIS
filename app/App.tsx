import { Navigation } from "@/app/components/gradsis/Navigation";
import { Hero } from "@/app/components/gradsis/Hero";
import { SocialProof } from "@/app/components/gradsis/SocialProof";
import { Features } from "@/app/components/gradsis/Features";
import { HowItWorks } from "@/app/components/gradsis/HowItWorks";
import { Comparison } from "@/app/components/gradsis/Comparison";
import { Screenshot } from "@/app/components/gradsis/Screenshot";
import { ExportShare } from "@/app/components/gradsis/ExportShare";
import { Testimonials } from "@/app/components/gradsis/Testimonials";
import { FAQ } from "@/app/components/gradsis/FAQ";
import { FinalCTA } from "@/app/components/gradsis/FinalCTA";
import { Footer } from "@/app/components/gradsis/Footer";

export default function App() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <Hero />
      <SocialProof />
      <Features />
      <HowItWorks />
      <Comparison />
      <Screenshot />
      <ExportShare />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}