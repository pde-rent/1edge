import DashboardGrid from "@/components/DashboardGrid";
import { Loader } from "@/components/ui/luma-spin";
import { usePrivy } from "@privy-io/react-auth";
import { HeroSection } from "@/components/Hero-section";
import FloatingNavbar from "@/components/Navbar";

export default function Home() {
  const { ready, authenticated } = usePrivy();
  
  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader />
      </div>
    );
  }
  
  return (

      <div className="pt-24 px-4">
        <HeroSection />
        {/* <DashboardGrid /> */}
      </div>
  )
}