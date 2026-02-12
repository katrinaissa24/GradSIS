import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/app/components/ui/accordion";

const faqs = [
  {
    question: "Is GRADSIS officially affiliated with AUB?",
    answer: "GRADSIS is an independent student project built specifically for AUB CS students. While not officially affiliated with the university, we ensure all data matches official AUB degree requirements and prerequisites."
  },
  {
    question: "How accurate is the prerequisite checking?",
    answer: "Our prerequisite database is regularly updated to match the official AUB CS curriculum. We validate against COURSIS and RESIS data to ensure 100% accuracy. If you notice any discrepancies, please report them!"
  },
  {
    question: "Can I use GRADSIS for other majors besides CS?",
    answer: "Currently, GRADSIS is optimized for Computer Science majors at AUB. We're working on expanding to other engineering majors and hope to support more programs in the future."
  },
  {
    question: "Is my academic data safe and private?",
    answer: "Yes! Your data is encrypted and stored securely. We never share your information with third parties. You can export or delete your data at any time from your account settings."
  }
];

export function FAQ() {
  return (
    <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="mx-auto max-w-3xl">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl sm:text-5xl text-gray-900">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600">
            Everything you need to know about GRADSIS
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="bg-white border-2 border-gray-200 rounded-2xl px-6 data-[state=open]:border-emerald-300 transition-colors"
            >
              <AccordionTrigger className="text-left text-lg text-gray-900 hover:no-underline py-6">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 leading-relaxed pb-6">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
