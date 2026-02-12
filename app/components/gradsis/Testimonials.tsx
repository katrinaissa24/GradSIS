import { Card, CardContent } from "@/app/components/ui/card";
import { Quote } from "lucide-react";

const testimonials = [
  {
    name: "Rania Khalil",
    year: "Class of 2026",
    major: "Computer Science",
    quote: "GRADSIS saved me from taking courses out of order. I used to spend hours checking prerequisites on RESIS, now it's automatic. I planned my entire senior year in 10 minutes!",
    avatar: "RK"
  },
  {
    name: "Omar Haddad",
    year: "Class of 2027",
    major: "CS & Business",
    quote: "The drag-and-drop feature is a game changer. I can finally visualize my degree path and see how my electives fit in. Plus, the GPA tracker helps me stay motivated!",
    avatar: "OH"
  }
];

export function Testimonials() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl sm:text-5xl text-gray-900">
            What AUB Students Say
          </h2>
          <p className="text-xl text-gray-600">
            Join hundreds of CS students already planning smarter
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-2 border-gray-200 rounded-2xl hover:shadow-xl transition-shadow">
              <CardContent className="p-8 space-y-6">
                <Quote className="h-10 w-10 text-emerald-500 opacity-50" />
                <p className="text-lg text-gray-700 leading-relaxed italic">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-4 pt-4 border-t-2 border-gray-100">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white text-lg">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-600">{testimonial.major} • {testimonial.year}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
