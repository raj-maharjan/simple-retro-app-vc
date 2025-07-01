import React from 'react';
import { RotateCcw } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const sizeClasses = {
    sm: {
      icon: 'w-6 h-6',
      text: 'text-lg',
      container: 'gap-2',
    },
    md: {
      icon: 'w-8 h-8',
      text: 'text-xl',
      container: 'gap-3',
    },
    lg: {
      icon: 'w-12 h-12',
      text: 'text-3xl',
      container: 'gap-4',
    },
  };

  return (
    <div className={`flex items-center ${sizeClasses[size].container} ${className}`}>
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-2 shadow-lg">
        <RotateCcw className={`${sizeClasses[size].icon} text-white`} />
      </div>
      {showText && (
        <div>
          <h1 className={`${sizeClasses[size].text} font-bold text-gray-900`}>
            Grepsr <span className="text-purple-600">Retro</span>
          </h1>
          {size === 'lg' && (
            <p className="text-gray-600 text-sm">Collaborative Retrospectives</p>
          )}
        </div>
      )}
    </div>
  );
}