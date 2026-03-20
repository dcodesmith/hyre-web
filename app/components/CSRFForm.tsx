import { Form as RemixForm } from "react-router";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { forwardRef, type ComponentProps } from "react";

type CSRFFormProps = ComponentProps<typeof RemixForm>;

export const Form = forwardRef<HTMLFormElement, CSRFFormProps>(({ children, ...rest }, ref) => (
  <RemixForm {...rest} ref={ref}>
    <AuthenticityTokenInput />
    {children}
  </RemixForm>
));

Form.displayName = "CSRFForm";
