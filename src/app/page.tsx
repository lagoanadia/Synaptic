import { LandingNav } from "./landing/LandingNav";
import { Landing } from "./landing/Landing";

// Signed-in visitors can still see the landing page; sign-in itself lands on
// /pursuits (landing/actions.ts).
export default async function Home() {
  return (
    <>
      <LandingNav />
      <Landing />
    </>
  );
}
