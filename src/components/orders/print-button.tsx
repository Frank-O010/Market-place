"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button variant="secondary" className="self-start print:hidden" onClick={() => window.print()}>
      <Printer aria-hidden /> Print or save as PDF
    </Button>
  );
}
