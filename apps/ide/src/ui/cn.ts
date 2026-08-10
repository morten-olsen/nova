import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names, letting a caller's utility win over a component's default
 * for the same CSS property — `<Button className="px-6">` should not end up
 * with two competing paddings.
 */
const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export { cn };
