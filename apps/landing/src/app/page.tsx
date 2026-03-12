import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Metrics } from "@/components/landing/metrics";
import { Benefits } from "@/components/landing/benefits";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FAQ } from "@/components/landing/faq";
import { FinalCTA } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Metrics />
      <Benefits />
      <HowItWorks />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
