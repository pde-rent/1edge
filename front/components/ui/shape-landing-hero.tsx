"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import {
  Circle,
  Menu,
  X,
  ExternalLink,
  BookOpen,
  Rocket,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import AuthComponent from "../AuthComponent";
import { useRouter } from "next/router";
import { usePrivy } from "@privy-io/react-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = "from-white/[0.08]",
}: {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  gradient?: string;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -150,
        rotate: rotate - 15,
      }}
      animate={{
        opacity: 1,
        y: 0,
        rotate: rotate,
      }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={{
          y: [0, 15, 0],
        }}
        transition={{
          duration: 12,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
        style={{
          width,
          height,
        }}
        className="relative"
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            "bg-gradient-to-r to-transparent",
            gradient,
            "backdrop-blur-[2px] border-2 border-[#4fd1c5]/[0.15]",
            "shadow-[0_8px_32px_0_rgba(79,209,197,0.1)]",
            "after:absolute after:inset-0 after:rounded-full",
            "after:bg-[radial-gradient(circle_at_50%_50%,rgba(79,209,197,0.2),transparent_70%)]",
          )}
        />
      </motion.div>
    </motion.div>
  );
}

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
      className="fixed top-0 left-0 right-0 z-50 px-4 md:px-6 py-4"
    >
      <div className="max-w-7xl mx-auto">
        <div className="relative bg-black/20 backdrop-blur-xl border border-[#4fd1c5]/10 rounded-2xl px-6 py-3">
          <div className="flex items-center justify-between">
            <img
              src="/logo.svg"
              alt="1edge"
              className="h-[36px] w-[90px] object-contain brightness-110 contrast-125"
            />

            <AuthComponent variant="default" />
          </div>
        </div>
      </div>
    </motion.nav>
  );
}

function Footer() {
  return (
    <footer className="relative bg-[#030303] border-t border-[#4fd1c5]/10 py-8">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center">
          <p className="text-white/60 text-sm">
            Created with{" "}
            <span className="text-[#4fd1c5] animate-pulse">❤️</span> by{" "}
            <span className="text-[#4fd1c5] font-semibold">1edge</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

function HeroGeometric({
  badge = "Design Collective",
  title1 = "Elevate Your Digital Vision",
  title2 = "Crafting Exceptional Websites",
}: {
  badge?: string;
  title1?: string;
  title2?: string;
}) {
  const router = useRouter();
  const { authenticated, connectOrCreateWallet, ready } = usePrivy();
  const [showWalletModal, setShowWalletModal] = useState(false);

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 1,
        delay: 0.5 + i * 0.2,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
  };

  const handleLaunchApp = () => {
    if (!ready) return; // Wait for Privy to be ready

    if (authenticated) {
      // Wallet is connected, navigate to app
      router.push("/app");
    } else {
      // Wallet not connected, show modal
      setShowWalletModal(true);
    }
  };

  const handleConnectWallet = async () => {
    try {
      await connectOrCreateWallet();
      setShowWalletModal(false);
      // After successful connection, navigate to app
      router.push("/app");
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  return (
    <>
      <Navbar />
      <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#030303]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4fd1c5]/[0.05] via-transparent to-[#4fd1c5]/[0.03] blur-3xl" />

        <div className="absolute inset-0 overflow-hidden">
          <ElegantShape
            delay={0.3}
            width={600}
            height={140}
            rotate={12}
            gradient="from-[#4fd1c5]/[0.15]"
            className="left-[-10%] md:left-[-5%] top-[15%] md:top-[20%]"
          />

          <ElegantShape
            delay={0.5}
            width={500}
            height={120}
            rotate={-15}
            gradient="from-[#4fd1c5]/[0.12]"
            className="right-[-5%] md:right-[0%] top-[70%] md:top-[75%]"
          />

          <ElegantShape
            delay={0.4}
            width={300}
            height={80}
            rotate={-8}
            gradient="from-[#4fd1c5]/[0.18]"
            className="left-[5%] md:left-[10%] bottom-[5%] md:bottom-[10%]"
          />

          <ElegantShape
            delay={0.6}
            width={200}
            height={60}
            rotate={20}
            gradient="from-[#4fd1c5]/[0.10]"
            className="right-[15%] md:right-[20%] top-[10%] md:top-[15%]"
          />

          <ElegantShape
            delay={0.7}
            width={150}
            height={40}
            rotate={-25}
            gradient="from-[#4fd1c5]/[0.20]"
            className="left-[20%] md:left-[25%] top-[5%] md:top-[10%]"
          />
        </div>

        <div className="relative z-10 container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              custom={0}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-[#4fd1c5]/[0.08] mb-8 md:mb-12"
            >
              <Circle className="h-2 w-2 fill-[#4fd1c5]/80" />
              <span className="text-sm text-white/60 tracking-wide">
                {badge}
              </span>
            </motion.div>

            <motion.div
              custom={1}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
            >
              <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold mb-6 md:mb-8 tracking-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                  {title1}
                </span>
                <br />
                <span
                  className={cn(
                    "bg-clip-text text-transparent bg-gradient-to-r from-[#4fd1c5] via-white/90 to-[#4fd1c5]/80",
                  )}
                >
                  {title2}
                </span>
              </h1>
            </motion.div>

            <motion.div
              custom={2}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
            >
              <p className="text-base sm:text-lg md:text-xl text-white/40 mb-8 leading-relaxed font-light tracking-wide max-w-xl mx-auto px-4">
                TWAP, Range orders, DCA strategies, and grid trading with
                advanced analytics to maximize your trading performance.
              </p>
            </motion.div>

            <motion.div
              custom={3}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <button
                className="group relative px-8 py-4 bg-[#4fd1c5] text-black font-semibold rounded-xl hover:bg-[#4fd1c5]/90 transition-all duration-300 flex items-center gap-2 shadow-[0_0_30px_rgba(79,209,197,0.3)] hover:shadow-[0_0_40px_rgba(79,209,197,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleLaunchApp}
                disabled={!ready}
              >
                <Rocket className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                Launch App
              </button>

              <button className="group px-8 py-4 border-2 border-[#4fd1c5]/30 text-white font-semibold rounded-xl hover:border-[#4fd1c5] hover:bg-[#4fd1c5]/5 transition-all duration-300 flex items-center gap-2">
                <BookOpen className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                Docs
                <ExternalLink className="w-4 h-4 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </button>
            </motion.div>
          </div>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/80 pointer-events-none" />
      </div>

      {/* Wallet Connection Modal */}
      <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
        <DialogContent className="sm:max-w-md bg-[#0a0a0a] border border-[#4fd1c5]/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#4fd1c5] to-white">
              Connect Your Wallet
            </DialogTitle>
            <DialogDescription className="text-center text-white/60 mt-2">
              Please connect your wallet to access the app and unlock all
              features.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-6">
            <button
              onClick={handleConnectWallet}
              className="group relative w-full px-6 py-3 bg-[#4fd1c5] text-black font-semibold rounded-xl hover:bg-[#4fd1c5]/90 transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(79,209,197,0.3)] hover:shadow-[0_0_30px_rgba(79,209,197,0.5)]"
            >
              <Wallet className="w-5 h-5" />
              Connect Wallet
            </button>

            <button
              onClick={() => setShowWalletModal(false)}
              className="w-full px-6 py-3 border border-[#4fd1c5]/30 text-white/70 font-medium rounded-xl hover:border-[#4fd1c5]/50 hover:text-white transition-all duration-300"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </>
  );
}

export { HeroGeometric, Navbar, Footer };
