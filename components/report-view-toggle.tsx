"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const V2_PATH = "/summary-v2";
const V2_SHIFT_PATH = "/summary-v2-shift";
const SHIFT_PER_USER_PATH = "/laporan-per-shift";
const BACKOFFICE_PATH = "/backoffice-dashboard";

export function ReportViewToggle({ className }: { className?: string }) {
  const pathname = usePathname();
  const isV2 = pathname === V2_PATH;
  const isV2Shift = pathname === V2_SHIFT_PATH;
  const isShiftPerUser = pathname === SHIFT_PER_USER_PATH;
  const isBackoffice = pathname === BACKOFFICE_PATH;
  const isClassic = !isV2 && !isV2Shift && !isShiftPerUser && !isBackoffice;

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
        href={V2_PATH}
        className={cn(
          "rounded-md px-3 py-1.5 font-medium transition-colors",
          isV2 ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900",
        )}
      >
        Baru (v2)
      </Link>
      <Link
        href={V2_SHIFT_PATH}
        className={cn(
          "rounded-md px-3 py-1.5 font-medium transition-colors",
          isV2Shift ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900",
        )}
      >
        Shift (v2)
      </Link>
      <Link
        href={SHIFT_PER_USER_PATH}
        className={cn(
          "rounded-md px-3 py-1.5 font-medium transition-colors",
          isShiftPerUser ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900",
        )}
      >
        Per Shift
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
