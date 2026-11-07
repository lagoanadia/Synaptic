import { LandingNav } from "./landing/LandingNav";
import { Landing } from "./landing/Landing";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata = { alternates: { canonical: "/" } };

// Tells search engines this is a free study app called Synaptic Notes.
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  alternateName: "Synaptic",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  inLanguage: "es",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  author: { "@type": "Person", name: "Nadia Lagoa" },
};

// Signed-in visitors can still see the landing page; sign-in itself lands on
// /pursuits (landing/actions.ts).
export default async function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <LandingNav />
      <Landing />
    </>
  );
}
