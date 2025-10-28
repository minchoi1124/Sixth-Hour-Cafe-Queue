import { cn } from "@/lib/utils";

export const Logo = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 100 100"
    className={cn("text-primary", className)}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15,85 Q10,50 15,15 C40,10 60,10 85,15 Q90,50 85,85 C60,95 40,95 15,85"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <path
      d="M85,30 C95,35 98,50 85,55"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <text
      x="50"
      y="60"
      fontFamily="Patrick Hand, cursive"
      fontSize="40"
      fill="currentColor"
      textAnchor="middle"
    >
      6h
    </text>
  </svg>
);
