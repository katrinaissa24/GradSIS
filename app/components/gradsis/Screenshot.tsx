import { Card, CardContent } from "@/app/components/ui/card";
import { GripVertical, BookOpen, Code, AlertTriangle, TrendingUp, CheckCircle } from "lucide-react";

const semesters = [
  {
    name: "Fall 2026",
    difficulty: "Moderate",
    difficultyColor: "bg-yellow-100 text-yellow-700 border-yellow-300",
    courses: [
      { code: "CMPS 253", name: "Data Structures", credits: 3, color: "bg-blue-100 border-blue-300 text-blue-700" },
      { code: "CMPS 272", name: "Database Systems", credits: 3, color: "bg-emerald-100 border-emerald-300 text-emerald-700" },
      { code: "CMPS 277", name: "Intro to AI", credits: 3, color: "bg-purple-100 border-purple-300 text-purple-700", warning: true, prerequisite: "CMPS 200" },
    ]
  },
  {
    name: "Spring 2027",
    difficulty: "Heavy",
    difficultyColor: "bg-red-100 text-red-700 border-red-300",
    courses: [
      { code: "CMPS 278", name: "Machine Learning", credits: 3, color: "bg-purple-100 border-purple-300 text-purple-700" },
      { code: "CMPS 383", name: "Software Engineering", credits: 3, color: "bg-blue-100 border-blue-300 text-blue-700" },
      { code: "CMPS 390", name: "Senior Project I", credits: 3, color: "bg-orange-100 border-orange-300 text-orange-700" },
    ]
  }
];

export function Screenshot() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto max-w-7xl">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl sm:text-5xl text-gray-900">
            See Your Entire Degree At A Glance
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Visualize your academic journey with our intuitive semester grid
          </p>
        </div>

        {/* Mockup Container */}
        <div className="relative">
          {/* Browser Chrome */}
          <div className="bg-gray-200 rounded-t-2xl p-3 border-2 border-gray-300 border-b-0">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                <div className="h-3 w-3 rounded-full bg-green-400"></div>
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-white rounded-md px-3 py-1 text-sm text-gray-500">
                  gradsis.aub.edu.lb
                </div>
              </div>
            </div>
          </div>

          {/* App Content */}
          <Card className="rounded-t-none rounded-b-2xl border-2 border-gray-300 shadow-2xl overflow-hidden">
            <CardContent className="p-0 bg-gradient-to-br from-white to-gray-50">
              <div className="flex flex-col lg:flex-row">
                {/* Sidebar Summary */}
                <div className="lg:w-64 bg-gray-100 border-b-2 lg:border-b-0 lg:border-r-2 border-gray-200 p-6 space-y-6">
                  <div>
                    <h4 className="text-sm text-gray-600 mb-3">Progress Summary</h4>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700">Credits</span>
                          <span className="text-gray-900">102/126</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: '81%' }}></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-gray-300">
                        <span className="text-sm text-gray-700">Current GPA</span>
                        <span className="text-xl text-emerald-600">3.67</span>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-gray-300">
                        <span className="text-sm text-gray-700">Electives Remaining</span>
                        <span className="text-lg text-gray-900">3</span>
                      </div>
                      
                      <div className="pt-2 border-t border-gray-300">
                        <div className="text-sm text-gray-700 mb-2">Requirements</div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            <span>Core Courses (24/24)</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <TrendingUp className="h-4 w-4 text-blue-500" />
                            <span>Electives (15/18)</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            <span>Math Requirements ✓</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 p-8">
                  {/* Header Stats */}
                  <div className="flex flex-wrap gap-6 mb-8 pb-6 border-b-2 border-gray-200">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-600">Total Credits</span>
                      <span className="text-3xl text-gray-900">102 / 126</span>
                    </div>
                    <div className="h-12 w-px bg-gray-300" />
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-600">Current GPA</span>
                      <span className="text-3xl text-emerald-600">3.67</span>
                    </div>
                    <div className="h-12 w-px bg-gray-300" />
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-600">Expected Graduation</span>
                      <span className="text-3xl text-gray-900">Spring 2027</span>
                    </div>
                  </div>

                  {/* Semester Grid */}
                  <div className="space-y-8">
                    {semesters.map((semester, semIndex) => (
                      <div key={semIndex} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl text-gray-900 flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-emerald-600" />
                            {semester.name}
                            <span className="text-sm text-gray-500 ml-2">
                              ({semester.courses.reduce((sum, c) => sum + c.credits, 0)} credits)
                            </span>
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs border ${semester.difficultyColor}`}>
                            {semester.difficulty}
                          </span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {semester.courses.map((course, courseIndex) => (
                            <div key={courseIndex} className="relative">
                              <Card
                                className={`${course.color} border-2 rounded-xl cursor-move hover:shadow-lg transition-shadow ${course.warning ? 'border-red-400' : ''}`}
                              >
                                <CardContent className="p-4 space-y-2">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="text-sm opacity-75">{course.code}</div>
                                      <div className="font-medium">{course.name}</div>
                                    </div>
                                    <GripVertical className="h-5 w-5 opacity-40 flex-shrink-0" />
                                  </div>
                                  <div className="text-sm opacity-75">{course.credits} credits</div>
                                  {course.warning && (
                                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-red-200">
                                      <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                                      <span className="text-xs text-red-700">Missing: {course.prerequisite}</span>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                              {course.warning && (
                                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full shadow-lg">
                                  Prerequisite!
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Empty Semester Slot */}
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center text-gray-400 hover:border-emerald-400 hover:text-emerald-600 transition-colors cursor-pointer">
                      <Code className="h-8 w-8 mx-auto mb-2" />
                      <div>Drag courses here to plan Fall 2027</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}