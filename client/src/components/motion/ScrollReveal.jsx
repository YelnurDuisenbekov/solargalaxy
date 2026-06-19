import { motion, useReducedMotion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1];

/** Плавное появление одного блока при скролле */
export function Reveal({ children, className, delay = 0, y = 24 }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12, margin: '0px 0px -32px 0px' }}
      transition={{ duration: reduce ? 0 : 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Контейнер с каскадным появлением дочерних карточек */
export function RevealGroup({ children, className, stagger = 0.08 }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.08 }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: reduce ? 0 : stagger } },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Элемент внутри RevealGroup */
export function RevealItem({ children, className, y = 24 }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduce ? {} : { opacity: 0, y },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: EASE },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
