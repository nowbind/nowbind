"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  size?: number;
  className?: string;
  linkTo?: string;
}

export function Logo({ size = 32, className = "", linkTo = "/" }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const src = mounted && resolvedTheme === "dark"
    ? "/logos/n.-light.svg"
    : "/logos/n.-dark.svg";

  const img = (
    <Image
      src={src}
      alt="NowBind"
      width={size}
      height={size}
      className={className}
      priority
    />
  );

  if (linkTo) {
    return (
      <Link href={linkTo} className="flex items-center gap-2">
        {img}
      </Link>
    );
  }

  return img;
}
