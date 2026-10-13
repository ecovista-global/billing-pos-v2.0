import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  ChevronRight,
  Search,
  Sparkles,
  Users,
  Award,
  HeartHandshake,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Send,
  X,
  FileText,
  UploadCloud,
  ArrowRight,
  Building2,
  Zap,
  Coffee,
  GraduationCap,
  Smile,
  Compass
} from 'lucide-react';

export default function Careers() {
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeJob, setActiveJob] = useState(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [applyingFor, setApplyingFor] = useState(null);

  // Application form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    experience: '',
    portfolio: '',
    coverNote: '',
    resumeName: ''
  });

  const departments = ['All', 'Retail & Store Operations', 'Sales & Customer Care', 'Technical & Hardware Repair', 'Software & IT Systems', 'Finance & Inventory'];
  const locations = ['All', 'Headquarters (Tech Park)', 'Bandra Flagship Store', 'Andheri Hub', 'Thane Superstore', 'Remote / Hybrid'];

  const perks = [
    {
      icon: TrendingUp,
      title: 'Accelerated Career Growth',
      desc: 'Clear pathways for promotion from store associates to multi-store branch managers and tech leads.'
    },
    {
      icon: DollarSign,
      title: 'Top-Tier Compensation & Incentives',
      desc: 'Industry-leading base pay with attractive monthly sales bonuses and milestone performance perks.'
    },
    {
      icon: GraduationCap,
      title: 'Certified Training & Mentorship',
      desc: 'Learn advanced device diagnostics, premium retail customer psychology, and ERP management systems.'
    },
    {
      icon: ShieldCheck,
      title: 'Comprehensive Health & Wellness',
      desc: 'Complete medical cover for you and your family, term insurance, and mental wellness consultations.'
    },
    {
      icon: Coffee,
      title: 'Inspiring Work Environment',
      desc: 'State-of-the-art gadget experience lounges, modern workspaces, free refreshments, and vibrant team outings.'
    },
    {
      icon: Zap,
      title: 'Employee Tech Privileges',
      desc: 'Exclusive high-tier discounts on flagship smartphones, genuine accessories, and early gadget access.'
    }
  ];

  const jobs = [
    {
      id: 'job-1',
      title: 'Senior Retail Store Manager',
      department: 'Retail & Store Operations',
      location: 'Bandra Flagship Store',
      type: 'Full-time',
      experience: '4 - 7 Years',
      salary: '₹6.5 - 9.0 LPA + Performance Bonus',
      badge: 'Urgent Hiring',
      summary: 'Lead our premier luxury gadget showroom, driving high customer engagement, store inventory discipline, and team targets.',
      responsibilities: [
        'Lead day-to-day store operations, managing a team of 10+ retail tech consultants.',
        'Ensure 100% accurate billing, daily cash reconciliations, and strict inventory audits via Ecofone POS.',
        'Mentor associates on luxury sales pitch, gadget exchange evaluations, and warranty upsells.',
        'Handle VIP customer queries and resolve escalated support requests with utmost professionalism.'
      ],
      requirements: [
        'Bachelor’s degree in Business, Retail Management, or equivalent experience.',
        'Proven track record managing consumer electronics, telecom, or premium retail stores.',
        'Proficiency with POS systems, stock transfers, and store financial reports.',
        'Outstanding leadership and team motivation capabilities.'
      ]
    },
    {
      id: 'job-2',
      title: 'Smartphone Hardware & Diagnostics Specialist',
      department: 'Technical & Hardware Repair',
      location: 'Andheri Hub',
      type: 'Full-time',
      experience: '2 - 5 Years',
      salary: '₹4.2 - 6.0 LPA',
      badge: 'High Demand',
      summary: 'Perform precision motherboard diagnostics, screen refurbishments, battery replacements, and exchange inspections.',
      responsibilities: [
        'Execute multi-point hardware inspection on exchanged pre-owned phones (iOS & Android).',
        'Diagnose complex board-level issues, IC soldering, and display assembly replacement.',
        'Document repair logs and warranty validation reports in the internal portal.',
        'Maintain ESD safety compliance and maintain clean repair workstations.'
      ],
      requirements: [
        'Diploma / Certification in Electronics or Mobile Hardware Repair.',
        'Deep knowledge of micro-soldering, schematic reading, and testing equipment.',
        'Experience working with Apple, Samsung, OnePlus, and flagship devices.'
      ]
    },
    {
      id: 'job-3',
      title: 'Senior Full Stack Engineer (Node.js & React)',
      department: 'Software & IT Systems',
      location: 'Remote / Hybrid',
      type: 'Full-time',
      experience: '3 - 6 Years',
      salary: '₹12.0 - 18.0 LPA',
      badge: 'Tech Core',
      summary: 'Architect and scale our multi-store cloud POS, real-time inventory synchronization engine, and warehouse logistics APIs.',
      responsibilities: [
        'Build and maintain highly responsive React client interfaces and resilient Express/Prisma backends.',
        'Optimize multi-branch SQLite/PostgreSQL sync pipelines with sub-second POS latency.',
        'Implement automated offline POS synchronization, thermal printing engines, and role-based access security.',
        'Drive automated testing, CI/CD pipeline automations, and secure API gateways.'
      ],
      requirements: [
        'Expertise in JavaScript/TypeScript, React 18, TailwindCSS, Node.js, and relational databases.',
        'Hands-on experience with high-concurrency transaction handling and inventory reconciliation systems.',
        'Strong problem-solving skills and clean architecture design principles.'
      ]
    },
    {
      id: 'job-4',
      title: 'Gadget Sales & Experience Consultant',
      department: 'Sales & Customer Care',
      location: 'Thane Superstore',
      type: 'Full-time',
      experience: '1 - 3 Years',
      salary: '₹3.2 - 4.8 LPA + Daily Sales Incentives',
      badge: 'Immediate Joiner',
      summary: 'Deliver memorable in-store buying experiences, assisting tech enthusiasts with phone upgrades, trade-ins, and accessories.',
      responsibilities: [
        'Welcome patrons and guide them through smartphone specs, camera demos, and OS comparisons.',
        'Process quick trade-ins, warranty registrations, and billing at POS counters.',
        'Maintain visual merchandising standards across device demo stations.',
        'Achieve store accessory attach-rate and device protection plan targets.'
      ],
      requirements: [
        'Passionate about latest gadgets, gadgets ecosystem, and tech trends.',
        'Fluent verbal communication in English & Hindi with pleasant etiquette.',
        'Prior retail electronics sales background is preferred.'
      ]
    },
    {
      id: 'job-5',
      title: 'Inventory & Supply Chain Auditor',
      department: 'Finance & Inventory',
      location: 'Headquarters (Tech Park)',
      type: 'Full-time',
      experience: '2 - 4 Years',
      salary: '₹4.5 - 6.5 LPA',
      badge: 'Operations',
      summary: 'Oversee stock dispatch, warehouse inter-branch transfers, IMEI barcode serial trackings, and variance audits.',
      responsibilities: [
        'Coordinate central warehouse stock allocations across regional retail branches.',
        'Perform weekly cyclic stock audits and verify IMEI/Serial numbers against system records.',
        'Analyze shrinkage reports, transit damages, and RMA vendor replacements.',
        'Coordinate with accounts team for vendor GRN approvals and payment milestones.'
      ],
      requirements: [
        'Strong experience in retail inventory auditing, ERP software, and MS Excel / Sheets.',
        'Meticulous eye for detail and process compliance.',
        'Ability to handle inter-store logistics coordination.'
      ]
    }
  ];

  // Filtering
  const filteredJobs = jobs.filter((job) => {
    const matchesDept = selectedDept === 'All' || job.department === selectedDept;
    const matchesLoc = selectedLocation === 'All' || job.location === selectedLocation;
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesLoc && matchesSearch;
  });

  const handleOpenApply = (job) => {
    setApplyingFor(job);
    setApplicationSubmitted(false);
    setApplyModalOpen(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setApplicationSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition duration-200">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Eco DigiTech
              </span>
              <span className="block text-[11px] font-semibold text-amber-400 tracking-wider uppercase">
                EcoFone Careers
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-xs font-semibold text-slate-300 hover:text-white transition px-3 py-2 rounded-lg hover:bg-slate-900"
            >
              Employee Login
            </Link>
            <a
              href="#openings"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transform hover:-translate-y-0.5"
            >
              <Briefcase className="w-3.5 h-3.5" />
              View Openings
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute top-1/3 right-10 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold tracking-wide uppercase mb-6 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            We Are Hiring Top Talent
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
            Build the Future of <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
              Smart Retail & Luxury Tech
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Join the passionate team behind EcoFone and Eco DigiTech. We are redefining the consumer electronics experience across India through cutting-edge technology, authentic service, and premium multi-store retail.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a
              href="#openings"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm transition shadow-xl shadow-emerald-500/25 flex items-center gap-2"
            >
              Explore {jobs.length} Active Positions
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#culture"
              className="px-6 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 text-slate-300 font-bold text-sm transition"
            >
              Our Culture & Perks
            </a>
          </div>

          {/* Quick Metrics */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm text-center">
              <div className="text-3xl font-black text-emerald-400">10+</div>
              <div className="text-xs font-medium text-slate-400 mt-1">Retail Stores & Hubs</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm text-center">
              <div className="text-3xl font-black text-teal-400">50K+</div>
              <div className="text-xs font-medium text-slate-400 mt-1">Happy Gadget Owners</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm text-center">
              <div className="text-3xl font-black text-amber-400">99.8%</div>
              <div className="text-xs font-medium text-slate-400 mt-1">System Uptime & Trust</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm text-center">
              <div className="text-3xl font-black text-purple-400">4.8 ★</div>
              <div className="text-xs font-medium text-slate-400 mt-1">Employee Culture Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Perks & Benefits Section */}
      <section id="culture" className="py-20 bg-slate-900/40 border-y border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              Why Join Eco DigiTech
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
              Empowering Perks That Support Your Growth
            </h2>
            <p className="text-sm text-slate-400 mt-3">
              We cultivate a culture of innovation, high ownership, and mutual respect where exceptional contributions are celebrated and rewarded.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {perks.map((perk, index) => {
              const Icon = perk.icon;
              return (
                <div
                  key={index}
                  className="p-7 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition duration-300 group hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/5"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition duration-300 mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{perk.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{perk.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Open Roles Section */}
      <section id="openings" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
              Join Our Mission
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">Current Job Openings</h2>
            <p className="text-sm text-slate-400 mt-2">
              Discover opportunities that align with your passion and skill set.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-8 pb-4 border-b border-slate-800">
          <div className="text-xs font-bold text-slate-400 mr-2 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" /> Department:
          </div>
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                selectedDept === dept
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        {/* Job Listings Grid */}
        <div className="space-y-4">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800">
              <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No positions match your filters</h3>
              <p className="text-xs text-slate-500 mt-1">Try clearing your search query or department filter.</p>
              <button
                onClick={() => {
                  setSelectedDept('All');
                  setSelectedLocation('All');
                  setSearchQuery('');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <div
                key={job.id}
                className="p-6 sm:p-7 rounded-2xl bg-slate-900/60 border border-slate-800/90 hover:border-slate-700 hover:bg-slate-900 transition duration-200 group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                        {job.badge}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300">
                        {job.department}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300">
                        {job.type}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition">
                      {job.title}
                    </h3>

                    <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                      {job.summary}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>{job.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{job.experience}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>{job.salary}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => setActiveJob(activeJob?.id === job.id ? null : job)}
                      className="px-4 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-bold transition"
                    >
                      {activeJob?.id === job.id ? 'Hide Details' : 'View Details'}
                    </button>
                    <button
                      onClick={() => handleOpenApply(job)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
                    >
                      Apply Now
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {activeJob?.id === job.id && (
                  <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
                    <div>
                      <h4 className="text-xs font-extrabold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Key Responsibilities
                      </h4>
                      <ul className="space-y-2">
                        {job.responsibilities.map((resp, i) => (
                          <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                            <span>{resp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-xs font-extrabold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-400" /> What We Look For
                      </h4>
                      <ul className="space-y-2">
                        {job.requirements.map((req, i) => (
                          <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-end">
                        <button
                          onClick={() => handleOpenApply(job)}
                          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-black hover:opacity-95 transition shadow-lg shadow-emerald-500/20"
                        >
                          Proceed to Application
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Spontaneous Application Banner */}
      <section className="py-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border border-emerald-500/20 relative overflow-hidden text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-8">
          <div className="relative z-10 max-w-xl">
            <h3 className="text-2xl font-black text-white">Don’t see your exact role?</h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
              We are constantly seeking outstanding managers, tech enthusiasts, and sales champions. Drop your CV directly into our talent community.
            </p>
          </div>
          <button
            onClick={() => handleOpenApply({ title: 'General / Open Application', department: 'Talent Pool' })}
            className="shrink-0 px-6 py-3 rounded-xl bg-white text-slate-950 font-bold text-xs hover:bg-slate-200 transition shadow-xl"
          >
            Submit Spontaneous CV
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-white">Eco DigiTech Private Limited</span>
            <span>•</span>
            <span>Ecofone Retail Networks</span>
          </div>
          <p>© {new Date().getFullYear()} Eco DigiTech. All rights reserved. Equal Opportunity Employer.</p>
        </div>
      </footer>

      {/* Application Modal */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setApplyModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {applicationSubmitted ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-white">Application Received!</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Thank you for applying for <span className="text-emerald-400 font-semibold">{applyingFor?.title}</span>. Our Talent Acquisition team will review your profile and contact you within 48 hours.
                </p>
                <button
                  onClick={() => setApplyModalOpen(false)}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md">
                    Job Application
                  </span>
                  <h3 className="text-xl font-bold text-white mt-2">
                    {applyingFor?.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Fill in your contact information and career summary to apply.
                  </p>
                </div>

                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Full Legal Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Email Address <span className="text-rose-400">*</span>
                      </label>
                      <input
                        required
                        type="email"
                        placeholder="rahul@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Phone / WhatsApp <span className="text-rose-400">*</span>
                      </label>
                      <input
                        required
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Total Experience
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 3 Years in Retail Sales"
                        value={formData.experience}
                        onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        LinkedIn / Portfolio Link
                      </label>
                      <input
                        type="url"
                        placeholder="https://linkedin.com/in/..."
                        value={formData.portfolio}
                        onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Upload Resume / CV (PDF or DOCX) <span className="text-rose-400">*</span>
                    </label>
                    <label className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-950/50 transition">
                      <UploadCloud className="w-7 h-7 text-emerald-400 mb-1" />
                      <span className="text-xs font-semibold text-slate-300">
                        {formData.resumeName || 'Click to select resume document'}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">Max size 10MB</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setFormData({ ...formData, resumeName: e.target.files[0].name });
                          }
                        }}
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Brief Note / Why are you a good fit?
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Share a short summary of your background..."
                      value={formData.coverNote}
                      onChange={(e) => setFormData({ ...formData, coverNote: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    ></textarea>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setApplyModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-black hover:opacity-95 transition shadow-lg shadow-emerald-500/25 flex items-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Submit Application
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
