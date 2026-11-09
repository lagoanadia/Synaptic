import { auth } from "@/auth";
import { Landing } from "../landing/Landing";

// The website, always — "/" sends signed-in visitors to their space, this
// doesn't. Same page as "/", so search engines index "/" only.
export const metadata = { alternates: { canonical: "/" } };

export default async function Web() {
  const signedIn = !!(await auth())?.user?.id;
  return <Landing signedIn={signedIn} />;
}
