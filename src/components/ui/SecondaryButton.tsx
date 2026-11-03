import { Button, type ButtonProps } from './Button';

export type SecondaryButtonProps = ButtonProps;
export function SecondaryButton(props: SecondaryButtonProps) {
  return <Button {...props} variant="secondary" />;
}
