import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  LucideProps,
  MessageSquare,
  Search,
  Shield,
  ShoppingBag,
  User,
  X,
} from 'lucide-react-native';
import { colors } from '@theme/index';

const registry = {
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  bell: Bell,
  check: Check,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  image: ImageIcon,
  message: MessageSquare,
  search: Search,
  shield: Shield,
  shoppingBag: ShoppingBag,
  user: User,
  close: X,
} as const;

export type IconName = keyof typeof registry;

type Props = Omit<LucideProps, 'name'> & {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 22, color = colors.ink, ...rest }: Props) {
  const Component = registry[name];
  return <Component size={size} color={color} strokeWidth={1.5} {...rest} />;
}
