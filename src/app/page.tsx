import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LandingNav } from "./landing/LandingNav";
import { Landing } from "./landing/Landing";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect("/pursuits");
  }

  return (
    <>
      <LandingNav />
      <Landing />
    </>
  );
}
