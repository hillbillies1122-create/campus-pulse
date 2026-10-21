/* Interest items: O*NET Interest Profiler Short Form (60 items), U.S. Department of Labor, Employment and Training Administration.
   Used under the O*NET Tools Developer License. Modified by Campus Pulse: items are interleaved, answered Like / Not sure / Dislike,
   and shown 10 at a time online. */
(function () {
  var A = {
    R: ["Build kitchen cabinets", "Drive a truck to deliver packages to offices and homes", "Lay brick or tile", "Test the quality of parts before shipment", "Repair household appliances", "Repair and install locks", "Raise fish in a fish hatchery", "Set up and operate machines to make products", "Assemble electronic parts", "Put out forest fires"],
    I: ["Develop a new medicine", "Investigate the cause of a fire", "Study ways to reduce water pollution", "Develop a way to better predict the weather", "Conduct chemical experiments", "Work in a biology lab", "Study the movement of planets", "Invent a replacement for sugar", "Examine blood samples using a microscope", "Do laboratory tests to identify diseases"],
    A: ["Write books or plays", "Paint sets for plays", "Play a musical instrument", "Write scripts for movies or television shows", "Compose or arrange music", "Perform jazz or tap dance", "Draw pictures", "Sing in a band", "Create special effects for movies", "Edit movies"],
    S: ["Teach an individual an exercise routine", "Teach children how to play sports", "Help people with personal or emotional problems", "Teach sign language to people who are deaf or hard of hearing", "Give career guidance to people", "Help conduct a group therapy session", "Perform rehabilitation therapy", "Take care of children at a day-care center", "Do volunteer work at a non-profit organization", "Teach a high-school class"],
    E: ["Buy and sell stocks and bonds", "Negotiate business contracts", "Manage a retail store", "Represent a client in a lawsuit", "Operate a beauty salon or barber shop", "Market a new line of clothing", "Manage a department within a large company", "Sell merchandise at a department store", "Start your own business", "Manage a clothing store"],
    C: ["Develop a spreadsheet using computer software", "Calculate the wages of employees", "Proofread records or forms", "Inventory supplies using a hand-held computer", "Install software across computers on a large network", "Record rent payments", "Operate a calculator", "Keep inventory records", "Keep shipping and receiving records", "Stamp, sort, and distribute mail for an organization"]
  };
  var order = ["R", "I", "A", "S", "E", "C"], items = [];
  for (var i = 0; i < 10; i++) order.forEach(function (k) { items.push({ area: k, text: A[k][i] }); });
  window.CP_ITEMS = items;

  window.CP_RIASEC = {
    R: { name: "Realistic", short: "Builders", blurb: "Hands-on work with tools, machines, materials and physical systems." },
    I: { name: "Investigative", short: "Thinkers", blurb: "Research, analysis and working out how things work." },
    A: { name: "Artistic", short: "Creators", blurb: "Original ideas, design and self-expression." },
    S: { name: "Social", short: "Helpers", blurb: "Teaching, guiding and supporting other people." },
    E: { name: "Enterprising", short: "Persuaders", blurb: "Leading, selling, deciding and starting things." },
    C: { name: "Conventional", short: "Organisers", blurb: "Structured work with data, records and clear procedures." }
  };

  /* India Skills Report 2026 (ETS with CII, AICTE, AIU, Taggd), employability by branch, as reported by
     The CSR Journal and Careers360, Nov 2025. Branches not reported are left out. */
  window.CP_ISR = {
    edition: "India Skills Report 2026",
    national: 56.35,
    btech: 70.15,
    branches: [
      { group: "cs", label: "Computer Science", value: 80 },
      { group: "it", label: "Information Technology", value: 78 },
      { group: "eie", label: "Instrumentation", value: 77 },
      { group: "ece", label: "Electronics & Communication", value: 75 },
      { group: "mech", label: "Mechanical", value: 63 }
    ]
  };

  window.CP_BRANCHES = [
    ["Computer Science and Engineering", "cs"],
    ["CSE (Artificial Intelligence and Machine Learning)", "cs"],
    ["CSE (Data Science)", "cs"],
    ["CSE (Cyber Security)", "cs"],
    ["CSE (Internet of Things)", "cs"],
    ["CSE (Business Systems)", "cs"],
    ["Information Technology", "it"],
    ["Electronics and Communication Engineering", "ece"],
    ["ECE (VLSI Design and Technology)", "ece"],
    ["ECE (Embedded Systems)", "ece"],
    ["Electronics and Computer Engineering", "ece"],
    ["Electrical and Electronics Engineering", "eee"],
    ["Electronics and Instrumentation Engineering", "eie"],
    ["Mechanical Engineering", "mech"],
    ["Mechanical (Automotive Engineering)", "mech"],
    ["Mechanical (Electric Vehicles)", "mech"],
    ["Civil Engineering", "civil"],
    ["Chemical Engineering", "chem"],
    ["Biotechnology", "bio"],
    ["Bioengineering", "bio"],
    ["Other", "other"]
  ];

  window.CP_GROUPS = { cs: "Computer Science", it: "Information Technology", ece: "Electronics & Communication", eee: "Electrical & Electronics", eie: "Instrumentation", mech: "Mechanical", civil: "Civil", chem: "Chemical", bio: "Bio", other: "Other" };

  window.CP_DEFS = {
    "Programming": "Writing computer programs for various purposes.",
    "Mathematics": "Using mathematics to solve problems.",
    "Science": "Using scientific rules and methods to solve problems.",
    "Critical Thinking": "Using logic to weigh up solutions and spot weak points.",
    "Complex Problem Solving": "Working through messy, real problems and choosing a fix.",
    "Technology Design": "Creating or adapting equipment and technology to meet needs.",
    "Troubleshooting": "Finding the cause of faults and deciding what to do.",
    "Systems Analysis": "Working out how a system should work and how changes affect it.",
    "Quality Control Analysis": "Testing products or processes to check quality.",
    "Writing": "Communicating clearly in writing.",
    "Speaking": "Explaining things clearly out loud.",
    "Coordination": "Adjusting your work to fit with what others are doing.",
    "Engineering and Technology": "Applying engineering principles to design and build things.",
    "Computers and Electronics": "Circuit boards, processors, chips, hardware and software.",
    "Physics": "Physical laws: mechanics, electricity, heat, fluids, optics.",
    "Design": "Technical drawings, blueprints, models and CAD.",
    "Mechanical": "Machines and tools, how they work and how to maintain them.",
    "Chemistry": "Substances, reactions, and safe handling of chemicals.",
    "Biology": "Living organisms, cells and how they function.",
    "Building and Construction": "Materials and methods for building roads, structures and houses.",
    "Telecommunications": "Transmitting and switching signals and communication systems.",
    "Production and Processing": "Manufacturing, materials flow, quality and cost of production."
  };
})();
