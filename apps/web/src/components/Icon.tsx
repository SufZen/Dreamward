import {
  HeartPulse,
  Brain,
  Heart,
  Award,
  Sparkles,
  HeartHandshake,
  Baby,
  Users,
  Coins,
  Briefcase,
  Flame,
  Sun,
  Circle,
  type LucideProps,
} from 'lucide-react';

/**
 * Resolve a category icon by its DB-stored name. Only the icons actually used
 * are imported explicitly so the bundle stays tree-shakeable (a namespace
 * `import * as Lucide` would pull the entire ~1500-icon library).
 */
const REGISTRY: Record<string, React.ComponentType<LucideProps>> = {
  HeartPulse,
  Brain,
  Heart,
  Award,
  Sparkles,
  HeartHandshake,
  Baby,
  Users,
  Coins,
  Briefcase,
  Flame,
  Sun,
};

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = REGISTRY[name] ?? Circle;
  return <Cmp {...props} />;
}
