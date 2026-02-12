import { Button } from "@/app/components/ui/button";
import { Menu } from "lucide-react";

export function Navigation() {
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="text-2xl text-blue-600">YourBrand</div>
            <div className="hidden md:flex gap-6">
              <a href="#" className="text-gray-700 hover:text-gray-900 transition-colors">Features</a>
              <a href="#" className="text-gray-700 hover:text-gray-900 transition-colors">Pricing</a>
              <a href="#" className="text-gray-700 hover:text-gray-900 transition-colors">About</a>
              <a href="#" className="text-gray-700 hover:text-gray-900 transition-colors">Contact</a>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="hidden sm:inline-flex">
              Sign In
            </Button>
            <Button className="hidden sm:inline-flex bg-blue-600 hover:bg-blue-700 text-white">
              Get Started
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
