import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Problem } from "@/components/landing/problem";
import { QueCambia } from "@/components/landing/que-cambia";
import { SocialProof } from "@/components/landing/social-proof";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FAQ } from "@/components/landing/faq";
import { FinalCTA } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Problem />
      <QueCambia />
      <SocialProof />
      <HowItWorks />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
