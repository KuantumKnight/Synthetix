import React from "react";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Scroll-reveal feature section — adapted from needs/3.txt.
 * Generalized to accept a React `mockup` node (a live UI preview) instead of
 * external image URLs, with a layered backdrop card behind it.
 */
interface SectionWithMockupProps {
  eyebrow?: string;
  title: React.ReactNode;
  description: React.ReactNode;
  mockup: React.ReactNode;
  reverseLayout?: boolean;
  className?: string;
}

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.2 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};

export function SectionWithMockup({
  eyebrow,
  title,
  description,
  mockup,
  reverseLayout = false,
  className,
}: SectionWithMockupProps) {
  return (
    <section className={cn("relative w-full py-24 md:py-32", className)}>
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className={cn(
            "grid items-center gap-12 md:grid-cols-2 md:gap-16",
            reverseLayout && "md:[&>*:first-child]:order-2"
          )}
        >
          {/* Copy */}
          <motion.div variants={itemVariants} className="max-w-xl">
            {eyebrow && (
              <span className="mb-4 inline-block rounded-full bg-primary/12 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
                {eyebrow}
              </span>
            )}
            <h2 className="font-serif text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
              {title}
            </h2>
            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              {description}
            </p>
          </motion.div>

          {/* Mockup */}
          <motion.div variants={itemVariants} className="relative">
            <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/10 via-transparent to-transparent blur-2xl" />
            <div className="rounded-2xl border border-border bg-card/80 p-2 shadow-xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-1">
              <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
                {mockup}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
