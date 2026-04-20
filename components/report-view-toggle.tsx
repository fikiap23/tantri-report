"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const V3_PATH = "/summary-v3";
const BACKOFFICE_PATH = "/backoffice-dashboard";

export function ReportViewToggle({ className }: { className?: string }) {
  const pathname = usePathname();
  const isV3 = pathname === V3_PATH;
  const isBackoffice = pathname === BACKOFFICE_PATH;
  const isClassic = !isV3 && !isBackoffice;

  return (
    <div
      className={cn(
        "inline-flex shrink-0 rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 text-sm print:hidden",
        className,
      )}
      role="group"
      aria-label="Tampilan laporan"
    >
      <Link
        href="/"
        className={cn(
          "rounded-md px-3 py-1.5 font-medium transition-colors",
          isClassic ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900",
        )}
      >
        Klasik
      </Link>
      <Link
        href={V3_PATH}
        className={cn(
          "rounded-md px-3 py-1.5 font-medium transition-colors",
          isV3 ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900",
        )}
      >
        Baru (v3)
      </Link>
      <Link
        href={BACKOFFICE_PATH}
        className={cn(
          "rounded-md px-3 py-1.5 font-medium transition-colors",
          isBackoffice ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900",
        )}
      >
        Backoffice
      </Link>
    </div>
  );
}
