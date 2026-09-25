import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
  textClassName?: string
}

const sizeMap = {
  xs: { icon: 24, text: 'text-sm' },
  sm: { icon: 32, text: 'text-base' },
  md: { icon: 36, text: 'text-lg' },
  lg: { icon: 48, text: 'text-xl' },
  xl: { icon: 64, text: 'text-2xl' },
}

export function Logo({ size = 'md', showText = true, className, textClassName }: LogoProps) {
  const { icon, text } = sizeMap[size]
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div 
        className="relative shrink-0 rounded-xl overflow-hidden"
        style={{ width: icon, height: icon }}
      >
        <Image
          src="/icons/togethr-icon-blue.png"
          alt="Togethr"
          fill
          className="object-cover"
          priority
        />
      </div>
      {showText && (
        <span className={cn('font-bold text-foreground', text, textClassName)}>
          Togethr
        </span>
      )}
    </div>
  )
}

export function LogoIcon({ size = 'md', className }: { size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl', className?: string }) {
  const { icon } = sizeMap[size]
  
  return (
    <div 
      className={cn('relative shrink-0 rounded-xl overflow-hidden', className)}
      style={{ width: icon, height: icon }}
    >
      <Image
        src="/icons/togethr-icon-blue.png"
        alt="Togethr"
        fill
        className="object-cover"
        priority
      />
    </div>
  )
}
