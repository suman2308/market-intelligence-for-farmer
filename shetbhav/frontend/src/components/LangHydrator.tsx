"use client";

import { useEffect } from "react";
import { hydrateLang } from "@/lib/i18n";

export default function LangHydrator() {
  useEffect(() => {
    hydrateLang();
  }, []);
  return null;
}
