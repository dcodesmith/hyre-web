import { Form as RemixForm } from "@remix-run/react";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import type { ComponentProps } from "react";

type CSRFFormProps = ComponentProps<typeof RemixForm>;

export const Form = ({ children, ...rest }: CSRFFormProps) => (
  <RemixForm {...rest}>
    <AuthenticityTokenInput />
    {children}
  </RemixForm>
);
