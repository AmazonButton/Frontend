import React from 'react';

interface Floating3DCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  depth?: number;
  glareEffect?: boolean;
}

export const Floating3DCard: React.FC<Floating3DCardProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`transition-all duration-200 ${className}`}>
      {children}
    </div>
  );
};
