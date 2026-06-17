import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Camera,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Home,
  Image as ImageIcon,
  LogOut,
  LucideProps,
  MessageSquare,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  Search,
  Send,
  Shield,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react-native';
import { colors } from '@theme/index';

const registry = {
  alertCircle: AlertCircle,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  bell: Bell,
  camera: Camera,
  check: Check,
  checkCircle: CheckCircle,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  clock: Clock,
  close: X,
  fileText: FileText,
  filter: SlidersHorizontal,
  home: Home,
  image: ImageIcon,
  logOut: LogOut,
  message: MessageSquare,
  moreVertical: MoreVertical,
  package: Package,
  pencil: Pencil,
  plus: Plus,
  search: Search,
  send: Send,
  shield: Shield,
  shoppingBag: ShoppingBag,
  trash: Trash2,
  truck: Truck,
  user: User,
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
