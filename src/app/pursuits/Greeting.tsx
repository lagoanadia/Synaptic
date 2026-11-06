"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// "Buenos días / tardes / noches" by the viewer's own clock (the server
// doesn't know their time zone), "Hola" until it has mounted.
export function Greeting({ name }: { name: string | null }) {
  const hour = useSyncExternalStore(subscribe, () => new Date().getHours(), () => -1);
  const word = hour < 0 ? "Hola" : hour < 6 ? "Buenas noches" : hour < 13 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";
  const first = name?.split(" ")[0];
  return (
    <h1 className="text-[2.1rem] leading-tight font-bold tracking-tight">
      {word}
      {first ? `, ${first}` : ""}
    </h1>
  );
}
