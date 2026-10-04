import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/ai-course", label: "Contact form enquiries" },
  { href: "/ai-course/mock-exam", label: "Mock exam opt-ins" },
];

export default function AiCourseSubnav({ current }: { current: string }) {
  return (
    <nav
      aria-label="AI in Marketing Level 4"
      className="border-border flex shrink-0 gap-4 border-b px-4"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === current ? "page" : undefined}
          className={cn(
            "caption-style text-subtle hover:text-soft -mb-px border-b border-transparent py-3 transition-colors duration-150",
            tab.href === current &&
              "border-foreground text-foreground font-medium",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
