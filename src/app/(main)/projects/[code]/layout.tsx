import { PageTransition } from "./page-transition";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
