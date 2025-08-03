import { useState, useEffect } from "react";
import {
  Circle,
  ExternalLink,
  BookOpen,
  Rocket,
  Wallet,
  Shield,
  Zap,
  RefreshCw,
  Settings,
  ArrowUpDown,
  TrendingUp,
  Repeat,
  BarChart3,
  Github,
  Twitter,
  MessageCircle,
  Send,
  FileText,
  Users,
  CheckSquare,
  Coins,
  Network,
  Activity,
  Target,
  Book,
} from "lucide-react";
import { SimpleButton } from "@/components/ui/simple-button";

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  style = {},
}: {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  style?: React.CSSProperties;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentY, setCurrentY] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay * 1000);

    // Floating animation
    const floatTimer = setInterval(() => {
      setCurrentY((prev) => (prev + 0.5) % (2 * Math.PI));
    }, 100);

    return () => {
      clearTimeout(timer);
      clearInterval(floatTimer);
    };
  }, [delay]);

  const floatingY = Math.sin(currentY) * 15;

  return (
    <div
      className={`absolute transition-all duration-[2400ms] ease-out ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: `translateY(${isVisible ? floatingY : -150}px) rotate(${rotate}deg)`,
        width,
        height,
        ...style,
      }}
    >
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-r from-white/[0.08] to-transparent backdrop-blur-[2px] border-2 border-[#4fd1c5]/[0.15] shadow-[0_8px_32px_0_rgba(79,209,197,0.1)]"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(79,209,197,0.2), transparent 70%)`,
        }}
      />
    </div>
  );
}

