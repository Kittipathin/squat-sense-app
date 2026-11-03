import { Button, type ButtonProps } from './Button';

export type PrimaryButtonProps = ButtonProps;
export function PrimaryButton(props: PrimaryButtonProps) {
  return <Button {...props} variant="primary" />;
}
