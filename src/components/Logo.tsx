import { cn } from "@/lib/utils";
import Image from 'next/image';

export const Logo = ({ className }: { className?: string }) => (
  <Image
    src="/logo.svg"
    alt="Sixth Hour Cafe Logo"
    width={3000}
    height={3000}
    className={cn("text-primary", className)}
  />
);