function Navbar() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleLaunchApp = () => {
    window.location.href = "/app";
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 px-4 md:px-6 py-4 transition-all duration-800 ${
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      }`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="relative bg-black/20 backdrop-blur-xl border border-[#4fd1c5]/10 rounded-2xl px-6 py-3">
          <div className="flex items-center justify-between">
            <img
              src="/logo.svg"
              alt="1edge"
              className="h-[36px] w-[90px] object-contain brightness-110 contrast-125"
            />
            <SimpleButton
              variant="primary"
              size="m"
              onClick={() => window.location.href = "/app"}
              className="px-6 py-2 font-semibold"
            >
              App
            </SimpleButton>
          </div>
        </div>
      </div>
    </nav>
  );
}

function ExploreOrderTypes() {
  const [visibleCards, setVisibleCards] = useState<boolean[]>([]);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    [0, 1, 2, 3].forEach((index) => {
      const timer = setTimeout(() => {
        setVisibleCards((prev) => {
          const newVisible = [...prev];
          newVisible[index] = true;
          return newVisible;
        });
      }, index * 100);
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  const orderTypes = [
    {
      icon: <ArrowUpDown className="w-8 h-8" />,
      title: "Limit Orders",
      description: "Buy or sell with precision.",
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Range Orders",
      description: "Scale in or out of a position.",
    },
    {
      icon: <Repeat className="w-8 h-8" />,
      title: "Recurring Orders",
      description: "Buy low and sell high on repeat.",
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Liquidity Position",
      description: "Auto-compounding and adjustable.",
    },
  ];

  return (
    <section className="py-20 px-4 md:px-6 bg-[#030303] relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 opacity-0 animate-[fadeInUp_0.8s_ease-out_0.2s_forwards]">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[#4fd1c5] font-medium">
              ORDER TYPES
            </span>
            <div className="h-px bg-gradient-to-r from-[#4fd1c5] to-transparent flex-1" />
          </div>
          <div className="text-right">
            <span className="text-white/60 text-sm">
              See full list in the docs
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {orderTypes.map((order, index) => (
            <div
              key={order.title}
              className={`relative group p-6 rounded-2xl border backdrop-blur-sm transition-all duration-300 cursor-pointer transform hover:scale-105 hover:-translate-y-2 ${
                order.highlighted
                  ? "bg-gradient-to-br from-[#4fd1c5]/15 to-[#4fd1c5]/5 border-[#4fd1c5]/40 shadow-[0_8px_32px_rgba(79,209,197,0.15)]"
                  : "bg-gradient-to-br from-[#4fd1c5]/8 to-[#4fd1c5]/3 border-[#4fd1c5]/20"
              } hover:shadow-[0_15px_50px_rgba(79,209,197,0.2)] hover:border-[#4fd1c5]/50 ${
                visibleCards[index]
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{
                transitionDelay: `${index * 0.1}s`,
              }}
            >
              <div className="flex items-center gap-4 mb-4">
                <div
                  className={`p-3 rounded-xl bg-gradient-to-br transition-transform hover:rotate-12 ${
                    order.highlighted
                      ? "from-[#4fd1c5]/25 to-[#4fd1c5]/10 text-[#4fd1c5] shadow-[0_4px_20px_rgba(79,209,197,0.3)]"
                      : "from-[#4fd1c5]/20 to-[#4fd1c5]/8 text-[#4fd1c5]/80"
                  }`}
                >
                  {order.icon}
                </div>
                {order.highlighted && (
                  <div className="text-[#4fd1c5] animate-pulse">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                )}
              </div>

              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#4fd1c5] transition-colors">
                {order.title}
              </h3>
              <p className="text-white/60 text-sm leading-relaxed">
                {order.description}
              </p>

              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-[#4fd1c5]/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              {/* Subtle glow effect */}
              <div
                className={`absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#4fd1c5]/10 via-[#4fd1c5]/5 to-[#4fd1c5]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-lg`}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const [visibleFeatures, setVisibleFeatures] = useState<boolean[]>([]);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    [0, 1, 2, 3].forEach((index) => {
      const timer = setTimeout(
        () => {
          setVisibleFeatures((prev) => {
            const newVisible = [...prev];
            newVisible[index] = true;
            return newVisible;
          });
        },
        500 + index * 100,
      );
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  const features = [
    {
      icon: <Shield className="w-12 h-12" />,
      title: "MEV Resistant",
      description:
        "1inch's limit order-protocol intent-centric nature makes it immune to sandwich attacks.",
    },
    {
      icon: <Zap className="w-12 h-12" />,
      title: "Zero Slippage",
      description:
        "The price you quote is what you'll receive when the trade is executed.",
    },
    {
      icon: <RefreshCw className="w-12 h-12" />,
      title: "Auto-Compounding",
      description:
        "Establish price discovery and manage token liquidity with ease.",
    },
    {
      icon: <Settings className="w-12 h-12" />,
      title: "Adjustable Positions",
      description:
        "Adjust without having to withdraw and recreate your position, saving time and gas.",
    },
  ];

  return (
    <section className="py-20 px-4 md:px-6 bg-[#030303] relative">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 opacity-0 animate-[fadeInUp_0.8s_ease-out_0.2s_forwards]">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[#4fd1c5] font-medium">FEATURES</span>
            <div className="h-px bg-gradient-to-r from-[#4fd1c5] to-transparent flex-1" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group relative p-8 rounded-2xl bg-gradient-to-br from-[#4fd1c5]/5 to-[#4fd1c5]/2 border border-[#4fd1c5]/10 backdrop-blur-sm hover:border-[#4fd1c5]/20 transition-all duration-500 cursor-pointer hover:scale-[1.02] hover:shadow-[0_10px_30px_rgba(79,209,197,0.08)] ${
                visibleFeatures[index]
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{
                transitionDelay: `${index * 0.1}s`,
              }}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4fd1c5]/15 to-[#4fd1c5]/5 flex items-center justify-center mb-6 text-[#4fd1c5] transition-transform hover:rotate-6 duration-300">
                {feature.icon}
              </div>

              <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-[#4fd1c5] transition-colors duration-300">
                {feature.title}
              </h3>

              <p className="text-white/60 leading-relaxed group-hover:text-white/70 transition-colors duration-300">
                {feature.description}
              </p>

              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-[#4fd1c5]/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const [visibleSections, setVisibleSections] = useState<boolean[]>([]);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    [0, 1, 2, 3].forEach((index) => {
      const timer = setTimeout(
        () => {
          setVisibleSections((prev) => {
            const newVisible = [...prev];
            newVisible[index] = true;
            return newVisible;
          });
        },
        200 + index * 100,
      );
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  const footerSections = [
    {
      title: "GET STARTED",
      links: [{ name: "Docs", icon: <FileText className="w-4 h-4" /> }],
    },
    {
      title: "SOCIAL",
      links: [{ name: "Github", icon: <Twitter className="w-4 h-4" /> }],
    },
  ];

  return (
    <footer className="relative bg-[#030303] border-t border-[#4fd1c5]/10 py-16">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {footerSections.map((section, index) => (
            <div
              key={section.title}
              className={`transition-all duration-600 ${
                visibleSections[index]
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-5"
              }`}
              style={{
                transitionDelay: `${index * 0.1}s`,
              }}
            >
              <h3 className="text-sm font-semibold text-white/40 mb-6 tracking-wider">
                {section.title}
              </h3>
              <ul className="space-y-4">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <a
                      href="#"
                      className="flex items-center gap-3 text-white/60 hover:text-[#4fd1c5] transition-all duration-300 group hover:translate-x-1"
                    >
                      <span className="group-hover:text-[#4fd1c5] transition-colors">
                        {link.icon}
                      </span>
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[#4fd1c5]/10 pt-12 opacity-0 animate-[fadeInUp_0.8s_ease-out_1s_forwards]">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <img
                src="/logo.svg"
                alt="1edge"
                className="h-[36px] w-[90px] object-contain brightness-110 contrast-125"
              />
            </div>

            <div className="text-center lg:text-right">
              <p className="text-white/60 text-sm">
                Created with{" "}
                <span className="text-[#4fd1c5] animate-pulse">❤️</span> by{" "}
                <span className="text-[#4fd1c5] font-semibold">1edge</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-[#4fd1c5]/[0.02] via-transparent to-transparent pointer-events-none" />
    </footer>
  );
}

function HeroSection() {
  const [titleVisible, setTitleVisible] = useState(false);
  const [badgeVisible, setBadgeVisible] = useState(false);
  const [descVisible, setDescVisible] = useState(false);
  const [buttonsVisible, setButtonsVisible] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setBadgeVisible(true), 500),
      setTimeout(() => setTitleVisible(true), 700),
      setTimeout(() => setDescVisible(true), 900),
      setTimeout(() => setButtonsVisible(true), 1100),
    ];

    return () => timers.forEach(clearTimeout);
  }, []);

  const handleLaunchApp = () => {
    window.location.href = "/app";
  };

  const handleDocs = () => {
    window.location.href = "/docs";
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#030303]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#4fd1c5]/[0.05] via-transparent to-[#4fd1c5]/[0.03] blur-3xl" />

      <div className="absolute inset-0 overflow-hidden">
        <ElegantShape
          delay={0.3}
          width={600}
          height={140}
          rotate={12}
          className="left-[-10%] md:left-[-5%] top-[15%] md:top-[20%]"
        />

        <ElegantShape
          delay={0.5}
          width={500}
          height={120}
          rotate={-15}
          className="right-[-5%] md:right-[0%] top-[70%] md:top-[75%]"
        />

        <ElegantShape
          delay={0.4}
          width={300}
          height={80}
          rotate={-8}
          className="left-[5%] md:left-[10%] bottom-[5%] md:bottom-[10%]"
        />

        <ElegantShape
          delay={0.6}
          width={200}
          height={60}
          rotate={20}
          className="right-[15%] md:right-[20%] top-[10%] md:top-[15%]"
        />

        <ElegantShape
          delay={0.7}
          width={150}
          height={40}
          rotate={-25}
          className="left-[20%] md:left-[25%] top-[5%] md:top-[10%]"
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-[#4fd1c5]/[0.08] mb-8 md:mb-12 transition-all duration-1000 ${
              badgeVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            }`}
          >
            <Circle className="h-2 w-2 fill-[#4fd1c5]/80" />
            <span className="text-sm text-white/60 tracking-wide">
              Advanced Orders using LOP
            </span>
          </div>

          <div
            className={`transition-all duration-1000 ${
              titleVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold mb-6 md:mb-8 tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                Trade Smarter,
              </span>
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#4fd1c5] via-white/90 to-[#4fd1c5]/80">
                Execute Better
              </span>
            </h1>
          </div>

          <div
            className={`transition-all duration-1000 ${
              descVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            <p className="text-base sm:text-lg md:text-xl text-white/40 mb-8 leading-relaxed font-light tracking-wide max-w-xl mx-auto px-4">
              TWAP, Range orders, DCA strategies, and grid trading with advanced
              analytics to maximize your trading performance.
            </p>
          </div>

          <div
            className={`flex flex-col sm:flex-row gap-4 justify-center items-center transition-all duration-1000 ${
              buttonsVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-8"
            }`}
          >
            <SimpleButton
              onClick={handleLaunchApp}
              className="group relative px-8 py-4 font-semibold flex items-center gap-2"
              variant="primary"
              size="l"
            >
              <Rocket className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              Launch App
            </SimpleButton>

            <SimpleButton
              onClick={handleDocs}
              className="group px-8 py-4 font-semibold flex items-center gap-2"
              variant="primary"
              size="l"
            >
              <BookOpen className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              Docs
              <ExternalLink className="w-4 h-4 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </SimpleButton>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/80 pointer-events-none" />
    </div>
  );
}

export default function EnhancedLandingPage() {
  return (
    <div className="bg-[#030303] min-h-screen">
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <Navbar />
      <HeroSection />
      <ExploreOrderTypes />
      <FeaturesSection />
      <Footer />
    </div>
  );
}
