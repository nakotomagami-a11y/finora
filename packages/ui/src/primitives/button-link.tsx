import type { AnchorHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "../cn.ts";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button.tsx";
import { Icon } from "./icon.tsx";

export type ButtonLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children"> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A link to another site: it opens in a new tab with `rel="noopener noreferrer"` and shows the external icon. */
  external?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLAnchorElement>;
};

/** A link that looks like a button, for going somewhere. A button does something on this page; a link goes elsewhere. */
export function ButtonLink({ variant = "secondary", size = "sm", external = false, className, children, ref, ...rest }: ButtonLinkProps) {
  return (
    <a
      ref={ref}
      className={cn(buttonClasses.base, buttonClasses.size[size], buttonClasses.variant[variant], className)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...rest}
    >
      {children}
      {external ? <Icon name="external" /> : null}
    </a>
  );
}
