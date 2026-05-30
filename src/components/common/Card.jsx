import clsx from 'clsx';

export const Card = ({ className, children, ...props }) => (
  <div {...props} className={clsx('surface-card min-w-0 max-w-full p-3 sm:p-3.5 md:p-4', className)}>
    {children}
  </div>
);
