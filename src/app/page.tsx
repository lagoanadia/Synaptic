import { LandingNav } from "./landing/LandingNav";
import { Landing } from "./landing/Landing";

// No longer redirects a signed-in visitor straight to /pursuits — that
// made "/" unreachable once logged in (even typing the URL bounced you
// right back), with no way to revisit the marketing page. Sign-in itself
// still lands new users on /pursuits directly (see redirectTo in
// landing/actions.ts), so this only affects someone deliberately
// navigating back to "/" afterward.
export default async function Home() {
  return (
    <>
      <LandingNav />
      <Landing />
    </>
  );
}
