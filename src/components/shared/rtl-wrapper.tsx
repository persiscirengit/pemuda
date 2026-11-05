import type * as React from "react";

export interface RtlWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  dir?: "rtl" | "ltr" | "auto";
  children: React.ReactNode;
}

export function RtlWrapper({
  dir = "ltr",
  children,
  className,
  ...props
}: RtlWrapperProps) {
  return (
    <div dir={dir} className={className} {...props}>
      {children}
    </div>
  );
}
