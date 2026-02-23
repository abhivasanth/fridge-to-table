"use client";
import { useState, useEffect } from "react";

const MESSAGES = [
  "Checking your fridge...",
  "Consulting the chef...",
  "Almost ready...",
];

export function LoadingChef() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center pt-6 pb-2 gap-3">
      <span className="text-4xl animate-bounce">👨‍🍳</span>
      <p className="text-sm text-gray-500 animate-pulse">{MESSAGES[messageIndex]}</p>
    </div>
  );
}
