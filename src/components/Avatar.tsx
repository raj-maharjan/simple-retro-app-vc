import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  userId?: string;
  className?: string;
}

export function Avatar({ 
  src, 
  alt = 'User Avatar', 
  size = 'md', 
  userId,
  className = '' 
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  // Reset states when src changes
  useEffect(() => {
    const normalizedSrc = src || null;
    
    // Only reset loading state if the src actually changed
    if (normalizedSrc !== loadedSrc) {
      setImageError(false);
      
      if (normalizedSrc) {
        setImageLoading(true);
        // Create a new image to test if it loads
        const img = new Image();
        img.onload = () => {
          setImageLoading(false);
          setLoadedSrc(normalizedSrc);
        };
        img.onerror = () => {
          setImageError(true);
          setImageLoading(false);
          setLoadedSrc(null);
        };
        img.src = normalizedSrc;
      } else {
        setImageLoading(false);
        setLoadedSrc(null);
      }
    }
  }, [src, loadedSrc]);

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8', 
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-20 h-20'
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5', 
    lg: 'w-6 h-6',
    xl: 'w-10 h-10'
  };

  // Generate consistent gradient based on userId
  const getGradientClass = () => {
    if (!userId) return 'from-purple-600 to-blue-600';
    
    const gradients = [
      'from-purple-600 to-blue-600',
      'from-blue-600 to-cyan-600',
      'from-green-600 to-teal-600',
      'from-yellow-600 to-orange-600',
      'from-red-600 to-pink-600',
      'from-indigo-600 to-purple-600',
      'from-cyan-600 to-blue-600',
      'from-teal-600 to-green-600'
    ];
    
    // Use a simple hash of userId to pick gradient consistently
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
    }
    
    return gradients[Math.abs(hash) % gradients.length];
  };

  const shouldShowImage = src && !imageError && !imageLoading && loadedSrc === src;

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden flex-shrink-0 ${className}`}>
      {shouldShowImage ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className={`w-full h-full bg-gradient-to-r ${getGradientClass()} flex items-center justify-center`}>
          {imageLoading ? (
            <div className="animate-spin rounded-full h-1/2 w-1/2 border-2 border-white border-t-transparent" />
          ) : (
            <User className={`${iconSizes[size]} text-white`} />
          )}
        </div>
      )}
    </div>
  );
} 